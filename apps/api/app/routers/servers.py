from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.database import get_db
from app.models import Server, User
from app.schemas import ServerCreate, ServerOut, ServerSyncResult, ServerUpdate
from app.services.crypto import encrypt_private_key
from app.services.crypto import CredentialDecryptError
from app.services.placement import (
    PROVIDERS,
    apply_server_placement,
    get_owned_datacenter,
    validate_server_placement,
)
from app.services.server_credentials import (
    apply_resolved_auth,
    get_server_auth,
    resolve_server_auth,
)
from app.services.ssh import fetch_server_info

router = APIRouter(prefix="/api/servers", tags=["servers"])


class ServerPlacementUpdate(BaseModel):
    datacenter_id: int | None = None
    rack_id: int | None = None
    rack_u: int | None = Field(default=None, ge=1, le=52)
    rack_units: int | None = Field(default=None, ge=1, le=52)


@router.get("/providers")
def list_providers():
    return {"providers": PROVIDERS}


def _resolve_placement_from_payload(
    server: Server,
    data: dict,
) -> tuple[int | None, int | None, int | None, int | None] | None:
    """Return new placement if any placement field was in the patch, else None."""
    if not any(k in data for k in ("datacenter_id", "rack_id", "rack_u", "rack_units")):
        return None

    datacenter_id = data.pop("datacenter_id", server.datacenter_id)
    rack_id = data.pop("rack_id", server.rack_id)
    rack_u = data.pop("rack_u", server.rack_u)
    rack_units = data.pop("rack_units", server.rack_units)

    if datacenter_id is None:
        return None, None, None, None

    if rack_id is None:
        rack_u = None

    return datacenter_id, rack_id, rack_u, rack_units


@router.get("", response_model=list[ServerOut])
def list_servers(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Server).filter(Server.owner_id == current_user.id).order_by(Server.name).all()


@router.post("", response_model=ServerOut, status_code=status.HTTP_201_CREATED)
async def create_server(
    payload: ServerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    datacenter_id = payload.datacenter_id
    rack_id = payload.rack_id
    rack_u = payload.rack_u
    rack_units = payload.rack_units

    validate_server_placement(db, current_user.id, datacenter_id, rack_id, rack_u, rack_units)
    if datacenter_id:
        dc = get_owned_datacenter(db, datacenter_id, current_user.id)
        if dc.type == "cloud":
            rack_id = None
            rack_u = None

    resolved = resolve_server_auth(
        db,
        current_user.id,
        auth_type=payload.auth_type,
        ssh_username=payload.ssh_username,
        ssh_private_key=payload.ssh_private_key,
        ssh_key_passphrase=payload.ssh_key_passphrase,
        ssh_password=payload.ssh_password,
        ssh_key_profile_id=payload.ssh_key_profile_id,
        password_profile_id=payload.password_profile_id,
    )

    server = Server(
        name=payload.ip_address,
        ip_address=payload.ip_address,
        provider=payload.provider,
        ssh_port=payload.ssh_port,
        notes=payload.notes,
        datacenter_id=datacenter_id,
        rack_id=rack_id,
        rack_u=rack_u,
        rack_units=rack_units,
        owner_id=current_user.id,
    )
    apply_resolved_auth(server, resolved)
    db.add(server)
    db.commit()
    db.refresh(server)

    try:
        await _apply_sync(server, db)
    except ConnectionError:
        pass

    db.refresh(server)
    return server


@router.get("/{server_id}", response_model=ServerOut)
def get_server(
    server_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    server = _get_owned_server(db, server_id, current_user.id)
    return server


@router.patch("/{server_id}", response_model=ServerOut)
def update_server(
    server_id: int,
    payload: ServerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    server = _get_owned_server(db, server_id, current_user.id)
    data = payload.model_dump(exclude_unset=True)
    fields_set = payload.model_fields_set

    credential_fields = {
        "auth_type",
        "ssh_private_key",
        "ssh_key_passphrase",
        "ssh_password",
        "ssh_key_profile_id",
        "password_profile_id",
    }
    if credential_fields & fields_set:
        resolved = resolve_server_auth(
            db,
            current_user.id,
            auth_type=data.pop("auth_type", server.auth_type),
            ssh_username=data.pop("ssh_username", server.ssh_username),
            ssh_private_key=data.pop("ssh_private_key", None),
            ssh_key_passphrase=data.pop("ssh_key_passphrase", None),
            ssh_password=data.pop("ssh_password", None),
            ssh_key_profile_id=data.pop("ssh_key_profile_id", server.ssh_key_profile_id),
            password_profile_id=data.pop("password_profile_id", server.password_profile_id),
        )
        apply_resolved_auth(server, resolved)
    elif "ssh_private_key" in data:
        key = data.pop("ssh_private_key")
        if key:
            data["ssh_private_key_encrypted"] = encrypt_private_key(key)

    if "ssh_key_passphrase" in data:
        passphrase = data.pop("ssh_key_passphrase")
        if passphrase:
            data["ssh_key_passphrase_encrypted"] = encrypt_private_key(passphrase)
        else:
            data["ssh_key_passphrase_encrypted"] = None

    if "ssh_password" in data:
        password = data.pop("ssh_password")
        if password:
            data["ssh_password_encrypted"] = encrypt_private_key(password)

    placement = _resolve_placement_from_payload(server, data)
    if placement is not None:
        apply_server_placement(server, db, current_user.id, *placement)

    for key, value in data.items():
        setattr(server, key, value)

    db.commit()
    db.refresh(server)
    return server


@router.patch("/{server_id}/placement", response_model=ServerOut)
def update_server_placement(
    server_id: int,
    payload: ServerPlacementUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    server = _get_owned_server(db, server_id, current_user.id)
    fields_set = payload.model_fields_set

    datacenter_id = payload.datacenter_id if "datacenter_id" in fields_set else server.datacenter_id
    rack_id = payload.rack_id if "rack_id" in fields_set else server.rack_id
    rack_u = payload.rack_u if "rack_u" in fields_set else server.rack_u
    rack_units = payload.rack_units if "rack_units" in fields_set else server.rack_units

    if datacenter_id is None:
        rack_id = None
        rack_u = None
    elif rack_id is None:
        rack_u = None

    apply_server_placement(server, db, current_user.id, datacenter_id, rack_id, rack_u, rack_units)
    db.commit()
    db.refresh(server)
    return server


@router.delete("/{server_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_server(
    server_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    server = _get_owned_server(db, server_id, current_user.id)
    db.delete(server)
    db.commit()


@router.post("/{server_id}/sync", response_model=ServerSyncResult)
async def sync_server(
    server_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    server = _get_owned_server(db, server_id, current_user.id)

    try:
        await _apply_sync(server, db)
        return ServerSyncResult(server=server, message="Server info updated")
    except CredentialDecryptError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ConnectionError as exc:
        server.status = "offline"
        db.commit()
        db.refresh(server)
        raise HTTPException(status_code=502, detail=f"SSH connection failed: {exc}") from exc


async def _apply_sync(server: Server, db: Session) -> None:
    auth = get_server_auth(server)
    info = await fetch_server_info(
        host=server.ip_address,
        port=server.ssh_port,
        auth=auth,
    )
    server.name = info.hostname
    server.hostname = info.hostname
    server.os_info = info.os_info
    server.memory_total = info.memory_total
    server.disk_total = info.disk_total
    server.cpu_count = info.cpu_count
    server.status = info.status
    server.last_sync_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(server)


def _get_owned_server(db: Session, server_id: int, owner_id: int) -> Server:
    server = db.query(Server).filter(Server.id == server_id, Server.owner_id == owner_id).first()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    return server

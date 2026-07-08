from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.database import get_db
from app.models import Datacenter, Rack, Server, User
from app.schemas import (
    CloudConnectionOut,
    CloudConnectionSet,
    CloudCredentialField,
    CloudDiscoverOut,
    CloudInstanceOut,
    CloudSyncResult,
    DatacenterCreate,
    DatacenterInventory,
    DatacenterOut,
    DatacenterUpdate,
    InventoryOut,
    RackCreate,
    RackOut,
    RackUpdate,
    RackWithServers,
    ServerOut,
)
from app.services.cloud.base import CloudProviderError
from app.services.cloud.credentials import PROVIDER_CREDENTIAL_FIELDS
from app.services.cloud_sync import (
    clear_cloud_credentials,
    discover_for_datacenter,
    get_cloud_credentials,
    save_cloud_credentials,
    sync_datacenter_servers,
    test_cloud_connection,
)
from app.services.placement import PROVIDERS, get_owned_datacenter, get_owned_rack

router = APIRouter(prefix="/api/datacenters", tags=["datacenters"])


def _dc_out(dc: Datacenter) -> DatacenterOut:
    return DatacenterOut.from_datacenter(dc)


def _server_out(s: Server) -> ServerOut:
    return ServerOut.model_validate(s)


@router.get("/providers")
def list_cloud_providers():
    return {"providers": PROVIDERS}


@router.get("/inventory", response_model=InventoryOut)
def get_inventory(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    datacenters = (
        db.query(Datacenter)
        .filter(Datacenter.owner_id == current_user.id)
        .order_by(Datacenter.type, Datacenter.name)
        .all()
    )
    all_servers = db.query(Server).filter(Server.owner_id == current_user.id).all()

    result_dcs: list[DatacenterInventory] = []
    assigned_ids: set[int] = set()

    for dc in datacenters:
        racks = db.query(Rack).filter(Rack.datacenter_id == dc.id).order_by(Rack.position, Rack.name).all()
        rack_items: list[RackWithServers] = []
        dc_direct_servers: list[ServerOut] = []

        for rack in racks:
            rack_servers = [s for s in all_servers if s.rack_id == rack.id]
            rack_servers.sort(key=lambda s: (s.rack_u or 0, s.name))
            for s in rack_servers:
                assigned_ids.add(s.id)
            rack_items.append(
                RackWithServers(
                    id=rack.id,
                    datacenter_id=rack.datacenter_id,
                    name=rack.name,
                    position=rack.position,
                    capacity_u=rack.capacity_u,
                    created_at=rack.created_at,
                    servers=[_server_out(s) for s in rack_servers],
                )
            )

        if dc.type == "cloud":
            dc_servers = [s for s in all_servers if s.datacenter_id == dc.id and s.rack_id is None]
            for s in dc_servers:
                assigned_ids.add(s.id)
            dc_direct_servers = [_server_out(s) for s in dc_servers]
        else:
            unplaced = [s for s in all_servers if s.datacenter_id == dc.id and s.rack_id is None]
            for s in unplaced:
                assigned_ids.add(s.id)
            dc_direct_servers = [_server_out(s) for s in unplaced]

        result_dcs.append(
            DatacenterInventory(
                id=dc.id,
                name=dc.name,
                type=dc.type,
                provider=dc.provider,
                location=dc.location,
                description=dc.description,
                cloud_connected=bool(dc.cloud_credentials_encrypted),
                cloud_last_sync_at=dc.cloud_last_sync_at,
                cloud_sync_supported=dc.provider in PROVIDER_CREDENTIAL_FIELDS if dc.provider else False,
                created_at=dc.created_at,
                updated_at=dc.updated_at,
                racks=rack_items,
                servers=dc_direct_servers,
            )
        )

    unassigned = [_server_out(s) for s in all_servers if s.id not in assigned_ids and s.datacenter_id is None]

    return InventoryOut(datacenters=result_dcs, unassigned_servers=unassigned)


@router.get("", response_model=list[DatacenterOut])
def list_datacenters(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    dcs = db.query(Datacenter).filter(Datacenter.owner_id == current_user.id).order_by(Datacenter.name).all()
    return [_dc_out(dc) for dc in dcs]


@router.post("", response_model=DatacenterOut, status_code=status.HTTP_201_CREATED)
def create_datacenter(
    payload: DatacenterCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.type == "cloud" and not payload.provider:
        raise HTTPException(status_code=400, detail="provider required for cloud datacenters")

    dc = Datacenter(
        name=payload.name,
        type=payload.type,
        provider=payload.provider if payload.type == "cloud" else None,
        location=payload.location,
        description=payload.description,
        owner_id=current_user.id,
    )
    db.add(dc)
    db.commit()
    db.refresh(dc)
    return _dc_out(dc)


@router.patch("/{datacenter_id}", response_model=DatacenterOut)
def update_datacenter(
    datacenter_id: int,
    payload: DatacenterUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    dc = get_owned_datacenter(db, datacenter_id, current_user.id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(dc, key, value)
    db.commit()
    db.refresh(dc)
    return _dc_out(dc)


@router.get("/{datacenter_id}/cloud/connection", response_model=CloudConnectionOut)
def get_cloud_connection(
    datacenter_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    dc = get_owned_datacenter(db, datacenter_id, current_user.id)
    if dc.type != "cloud":
        raise HTTPException(status_code=400, detail="Cloud API only available for cloud datacenters")

    fields = PROVIDER_CREDENTIAL_FIELDS.get(dc.provider or "", [])
    return CloudConnectionOut(
        connected=bool(dc.cloud_credentials_encrypted),
        provider=dc.provider,
        last_sync_at=dc.cloud_last_sync_at,
        sync_supported=bool(fields),
        credential_fields=[CloudCredentialField(**f) for f in fields],
    )


@router.put("/{datacenter_id}/cloud/connection", response_model=CloudConnectionOut)
async def set_cloud_connection(
    datacenter_id: int,
    payload: CloudConnectionSet,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    dc = get_owned_datacenter(db, datacenter_id, current_user.id)
    if dc.type != "cloud":
        raise HTTPException(status_code=400, detail="Cloud API only available for cloud datacenters")
    if dc.provider not in PROVIDER_CREDENTIAL_FIELDS:
        raise HTTPException(status_code=400, detail=f"API sync not supported for provider {dc.provider}")

    try:
        await test_cloud_connection(dc.provider, payload.credentials)
    except CloudProviderError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    save_cloud_credentials(dc, payload.credentials)
    db.commit()
    db.refresh(dc)

    fields = PROVIDER_CREDENTIAL_FIELDS.get(dc.provider or "", [])
    return CloudConnectionOut(
        connected=True,
        provider=dc.provider,
        last_sync_at=dc.cloud_last_sync_at,
        sync_supported=True,
        credential_fields=[CloudCredentialField(**f) for f in fields],
    )


@router.delete("/{datacenter_id}/cloud/connection", status_code=status.HTTP_204_NO_CONTENT)
def delete_cloud_connection(
    datacenter_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    dc = get_owned_datacenter(db, datacenter_id, current_user.id)
    clear_cloud_credentials(dc)
    db.commit()


@router.get("/{datacenter_id}/cloud/discover", response_model=CloudDiscoverOut)
async def discover_cloud_instances(
    datacenter_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    dc = get_owned_datacenter(db, datacenter_id, current_user.id)
    try:
        instances = await discover_for_datacenter(dc)
    except CloudProviderError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    existing_ids = {
        s.external_id
        for s in db.query(Server).filter(Server.owner_id == current_user.id, Server.datacenter_id == dc.id).all()
        if s.external_id
    }
    existing_ips = {
        s.ip_address
        for s in db.query(Server).filter(Server.owner_id == current_user.id, Server.datacenter_id == dc.id).all()
    }

    out = []
    for inst in instances:
        imported = inst.external_id in existing_ids or inst.ip_address in existing_ips
        out.append(
            CloudInstanceOut(
                external_id=inst.external_id,
                name=inst.name,
                ip_address=inst.ip_address,
                status=inst.status,
                os_info=inst.os_info,
                memory_total=inst.memory_total,
                disk_total=inst.disk_total,
                cpu_count=inst.cpu_count,
                instance_type=inst.instance_type,
                already_imported=imported,
            )
        )
    return CloudDiscoverOut(instances=out, total=len(out))


@router.post("/{datacenter_id}/cloud/sync", response_model=CloudSyncResult)
async def sync_cloud_instances(
    datacenter_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    dc = get_owned_datacenter(db, datacenter_id, current_user.id)
    try:
        result = await sync_datacenter_servers(db, dc, current_user.id)
    except CloudProviderError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return CloudSyncResult(
        created=result["created"],
        updated=result["updated"],
        total=result["total"],
        message=f"{result['created']} créé(s), {result['updated']} mis à jour — {result['total']} instance(s) trouvée(s)",
    )


@router.delete("/{datacenter_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_datacenter(
    datacenter_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    dc = get_owned_datacenter(db, datacenter_id, current_user.id)
    db.delete(dc)
    db.commit()


@router.get("/{datacenter_id}/racks", response_model=list[RackOut])
def list_racks(
    datacenter_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_owned_datacenter(db, datacenter_id, current_user.id)
    return db.query(Rack).filter(Rack.datacenter_id == datacenter_id).order_by(Rack.position, Rack.name).all()


@router.post("/{datacenter_id}/racks", response_model=RackOut, status_code=status.HTTP_201_CREATED)
def create_rack(
    datacenter_id: int,
    payload: RackCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    dc = get_owned_datacenter(db, datacenter_id, current_user.id)
    if dc.type != "custom":
        raise HTTPException(status_code=400, detail="Racks can only be created in custom datacenters")

    rack = Rack(
        datacenter_id=datacenter_id,
        name=payload.name,
        position=payload.position,
        capacity_u=payload.capacity_u,
    )
    db.add(rack)
    db.commit()
    db.refresh(rack)
    return rack


@router.patch("/{datacenter_id}/racks/{rack_id}", response_model=RackOut)
def update_rack(
    datacenter_id: int,
    rack_id: int,
    payload: RackUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_owned_datacenter(db, datacenter_id, current_user.id)
    rack = get_owned_rack(db, rack_id, current_user.id)
    if rack.datacenter_id != datacenter_id:
        raise HTTPException(status_code=404, detail="Rack not found in this datacenter")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(rack, key, value)
    db.commit()
    db.refresh(rack)
    return rack


@router.delete("/{datacenter_id}/racks/{rack_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_rack(
    datacenter_id: int,
    rack_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_owned_datacenter(db, datacenter_id, current_user.id)
    rack = get_owned_rack(db, rack_id, current_user.id)
    if rack.datacenter_id != datacenter_id:
        raise HTTPException(status_code=404, detail="Rack not found in this datacenter")
    db.delete(rack)
    db.commit()

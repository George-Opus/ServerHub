import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.database import get_db
from app.models import ServiceScan, Server, User
from app.services.crypto import CredentialDecryptError
from app.services import service_manager as sm

router = APIRouter(prefix="/api/servers", tags=["services"])


def _get_server(db: Session, server_id: int, user: User) -> Server:
    server = db.query(Server).filter(Server.id == server_id, Server.owner_id == user.id).first()
    if not server:
        raise HTTPException(status_code=404, detail="Serveur introuvable")
    return server


class ActionRequest(BaseModel):
    action: str = Field(pattern="^(start|stop|restart|reload)$")


class DeployConfigRequest(BaseModel):
    path: str = Field(min_length=1, max_length=512)
    content: str = Field(min_length=1)


class InstallRequest(BaseModel):
    service_id: str = Field(min_length=1, max_length=64)


class ContainerActionRequest(BaseModel):
    container: str = Field(min_length=1, max_length=128)
    action: str = Field(pattern="^(start|stop|restart)$")


async def _guard(coro):
    try:
        return await coro
    except sm.ServiceError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except CredentialDecryptError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ConnectionError as exc:
        raise HTTPException(status_code=502, detail=f"Connexion SSH échouée : {exc}") from exc
    except Exception as exc:  # asyncssh / timeout / etc.
        raise HTTPException(status_code=502, detail=f"Erreur d'exécution distante : {exc}") from exc


@router.get("/service-catalog")
def service_catalog(_: User = Depends(get_current_user)):
    return {"catalog": sm.SERVICE_CATALOG}


@router.get("/{server_id}/services")
def list_services(server_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Retourne le dernier scan persisté (sans SSH). Utiliser /scan pour rafraîchir."""
    server = _get_server(db, server_id, user)
    scan = db.query(ServiceScan).filter(ServiceScan.server_id == server.id).first()
    if not scan:
        return {"services": [], "total": 0, "scanned_at": None, "scanned": False}
    data = json.loads(scan.data)
    return {
        "services": data.get("services", []),
        "total": data.get("total", 0),
        "scanned_at": scan.scanned_at,
        "scanned": True,
    }


@router.post("/{server_id}/services/scan")
async def scan_services(server_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Scan live via SSH puis persiste le résultat."""
    server = _get_server(db, server_id, user)
    result = await _guard(sm.discover_services(server))

    scan = db.query(ServiceScan).filter(ServiceScan.server_id == server.id).first()
    payload = json.dumps(result)
    if scan:
        scan.data = payload
    else:
        scan = ServiceScan(server_id=server.id, data=payload)
        db.add(scan)
    db.commit()
    db.refresh(scan)
    return {
        "services": result.get("services", []),
        "total": result.get("total", 0),
        "scanned_at": scan.scanned_at,
        "scanned": True,
    }


@router.get("/{server_id}/services/{name}")
async def get_service(server_id: int, name: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    server = _get_server(db, server_id, user)
    return await _guard(sm.service_detail(server, name))


@router.post("/{server_id}/services/{name}/action")
async def service_action(
    server_id: int,
    name: str,
    payload: ActionRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    server = _get_server(db, server_id, user)
    return await _guard(sm.run_action(server, name, payload.action))


@router.post("/{server_id}/services/{name}/config")
async def service_deploy_config(
    server_id: int,
    name: str,
    payload: DeployConfigRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    server = _get_server(db, server_id, user)
    return await _guard(sm.deploy_config(server, name, payload.path, payload.content))


@router.post("/{server_id}/services/docker/container")
async def docker_container_action(
    server_id: int,
    payload: ContainerActionRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    server = _get_server(db, server_id, user)
    return await _guard(sm.run_container_action(server, payload.container, payload.action))


@router.post("/{server_id}/services/install")
async def service_install(
    server_id: int,
    payload: InstallRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    server = _get_server(db, server_id, user)
    return await _guard(sm.install_from_catalog(server, payload.service_id))

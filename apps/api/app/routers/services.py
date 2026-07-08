from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.database import get_db
from app.models import Server, User
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
async def list_services(server_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    server = _get_server(db, server_id, user)
    return await _guard(sm.discover_services(server))


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


@router.post("/{server_id}/services/install")
async def service_install(
    server_id: int,
    payload: InstallRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    server = _get_server(db, server_id, user)
    return await _guard(sm.install_from_catalog(server, payload.service_id))

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models import Datacenter, Server
from app.services.cloud.base import CloudInstance, CloudProviderError
from app.services.cloud.credentials import decrypt_credentials, encrypt_credentials
from app.services.cloud.registry import discover_instances
from app.services.cloud.ip_utils import normalize_ip_address
from app.services.crypto import encrypt_pending_ssh


def get_cloud_credentials(dc: Datacenter) -> dict[str, str] | None:
    if not dc.cloud_credentials_encrypted:
        return None
    return decrypt_credentials(dc.cloud_credentials_encrypted)


def save_cloud_credentials(dc: Datacenter, credentials: dict[str, str]) -> None:
    dc.cloud_credentials_encrypted = encrypt_credentials(credentials)
    dc.cloud_connected_at = datetime.now(timezone.utc)


def clear_cloud_credentials(dc: Datacenter) -> None:
    dc.cloud_credentials_encrypted = None
    dc.cloud_connected_at = None


async def test_cloud_connection(provider: str, credentials: dict[str, str]) -> list[CloudInstance]:
    instances = await discover_instances(provider, credentials)
    return instances


async def discover_for_datacenter(dc: Datacenter) -> list[CloudInstance]:
    if dc.type != "cloud" or not dc.provider:
        raise CloudProviderError("Ce datacenter n'est pas de type cloud")
    creds = get_cloud_credentials(dc)
    if not creds:
        raise CloudProviderError("Aucune connexion API configurée pour ce datacenter")
    return await discover_instances(dc.provider, creds)


def _find_existing(
    db: Session,
    owner_id: int,
    datacenter_id: int,
    instance: CloudInstance,
) -> Server | None:
    if instance.external_id:
        match = (
            db.query(Server)
            .filter(
                Server.owner_id == owner_id,
                Server.datacenter_id == datacenter_id,
                Server.external_id == instance.external_id,
            )
            .first()
        )
        if match:
            return match
    return (
        db.query(Server)
        .filter(
            Server.owner_id == owner_id,
            Server.datacenter_id == datacenter_id,
            Server.ip_address == instance.ip_address,
        )
        .first()
    )


def _apply_instance(server: Server, instance: CloudInstance, provider: str) -> None:
    ip = normalize_ip_address(instance.ip_address)
    server.name = instance.name
    server.ip_address = ip
    server.provider = provider
    server.external_id = instance.external_id
    server.instance_type = instance.instance_type
    server.status = instance.status
    server.os_info = instance.os_info
    server.memory_total = instance.memory_total
    server.disk_total = instance.disk_total
    server.cpu_count = instance.cpu_count


async def sync_datacenter_servers(
    db: Session,
    dc: Datacenter,
    owner_id: int,
) -> dict[str, int]:
    instances = await discover_for_datacenter(dc)
    created = 0
    updated = 0

    for instance in instances:
        existing = _find_existing(db, owner_id, dc.id, instance)
        if existing:
            _apply_instance(existing, instance, dc.provider or "Autre")
            updated += 1
        else:
            server = Server(
                name=instance.name,
                ip_address=normalize_ip_address(instance.ip_address),
                provider=dc.provider or "Autre",
                external_id=instance.external_id,
                instance_type=instance.instance_type,
                status=instance.status,
                os_info=instance.os_info,
                memory_total=instance.memory_total,
                disk_total=instance.disk_total,
                cpu_count=instance.cpu_count,
                datacenter_id=dc.id,
                owner_id=owner_id,
                ssh_private_key_encrypted=encrypt_pending_ssh(),
                notes="Importé depuis l'API cloud — ajoutez une clé SSH pour le terminal",
            )
            db.add(server)
            created += 1

    dc.cloud_last_sync_at = datetime.now(timezone.utc)
    db.commit()
    return {"created": created, "updated": updated, "total": len(instances)}

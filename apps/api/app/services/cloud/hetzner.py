import httpx

from app.services.cloud.base import CloudInstance, CloudProviderError


def _map_status(status: str) -> str:
    return "online" if status == "running" else "offline" if status in ("off", "deleting") else "unknown"


async def fetch_instances(credentials: dict[str, str]) -> list[CloudInstance]:
    token = credentials.get("api_token", "").strip()
    if not token:
        raise CloudProviderError("API Token Hetzner requis")

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(
            "https://api.hetzner.cloud/v1/servers",
            headers={"Authorization": f"Bearer {token}"},
        )

    if response.status_code == 401:
        raise CloudProviderError("Token Hetzner invalide")
    if response.status_code >= 400:
        raise CloudProviderError(f"Hetzner API: {response.text[:200]}")

    instances: list[CloudInstance] = []
    for server in response.json().get("servers", []):
        ipv4 = server.get("public_net", {}).get("ipv4", {}).get("ip")
        if not ipv4:
            continue
        server_type = server.get("server_type", {})
        memory_mb = server_type.get("memory", 0)
        instances.append(
            CloudInstance(
                external_id=str(server["id"]),
                name=server.get("name") or ipv4,
                ip_address=ipv4,
                status=_map_status(server.get("status", "unknown")),
                os_info=server.get("image", {}).get("description"),
                memory_total=f"{memory_mb // 1024} GB" if memory_mb >= 1024 else f"{memory_mb} MB",
                disk_total=f"{server_type.get('disk', 0)} GB" if server_type.get("disk") else None,
                cpu_count=server_type.get("cores"),
                instance_type=server_type.get("name"),
            )
        )
    return instances

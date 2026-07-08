import httpx

from app.services.cloud.base import CloudInstance, CloudProviderError


def _map_status(state: str) -> str:
    return "online" if state in ("running", "starting") else "offline" if state in ("stopped", "stopping") else "unknown"


async def fetch_instances(credentials: dict[str, str]) -> list[CloudInstance]:
    access_key = credentials.get("access_key", "").strip()
    secret_key = credentials.get("secret_key", "").strip()
    project_id = credentials.get("project_id", "").strip()
    zone = credentials.get("zone", "fr-par-1").strip() or "fr-par-1"

    if not all([access_key, secret_key, project_id]):
        raise CloudProviderError("Access Key, Secret Key et Project ID Scaleway requis")

    async with httpx.AsyncClient(timeout=30) as client:
        token_resp = await client.post(
            "https://account.scaleway.com/tokens",
            json={"secret_key": secret_key},
            headers={"X-Auth-Access-Key": access_key},
        )
        if token_resp.status_code >= 400:
            raise CloudProviderError("Identifiants Scaleway invalides")

        token = token_resp.json().get("token")
        if not token:
            raise CloudProviderError("Impossible d'obtenir le token Scaleway")

        response = await client.get(
            f"https://api.scaleway.com/instance/v1/zones/{zone}/servers",
            headers={"X-Auth-Token": token},
            params={"project": project_id},
        )

    if response.status_code >= 400:
        raise CloudProviderError(f"Scaleway API: {response.text[:200]}")

    instances: list[CloudInstance] = []
    for server in response.json().get("servers", []):
        public_ip = server.get("public_ip")
        if not public_ip or not public_ip.get("address"):
            continue
        ipv4 = public_ip["address"]
        instances.append(
            CloudInstance(
                external_id=server["id"],
                name=server.get("name") or ipv4,
                ip_address=ipv4,
                status=_map_status(server.get("state", "unknown")),
                os_info=server.get("image", {}).get("name"),
                instance_type=server.get("commercial_type"),
            )
        )
    return instances

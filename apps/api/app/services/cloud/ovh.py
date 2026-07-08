import hashlib
import time

import httpx

from app.services.cloud.base import CloudInstance, CloudProviderError
from app.services.cloud.ip_utils import normalize_ip_address

ENDPOINTS = {
    "ovh-eu": "https://eu.api.ovh.com",
    "ovh-ca": "https://ca.api.ovh.com",
    "ovh-us": "https://api.us.ovhcloud.com",
}

CREATE_TOKEN_URLS = {
    "ovh-eu": "https://eu.api.ovh.com/createToken/",
    "ovh-ca": "https://ca.api.ovh.com/createToken/",
    "ovh-us": "https://api.us.ovhcloud.com/createToken/",
}

OVH_REQUIRED_RIGHTS = """\
Droits API OVH insuffisants. Créez un nouveau Consumer Key sur le portail OVH avec ces droits (lecture seule) :

  GET  /dedicated/server
  GET  /dedicated/server/*
  GET  /vps
  GET  /vps/*

Portail EU : https://eu.api.ovh.com/createToken/
(CA : https://ca.api.ovh.com/createToken/ · US : https://api.us.ovhcloud.com/createToken/)

Validez la demande dans l'e-mail OVH, puis collez le nouveau Consumer Key ici."""


def _forbidden_message(endpoint: str) -> str:
    url = CREATE_TOKEN_URLS.get(endpoint, CREATE_TOKEN_URLS["ovh-eu"])
    return OVH_REQUIRED_RIGHTS.replace(
        "https://eu.api.ovh.com/createToken/",
        url,
    )


def _parse_ovh_error(response: httpx.Response, endpoint: str) -> CloudProviderError:
    if response.status_code == 401:
        return CloudProviderError(
            "Identifiants OVH invalides. Vérifiez Application Key, Application Secret et Consumer Key."
        )
    if response.status_code == 403:
        try:
            body = response.json()
            if body.get("message") == "This call has not been granted":
                return CloudProviderError(_forbidden_message(endpoint))
        except Exception:
            pass
        return CloudProviderError(_forbidden_message(endpoint))
    return CloudProviderError(f"OVH API ({response.status_code}): {response.text[:200]}")


def _sign(method: str, url: str, body: str, timestamp: int, creds: dict[str, str]) -> str:
    app_secret = creds["application_secret"]
    consumer_key = creds["consumer_key"]
    to_sign = f"{app_secret}+{consumer_key}+{method}+{url}+{body}+{timestamp}"
    digest = hashlib.sha1(to_sign.encode()).hexdigest()
    return f"$1${digest}"


async def _ovh_request(method: str, path: str, creds: dict[str, str]) -> httpx.Response:
    endpoint = creds.get("endpoint", "ovh-eu").strip() or "ovh-eu"
    base = ENDPOINTS.get(endpoint)
    if not base:
        raise CloudProviderError(f"Endpoint OVH inconnu: {endpoint}")

    url = f"{base}{path}"
    body = ""
    timestamp = int(time.time())
    headers = {
        "X-Ovh-Application": creds["application_key"],
        "X-Ovh-Consumer": creds["consumer_key"],
        "X-Ovh-Timestamp": str(timestamp),
        "X-Ovh-Signature": _sign(method, url, body, timestamp, creds),
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=30) as client:
        return await client.request(method, url, headers=headers, content=body or None)


async def _fetch_dedicated(creds: dict[str, str]) -> list[CloudInstance]:
    list_resp = await _ovh_request("GET", "/1.0/dedicated/server", creds)
    if list_resp.status_code == 403:
        return []
    if list_resp.status_code == 401:
        raise _parse_ovh_error(list_resp, creds.get("endpoint", "ovh-eu"))
    if list_resp.status_code >= 400:
        raise _parse_ovh_error(list_resp, creds.get("endpoint", "ovh-eu"))

    instances: list[CloudInstance] = []
    for service_name in list_resp.json():
        detail_resp = await _ovh_request("GET", f"/1.0/dedicated/server/{service_name}", creds)
        if detail_resp.status_code >= 400:
            continue
        detail = detail_resp.json()

        ip_resp = await _ovh_request("GET", f"/1.0/dedicated/server/{service_name}/ips", creds)
        ips = ip_resp.json() if ip_resp.status_code < 400 else []
        ipv4 = next((ip for ip in ips if ":" not in ip.split("/")[0]), ips[0] if ips else None)
        if not ipv4:
            continue
        ipv4 = normalize_ip_address(ipv4)

        state = detail.get("state", "unknown")
        status = (
            "online"
            if state in ("ok", "delivered")
            else "offline"
            if state in ("hacked", "hackedBlocked")
            else "unknown"
        )
        memory = detail.get("memorySize")
        instances.append(
            CloudInstance(
                external_id=f"dedicated:{service_name}",
                name=detail.get("reverse") or service_name,
                ip_address=ipv4,
                status=status,
                os_info=detail.get("os"),
                memory_total=f"{memory} MB" if memory else None,
                instance_type=detail.get("commercialRange"),
            )
        )
    return instances


async def _fetch_vps(creds: dict[str, str]) -> list[CloudInstance]:
    list_resp = await _ovh_request("GET", "/1.0/vps", creds)
    if list_resp.status_code in (403, 404):
        return []
    if list_resp.status_code == 401:
        raise _parse_ovh_error(list_resp, creds.get("endpoint", "ovh-eu"))
    if list_resp.status_code >= 400:
        return []

    instances: list[CloudInstance] = []
    for service_name in list_resp.json():
        detail_resp = await _ovh_request("GET", f"/1.0/vps/{service_name}", creds)
        if detail_resp.status_code >= 400:
            continue
        detail = detail_resp.json()

        ip_resp = await _ovh_request("GET", f"/1.0/vps/{service_name}/ips", creds)
        ips = ip_resp.json() if ip_resp.status_code < 400 else []
        ipv4 = next((ip for ip in ips if ":" not in ip.split("/")[0]), ips[0] if ips else None)
        if not ipv4:
            continue
        ipv4 = normalize_ip_address(ipv4)

        state = detail.get("state", "unknown")
        status = "online" if state in ("running", "open") else "offline"
        instances.append(
            CloudInstance(
                external_id=f"vps:{service_name}",
                name=detail.get("displayName") or service_name,
                ip_address=ipv4,
                status=status,
                os_info=detail.get("model", {}).get("name") if isinstance(detail.get("model"), dict) else None,
                instance_type="VPS",
            )
        )
    return instances


async def _validate_access(creds: dict[str, str]) -> None:
    """Ensure credentials work on at least one product API (not /me)."""
    endpoint = creds.get("endpoint", "ovh-eu")
    dedicated_resp = await _ovh_request("GET", "/1.0/dedicated/server", creds)
    vps_resp = await _ovh_request("GET", "/1.0/vps", creds)

    if dedicated_resp.status_code == 401 or vps_resp.status_code == 401:
        raise _parse_ovh_error(
            dedicated_resp if dedicated_resp.status_code == 401 else vps_resp,
            endpoint,
        )

    dedicated_ok = dedicated_resp.status_code == 200
    vps_ok = vps_resp.status_code == 200

    if dedicated_ok or vps_ok:
        return

    if dedicated_resp.status_code == 403 or vps_resp.status_code == 403:
        raise _parse_ovh_error(dedicated_resp if dedicated_resp.status_code == 403 else vps_resp, endpoint)

    raise CloudProviderError(
        f"OVH API inaccessible (dedicated: {dedicated_resp.status_code}, vps: {vps_resp.status_code})"
    )


async def fetch_instances(credentials: dict[str, str]) -> list[CloudInstance]:
    required = ("application_key", "application_secret", "consumer_key")
    for key in required:
        if not credentials.get(key, "").strip():
            raise CloudProviderError(f"Champ OVH requis: {key}")

    creds = {**credentials, "endpoint": credentials.get("endpoint", "ovh-eu")}

    await _validate_access(creds)

    dedicated = await _fetch_dedicated(creds)
    vps = await _fetch_vps(creds)
    instances = dedicated + vps

    if not instances and not dedicated and not vps:
        # Both returned 403 empty - already caught by validate
        pass

    return instances

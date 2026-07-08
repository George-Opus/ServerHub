from collections.abc import Awaitable, Callable

from app.services.cloud.base import CloudInstance, CloudProviderError
from app.services.cloud.hetzner import fetch_instances as hetzner_fetch
from app.services.cloud.ovh import fetch_instances as ovh_fetch
from app.services.cloud.scaleway import fetch_instances as scaleway_fetch

Fetcher = Callable[[dict[str, str]], Awaitable[list[CloudInstance]]]

_FETCHERS: dict[str, Fetcher] = {
    "OVH": ovh_fetch,
    "Hetzner": hetzner_fetch,
    "Scaleway": scaleway_fetch,
}


async def discover_instances(provider: str, credentials: dict[str, str]) -> list[CloudInstance]:
    fetcher = _FETCHERS.get(provider)
    if not fetcher:
        raise CloudProviderError(f"Synchronisation API non disponible pour {provider}")
    return await fetcher(credentials)

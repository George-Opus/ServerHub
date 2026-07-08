from dataclasses import dataclass


@dataclass
class CloudInstance:
    external_id: str
    name: str
    ip_address: str
    status: str
    os_info: str | None = None
    memory_total: str | None = None
    disk_total: str | None = None
    cpu_count: int | None = None
    instance_type: str | None = None


class CloudProviderError(Exception):
    pass

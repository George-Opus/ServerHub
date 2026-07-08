from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, model_validator


class UserCreate(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=8, max_length=128)


class UserLogin(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    id: int
    email: EmailStr
    username: str
    created_at: datetime

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class RegistrationStatus(BaseModel):
    enabled: bool
    bootstrap: bool


class ServerCreate(BaseModel):
    ip_address: str = Field(min_length=7, max_length=45)
    provider: str = Field(min_length=1, max_length=100)
    auth_type: str = Field(default="key", pattern="^(key|password)$")
    ssh_port: int = Field(default=22, ge=1, le=65535)
    ssh_username: str = Field(default="root", min_length=1, max_length=100)
    ssh_private_key: str | None = None
    ssh_key_passphrase: str | None = None
    ssh_password: str | None = None
    ssh_key_profile_id: int | None = None
    password_profile_id: int | None = None
    notes: str | None = None
    datacenter_id: int | None = None
    rack_id: int | None = None
    rack_u: int | None = Field(default=None, ge=1, le=52)
    rack_units: int = Field(default=1, ge=1, le=52)


class ServerUpdate(BaseModel):
    name: str | None = None
    ip_address: str | None = None
    provider: str | None = None
    auth_type: str | None = Field(default=None, pattern="^(key|password)$")
    ssh_port: int | None = Field(default=None, ge=1, le=65535)
    ssh_username: str | None = None
    ssh_private_key: str | None = None
    ssh_key_passphrase: str | None = None
    ssh_password: str | None = None
    ssh_key_profile_id: int | None = None
    password_profile_id: int | None = None
    notes: str | None = None
    datacenter_id: int | None = None
    rack_id: int | None = None
    rack_u: int | None = Field(default=None, ge=1, le=52)
    rack_units: int | None = Field(default=None, ge=1, le=52)


class ServerOut(BaseModel):
    id: int
    name: str
    ip_address: str
    provider: str
    auth_type: str = "key"
    ssh_port: int
    ssh_username: str
    hostname: str | None
    os_info: str | None
    memory_total: str | None
    disk_total: str | None
    cpu_count: int | None
    status: str
    last_sync_at: datetime | None
    notes: str | None
    datacenter_id: int | None
    rack_id: int | None
    rack_u: int | None
    rack_units: int = 1
    external_id: str | None = None
    instance_type: str | None = None
    ssh_key_profile_id: int | None = None
    password_profile_id: int | None = None
    has_ssh_key: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @model_validator(mode="wrap")
    @classmethod
    def _with_ssh_flag(cls, value, handler):
        from app.services.server_credentials import has_server_auth

        if hasattr(value, "ssh_private_key_encrypted"):
            result = handler(value)
            return result.model_copy(update={"has_ssh_key": has_server_auth(value)})
        return handler(value)


class ServerSyncResult(BaseModel):
    server: ServerOut
    message: str


class DatacenterCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    type: str = Field(pattern="^(cloud|custom)$")
    provider: str | None = None
    location: str | None = None
    description: str | None = None


class DatacenterUpdate(BaseModel):
    name: str | None = None
    provider: str | None = None
    location: str | None = None
    description: str | None = None


class DatacenterOut(BaseModel):
    id: int
    name: str
    type: str
    provider: str | None
    location: str | None
    description: str | None
    cloud_connected: bool = False
    cloud_last_sync_at: datetime | None = None
    cloud_sync_supported: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_datacenter(cls, dc) -> "DatacenterOut":
        from app.services.cloud.credentials import PROVIDER_CREDENTIAL_FIELDS

        supported = dc.provider in PROVIDER_CREDENTIAL_FIELDS if dc.provider else False
        return cls.model_validate(dc).model_copy(
            update={
                "cloud_connected": bool(dc.cloud_credentials_encrypted),
                "cloud_sync_supported": supported,
            }
        )


class CloudCredentialField(BaseModel):
    key: str
    label: str
    type: str = "text"
    placeholder: str | None = None


class CloudConnectionOut(BaseModel):
    connected: bool
    provider: str | None
    last_sync_at: datetime | None
    sync_supported: bool
    credential_fields: list[CloudCredentialField] = []


class CloudConnectionSet(BaseModel):
    credentials: dict[str, str]


class CloudInstanceOut(BaseModel):
    external_id: str
    name: str
    ip_address: str
    status: str
    os_info: str | None = None
    memory_total: str | None = None
    disk_total: str | None = None
    cpu_count: int | None = None
    instance_type: str | None = None
    already_imported: bool = False


class CloudDiscoverOut(BaseModel):
    instances: list[CloudInstanceOut]
    total: int


class CloudSyncResult(BaseModel):
    created: int
    updated: int
    total: int
    message: str


class RackCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    position: int = Field(default=0, ge=0)
    capacity_u: int = Field(default=42, ge=1, le=52)


class RackUpdate(BaseModel):
    name: str | None = None
    position: int | None = Field(default=None, ge=0)
    capacity_u: int | None = Field(default=None, ge=1, le=52)


class RackOut(BaseModel):
    id: int
    datacenter_id: int
    name: str
    position: int
    capacity_u: int
    created_at: datetime

    model_config = {"from_attributes": True}


class RackWithServers(RackOut):
    servers: list[ServerOut] = []


class DatacenterInventory(DatacenterOut):
    racks: list[RackWithServers] = []
    servers: list[ServerOut] = []


class InventoryOut(BaseModel):
    datacenters: list[DatacenterInventory]
    unassigned_servers: list[ServerOut]


class SshKeyProfileCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    private_key: str = Field(min_length=1)
    passphrase: str | None = None
    is_default: bool = False


class SshKeyProfileUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    private_key: str | None = None
    passphrase: str | None = None


class SshKeyProfileOut(BaseModel):
    id: int
    name: str
    is_default: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PasswordProfileCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1)
    is_default: bool = False


class PasswordProfileUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    username: str | None = Field(default=None, min_length=1, max_length=100)
    password: str | None = None


class PasswordProfileOut(BaseModel):
    id: int
    name: str
    username: str
    is_default: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

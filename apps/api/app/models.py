from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Datacenter(Base):
    __tablename__ = "datacenters"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    type: Mapped[str] = mapped_column(String(20))  # cloud | custom
    provider: Mapped[str | None] = mapped_column(String(100), nullable=True)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    cloud_credentials_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    cloud_connected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cloud_last_sync_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    owner = relationship("User")
    racks = relationship("Rack", back_populates="datacenter", cascade="all, delete-orphan")
    servers = relationship("Server", back_populates="datacenter")


class Rack(Base):
    __tablename__ = "racks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    datacenter_id: Mapped[int] = mapped_column(ForeignKey("datacenters.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(100))
    position: Mapped[int] = mapped_column(Integer, default=0)
    capacity_u: Mapped[int] = mapped_column(Integer, default=42)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    datacenter = relationship("Datacenter", back_populates="racks")
    servers = relationship("Server", back_populates="rack")


class SshKeyProfile(Base):
    __tablename__ = "ssh_key_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    private_key_encrypted: Mapped[str] = mapped_column(Text)
    passphrase_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_default: Mapped[bool] = mapped_column(default=False)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    owner = relationship("User")


class PasswordProfile(Base):
    __tablename__ = "password_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    username: Mapped[str] = mapped_column(String(100))
    password_encrypted: Mapped[str] = mapped_column(Text)
    is_default: Mapped[bool] = mapped_column(default=False)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    owner = relationship("User")


class Server(Base):
    __tablename__ = "servers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    ip_address: Mapped[str] = mapped_column(String(45), index=True)
    provider: Mapped[str] = mapped_column(String(100))
    auth_type: Mapped[str] = mapped_column(String(20), default="key")
    ssh_port: Mapped[int] = mapped_column(Integer, default=22)
    ssh_username: Mapped[str] = mapped_column(String(100), default="root")
    ssh_private_key_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    ssh_key_passphrase_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    ssh_password_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    ssh_key_profile_id: Mapped[int | None] = mapped_column(
        ForeignKey("ssh_key_profiles.id", ondelete="SET NULL"), nullable=True
    )
    password_profile_id: Mapped[int | None] = mapped_column(
        ForeignKey("password_profiles.id", ondelete="SET NULL"), nullable=True
    )
    external_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    instance_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    hostname: Mapped[str | None] = mapped_column(String(255), nullable=True)
    os_info: Mapped[str | None] = mapped_column(String(255), nullable=True)
    memory_total: Mapped[str | None] = mapped_column(String(50), nullable=True)
    disk_total: Mapped[str | None] = mapped_column(String(50), nullable=True)
    cpu_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="unknown")
    last_sync_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    datacenter_id: Mapped[int | None] = mapped_column(ForeignKey("datacenters.id", ondelete="SET NULL"), nullable=True)
    rack_id: Mapped[int | None] = mapped_column(ForeignKey("racks.id", ondelete="SET NULL"), nullable=True)
    rack_u: Mapped[int | None] = mapped_column(Integer, nullable=True)
    rack_units: Mapped[int] = mapped_column(Integer, default=1)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    owner = relationship("User")
    datacenter = relationship("Datacenter", back_populates="servers")
    rack = relationship("Rack", back_populates="servers")


class ServiceScan(Base):
    """Dernier résultat de scan des services d'un serveur (persisté)."""

    __tablename__ = "service_scans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    server_id: Mapped[int] = mapped_column(
        ForeignKey("servers.id", ondelete="CASCADE"), unique=True, index=True
    )
    data: Mapped[str] = mapped_column(Text)  # JSON: {"services": [...], "total": n}
    scanned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

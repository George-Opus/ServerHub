from sqlalchemy import inspect, text

from app.database import engine


def run_migrations() -> None:
    inspector = inspect(engine)
    tables = inspector.get_table_names()

    if "servers" in tables:
        columns = {col["name"] for col in inspector.get_columns("servers")}
        with engine.begin() as conn:
            if "ssh_key_passphrase_encrypted" not in columns:
                conn.execute(text("ALTER TABLE servers ADD COLUMN ssh_key_passphrase_encrypted TEXT"))
            if "datacenter_id" not in columns:
                conn.execute(text("ALTER TABLE servers ADD COLUMN datacenter_id INTEGER"))
            if "rack_id" not in columns:
                conn.execute(text("ALTER TABLE servers ADD COLUMN rack_id INTEGER"))
            if "rack_u" not in columns:
                conn.execute(text("ALTER TABLE servers ADD COLUMN rack_u INTEGER"))
            if "rack_units" not in columns:
                conn.execute(text("ALTER TABLE servers ADD COLUMN rack_units INTEGER DEFAULT 1"))
            if "external_id" not in columns:
                conn.execute(text("ALTER TABLE servers ADD COLUMN external_id VARCHAR(255)"))
            if "instance_type" not in columns:
                conn.execute(text("ALTER TABLE servers ADD COLUMN instance_type VARCHAR(100)"))
            if "auth_type" not in columns:
                conn.execute(text("ALTER TABLE servers ADD COLUMN auth_type VARCHAR(20) DEFAULT 'key'"))
            if "ssh_password_encrypted" not in columns:
                conn.execute(text("ALTER TABLE servers ADD COLUMN ssh_password_encrypted TEXT"))
            if "ssh_key_profile_id" not in columns:
                conn.execute(text("ALTER TABLE servers ADD COLUMN ssh_key_profile_id INTEGER"))
            if "password_profile_id" not in columns:
                conn.execute(text("ALTER TABLE servers ADD COLUMN password_profile_id INTEGER"))

    if "datacenters" in tables:
        dc_columns = {col["name"] for col in inspector.get_columns("datacenters")}
        with engine.begin() as conn:
            if "cloud_credentials_encrypted" not in dc_columns:
                conn.execute(text("ALTER TABLE datacenters ADD COLUMN cloud_credentials_encrypted TEXT"))
            if "cloud_connected_at" not in dc_columns:
                conn.execute(text("ALTER TABLE datacenters ADD COLUMN cloud_connected_at DATETIME"))
            if "cloud_last_sync_at" not in dc_columns:
                conn.execute(text("ALTER TABLE datacenters ADD COLUMN cloud_last_sync_at DATETIME"))

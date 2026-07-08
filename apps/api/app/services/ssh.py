from dataclasses import dataclass

import asyncssh

from app.services.server_credentials import ServerAuth


@dataclass
class ServerInfo:
    hostname: str
    os_info: str
    memory_total: str
    disk_total: str
    cpu_count: int
    status: str = "online"


def load_client_key(private_key: str, passphrase: str | None = None):
    return asyncssh.import_private_key(
        private_key,
        passphrase=passphrase if passphrase else None,
    )


def _connect_kwargs(auth: ServerAuth, host: str, port: int) -> dict:
    kwargs: dict = {
        "host": host,
        "port": port,
        "username": auth.username,
        "known_hosts": None,
        "connect_timeout": 15,
    }
    if auth.auth_type == "password":
        kwargs["password"] = auth.password
    else:
        kwargs["client_keys"] = [load_client_key(auth.private_key or "", auth.passphrase)]
    return kwargs


async def fetch_server_info(host: str, port: int, auth: ServerAuth) -> ServerInfo:
    try:
        async with asyncssh.connect(**_connect_kwargs(auth, host, port)) as conn:
            hostname = (await conn.run("hostname", check=False)).stdout.strip() or host

            os_result = await conn.run(
                "cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d= -f2 | tr -d '\"'",
                check=False,
            )
            os_info = os_result.stdout.strip()
            if not os_info:
                uname = await conn.run("uname -sr", check=False)
                os_info = uname.stdout.strip() or "Unknown OS"

            mem_result = await conn.run(
                "free -h 2>/dev/null | awk '/^Mem:/ {print $2}'",
                check=False,
            )
            memory_total = mem_result.stdout.strip()
            if not memory_total:
                mem_result = await conn.run(
                    "awk '/MemTotal/ {printf \"%.1f GB\", $2/1024/1024}' /proc/meminfo",
                    check=False,
                )
                memory_total = mem_result.stdout.strip() or "N/A"

            disk_result = await conn.run(
                "df -h / 2>/dev/null | awk 'NR==2 {print $2 \" (\" $5 \" used)\"}'",
                check=False,
            )
            disk_total = disk_result.stdout.strip() or "N/A"

            cpu_result = await conn.run("nproc 2>/dev/null || grep -c ^processor /proc/cpuinfo", check=False)
            cpu_count = int(cpu_result.stdout.strip() or "0")

            return ServerInfo(
                hostname=hostname,
                os_info=os_info,
                memory_total=memory_total,
                disk_total=disk_total,
                cpu_count=cpu_count,
                status="online",
            )
    except Exception as exc:
        raise ConnectionError(str(exc)) from exc


async def open_ssh_connection(host: str, port: int, auth: ServerAuth) -> asyncssh.SSHClientConnection:
    return await asyncssh.connect(**_connect_kwargs(auth, host, port))


# Legacy helpers
async def fetch_server_info_key(
    host: str,
    port: int,
    username: str,
    private_key: str,
    passphrase: str | None = None,
) -> ServerInfo:
    return await fetch_server_info(
        host,
        port,
        ServerAuth(auth_type="key", username=username, private_key=private_key, passphrase=passphrase),
    )


async def open_ssh_connection_key(
    host: str,
    port: int,
    username: str,
    private_key: str,
    passphrase: str | None = None,
) -> asyncssh.SSHClientConnection:
    return await open_ssh_connection(
        host,
        port,
        ServerAuth(auth_type="key", username=username, private_key=private_key, passphrase=passphrase),
    )

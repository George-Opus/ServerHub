"""Découverte et gestion des services (systemd) sur les serveurs distants via SSH.

Toutes les commandes sont exécutées sans shell utilisateur interactif ; les noms de
services sont validés avant toute interpolation pour éviter les injections.
"""

import re
from contextlib import asynccontextmanager

import asyncssh

from app.models import Server
from app.services.server_credentials import get_server_auth
from app.services.ssh import open_ssh_connection

SERVICE_NAME_RE = re.compile(r"^[A-Za-z0-9._@-]+$")
ALLOWED_ACTIONS = {"start", "stop", "restart", "reload"}

# Unités systemd « par défaut » masquées de la découverte.
_DEFAULT_UNITS = {
    "accounts-daemon", "cron", "crond", "dbus", "dbus-broker", "getty", "haveged",
    "irqbalance", "polkit", "rsyslog", "ssh", "sshd", "systemd-journald",
    "systemd-logind", "systemd-networkd", "systemd-resolved", "systemd-timesyncd",
    "systemd-udevd", "unattended-upgrades", "networkd-dispatcher", "multipathd",
    "packagekit", "udisks2", "wpa_supplicant", "modemmanager", "chrony", "chronyd",
    "ntp", "ntpd", "atd", "auditd", "qemu-guest-agent", "cloud-init", "cloud-config",
    "cloud-final", "snapd", "thermald", "uuidd", "rpcbind", "gdm", "lightdm",
}
_DEFAULT_PREFIXES = (
    "systemd-", "user@", "user-", "getty@", "serial-getty", "session-",
    "run-", "dev-", "sys-", "blk-", "-.", "modprobe@", "cloud-",
)

# Détection des services « intéressants » et de leur configuration.
KNOWN_SERVICES: dict[str, dict] = {
    "nginx": {"label": "Nginx", "kind": "web", "config": "nginx"},
    "apache2": {"label": "Apache", "kind": "web", "config": "apache"},
    "httpd": {"label": "Apache", "kind": "web", "config": "apache"},
    "haproxy": {"label": "HAProxy", "kind": "proxy", "config": "haproxy"},
    "traefik": {"label": "Traefik", "kind": "proxy", "config": "generic"},
    "caddy": {"label": "Caddy", "kind": "web", "config": "generic"},
    "docker": {"label": "Docker", "kind": "container", "config": "docker"},
    "containerd": {"label": "containerd", "kind": "container", "config": "generic"},
    "kubelet": {"label": "Kubelet", "kind": "orchestration", "config": "generic"},
    "k3s": {"label": "k3s", "kind": "orchestration", "config": "generic"},
    "mysql": {"label": "MySQL", "kind": "database", "config": "generic"},
    "mariadb": {"label": "MariaDB", "kind": "database", "config": "generic"},
    "postgresql": {"label": "PostgreSQL", "kind": "database", "config": "generic"},
    "redis-server": {"label": "Redis", "kind": "database", "config": "generic"},
    "redis": {"label": "Redis", "kind": "database", "config": "generic"},
    "mongod": {"label": "MongoDB", "kind": "database", "config": "generic"},
    "rabbitmq-server": {"label": "RabbitMQ", "kind": "queue", "config": "generic"},
    "elasticsearch": {"label": "Elasticsearch", "kind": "database", "config": "generic"},
    "php-fpm": {"label": "PHP-FPM", "kind": "runtime", "config": "generic"},
    "fail2ban": {"label": "Fail2ban", "kind": "security", "config": "generic"},
    "prometheus": {"label": "Prometheus", "kind": "monitoring", "config": "generic"},
    "grafana-server": {"label": "Grafana", "kind": "monitoring", "config": "generic"},
}


class ServiceError(Exception):
    pass


def validate_service_name(name: str) -> str:
    name = (name or "").strip()
    if not SERVICE_NAME_RE.match(name):
        raise ServiceError("Nom de service invalide.")
    return name


@asynccontextmanager
async def _session(server: Server):
    auth = get_server_auth(server)
    conn = await open_ssh_connection(host=server.ip_address, port=server.ssh_port, auth=auth)
    try:
        whoami = (await conn.run("id -u", check=False)).stdout.strip()
        sudo = "" if whoami == "0" else "sudo -n "
        yield conn, sudo
    finally:
        conn.close()


async def _run(conn: asyncssh.SSHClientConnection, cmd: str, timeout: int = 25) -> str:
    res = await conn.run(cmd, check=False, timeout=timeout)
    return ((res.stdout or "") + (res.stderr or "")).strip()


def _base_name(unit: str) -> str:
    n = unit.strip()
    if n.endswith(".service"):
        n = n[: -len(".service")]
    return n


def _is_default(name: str) -> bool:
    if name in _DEFAULT_UNITS:
        return True
    return any(name.startswith(p) for p in _DEFAULT_PREFIXES)


def _match_known(name: str) -> dict | None:
    if name in KNOWN_SERVICES:
        return KNOWN_SERVICES[name]
    # ex. redis-server@0, php8.2-fpm, postgresql@15-main
    for key, meta in KNOWN_SERVICES.items():
        base = key.replace("-server", "")
        if name.startswith(key) or name.startswith(base) or base in name:
            return meta
    if "php" in name and "fpm" in name:
        return {"label": "PHP-FPM", "kind": "runtime", "config": "generic"}
    return None


async def _listening_ports(conn: asyncssh.SSHClientConnection, sudo: str) -> dict[str, list[int]]:
    """Retourne process_name -> [ports en écoute]."""
    out = await _run(conn, f"{sudo}ss -tlnpH 2>/dev/null || ss -tlnH 2>/dev/null")
    result: dict[str, list[int]] = {}
    for line in out.splitlines():
        parts = line.split()
        if len(parts) < 4:
            continue
        local = parts[3]
        m = re.search(r":(\d+)$", local)
        if not m:
            continue
        port = int(m.group(1))
        procs = re.findall(r'"([^"]+)"', line)
        for proc in procs:
            result.setdefault(proc, [])
            if port not in result[proc]:
                result[proc].append(port)
    return result


async def discover_services(server: Server) -> dict:
    async with _session(server) as (conn, sudo):
        # --all : inclut aussi les services arrêtés / échoués (pas seulement running)
        raw = await _run(
            conn,
            "systemctl list-units --type=service --all --no-pager --no-legend --plain 2>/dev/null",
        )
        ports_by_proc = await _listening_ports(conn, sudo)

        services = []
        for line in raw.splitlines():
            parts = line.split(None, 4)
            if len(parts) < 4:
                continue
            unit = parts[0]
            load = parts[1]
            active = parts[2]
            sub = parts[3]
            description = parts[4] if len(parts) > 4 else ""
            # On ignore les unités non chargées (not-found / masked)
            if load != "loaded":
                continue
            name = _base_name(unit)
            if _is_default(name):
                continue
            # On masque le bruit inactif inconnu ; on garde tout ce qui est connu,
            # actif, en échec, ou activable.
            known_here = _match_known(name)
            if known_here is None and active == "inactive" and sub in ("dead", "exited"):
                continue
            known = _match_known(name)
            # ports : cherche un process correspondant
            ports: list[int] = []
            short = name.split("@")[0].split(".")[0]
            for proc, pl in ports_by_proc.items():
                if proc == short or proc.startswith(short) or short.startswith(proc):
                    ports.extend(pl)
            ports = sorted(set(ports))
            services.append(
                {
                    "name": name,
                    "unit": unit,
                    "active": active,
                    "sub": sub,
                    "description": description,
                    "type": known["label"] if known else None,
                    "kind": known["kind"] if known else "other",
                    "config_kind": known["config"] if known else None,
                    "ports": ports,
                }
            )
        services.sort(key=lambda s: (s["type"] is None, s["name"]))
        return {"services": services, "total": len(services)}


async def service_detail(server: Server, name: str) -> dict:
    name = validate_service_name(name)
    async with _session(server) as (conn, sudo):
        status = await _run(conn, f"systemctl status {name} --no-pager -l 2>&1 | head -n 25")
        enabled = await _run(conn, f"systemctl is-enabled {name} 2>/dev/null")
        active = await _run(conn, f"systemctl is-active {name} 2>/dev/null")
        known = _match_known(name)
        config_kind = known["config"] if known else "generic"
        config = await _extract_config(conn, sudo, name, config_kind)
        return {
            "name": name,
            "active": active,
            "enabled": enabled,
            "status": status,
            "type": known["label"] if known else None,
            "kind": known["kind"] if known else "other",
            "config_kind": config_kind,
            "config": config,
        }


async def _extract_config(conn, sudo: str, name: str, kind: str) -> dict:
    if kind == "nginx":
        return await _config_nginx(conn, sudo)
    if kind == "haproxy":
        return await _config_haproxy(conn, sudo)
    if kind == "docker":
        return await _config_docker(conn, sudo)
    if kind == "apache":
        return await _config_apache(conn, sudo)
    return await _config_generic(conn, sudo, name)


async def _config_nginx(conn, sudo: str) -> dict:
    dump = await _run(conn, f"{sudo}nginx -T 2>/dev/null")
    files = re.findall(r"# configuration file (\S+)", dump)
    server_names: list[str] = []
    for m in re.findall(r"server_name\s+([^;]+);", dump):
        server_names.extend(x for x in m.split() if x not in ("_",))
    listens = sorted(set(re.findall(r"listen\s+([^;]+);", dump)))
    proxies = sorted(set(re.findall(r"proxy_pass\s+([^;]+);", dump)))
    roots = sorted(set(re.findall(r"root\s+([^;]+);", dump)))
    return {
        "summary": {
            "server_names": sorted(set(server_names)),
            "listens": listens,
            "proxy_pass": proxies,
            "roots": roots,
        },
        "files": sorted(set(files)),
        "raw": dump[:20000],
        "editable_path": "/etc/nginx/conf.d/serverhub.conf",
        "test_cmd": "nginx -t",
    }


async def _config_haproxy(conn, sudo: str) -> dict:
    cfg = await _run(conn, f"{sudo}cat /etc/haproxy/haproxy.cfg 2>/dev/null")
    frontends = re.findall(r"^\s*frontend\s+(\S+)", cfg, re.MULTILINE)
    backends = re.findall(r"^\s*backend\s+(\S+)", cfg, re.MULTILINE)
    binds = re.findall(r"^\s*bind\s+(\S+)", cfg, re.MULTILINE)
    servers = re.findall(r"^\s*server\s+\S+\s+(\S+)", cfg, re.MULTILINE)
    return {
        "summary": {
            "frontends": frontends,
            "backends": backends,
            "binds": binds,
            "servers": servers,
        },
        "files": ["/etc/haproxy/haproxy.cfg"],
        "raw": cfg[:20000],
        "editable_path": "/etc/haproxy/haproxy.cfg",
        "test_cmd": "haproxy -c -f /etc/haproxy/haproxy.cfg",
    }


async def _config_docker(conn, sudo: str) -> dict:
    # -a : inclut les conteneurs arrêtés pour pouvoir les (re)démarrer
    ps = await _run(
        conn,
        f'{sudo}docker ps -a --format "{{{{.Names}}}}\t{{{{.Image}}}}\t{{{{.State}}}}\t{{{{.Status}}}}\t{{{{.Ports}}}}" 2>/dev/null',
    )
    containers = []
    for line in ps.splitlines():
        cols = line.split("\t")
        if len(cols) >= 4:
            containers.append(
                {
                    "name": cols[0],
                    "image": cols[1],
                    "state": cols[2],
                    "status": cols[3],
                    "ports": cols[4] if len(cols) > 4 else "",
                }
            )
    return {"containers": containers, "files": ["/etc/docker/daemon.json"], "raw": ps[:20000]}


CONTAINER_NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$")
CONTAINER_ACTIONS = {"start", "stop", "restart"}


async def run_container_action(server: Server, container: str, action: str) -> dict:
    container = (container or "").strip()
    if not CONTAINER_NAME_RE.match(container):
        raise ServiceError("Nom de conteneur invalide.")
    if action not in CONTAINER_ACTIONS:
        raise ServiceError("Action conteneur non autorisée.")
    async with _session(server) as (conn, sudo):
        out = await _run(conn, f"{sudo}docker {action} {container} 2>&1", timeout=60)
        state = await _run(
            conn,
            f'{sudo}docker inspect -f "{{{{.State.Status}}}}" {container} 2>/dev/null',
        )
        return {"container": container, "action": action, "state": state, "output": out or "(ok)"}


async def _config_apache(conn, sudo: str) -> dict:
    vhosts = await _run(conn, f"{sudo}apache2ctl -S 2>/dev/null || {sudo}apachectl -S 2>/dev/null || {sudo}httpd -S 2>/dev/null")
    return {"summary": {"vhosts_raw": vhosts}, "files": ["/etc/apache2/sites-enabled/"], "raw": vhosts[:20000]}


async def _config_generic(conn, sudo: str, name: str) -> dict:
    unit = await _run(conn, f"systemctl cat {name} 2>/dev/null | head -n 40")
    frag = await _run(conn, f"systemctl show {name} -p FragmentPath --value 2>/dev/null")
    return {"summary": {"fragment_path": frag}, "files": [f for f in [frag] if f], "raw": unit[:20000]}


async def run_action(server: Server, name: str, action: str) -> dict:
    name = validate_service_name(name)
    if action not in ALLOWED_ACTIONS:
        raise ServiceError("Action non autorisée.")
    async with _session(server) as (conn, sudo):
        out = await _run(conn, f"{sudo}systemctl {action} {name} 2>&1")
        active = await _run(conn, f"systemctl is-active {name} 2>/dev/null")
        return {"name": name, "action": action, "active": active, "output": out or "(ok)"}


async def deploy_config(server: Server, name: str, path: str, content: str) -> dict:
    """Écrit un fichier de configuration (via SFTP), valide puis recharge le service."""
    name = validate_service_name(name)
    path = (path or "").strip()
    if not path.startswith("/etc/") or ".." in path:
        raise ServiceError("Le chemin doit être sous /etc/ et sans '..'.")
    known = _match_known(name)
    config_kind = known["config"] if known else "generic"
    test_cmd = {
        "nginx": "nginx -t",
        "haproxy": "haproxy -c -f /etc/haproxy/haproxy.cfg",
    }.get(config_kind)

    async with _session(server) as (conn, sudo):
        backup = f"{path}.serverhub.bak"
        await _run(conn, f"{sudo}test -f {path} && {sudo}cp {path} {backup} || true")
        # Écriture atomique via tee (préserve les droits root grâce à sudo)
        async with conn.create_process(f"{sudo}tee {path} > /dev/null") as proc:
            proc.stdin.write(content)
            proc.stdin.write_eof()
            await proc.wait()

        test_output = ""
        if test_cmd:
            test_output = await _run(conn, f"{sudo}{test_cmd} 2>&1")
            ok = "syntax is ok" in test_output.lower() or "configuration file is valid" in test_output.lower() or "Configuration file is valid" in test_output
            if not ok and ("fail" in test_output.lower() or "error" in test_output.lower() or "invalid" in test_output.lower()):
                await _run(conn, f"{sudo}test -f {backup} && {sudo}cp {backup} {path} || true")
                raise ServiceError(f"Validation échouée, configuration restaurée :\n{test_output}")

        reload_out = await _run(conn, f"{sudo}systemctl reload {name} 2>&1 || {sudo}systemctl restart {name} 2>&1")
        active = await _run(conn, f"systemctl is-active {name} 2>/dev/null")
        return {
            "name": name,
            "path": path,
            "test_output": test_output,
            "reload_output": reload_out or "(ok)",
            "active": active,
        }


# ---------------------------------------------------------------------------
# Catalogue de services installables (Debian/Ubuntu — apt / script officiel)
# ---------------------------------------------------------------------------
SERVICE_CATALOG: list[dict] = [
    {
        "id": "nginx",
        "label": "Nginx",
        "kind": "web",
        "description": "Serveur web / reverse proxy haute performance.",
        "check": "command -v nginx",
        "install": "apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y nginx && systemctl enable --now nginx",
    },
    {
        "id": "haproxy",
        "label": "HAProxy",
        "kind": "proxy",
        "description": "Répartiteur de charge TCP/HTTP.",
        "check": "command -v haproxy",
        "install": "apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y haproxy && systemctl enable --now haproxy",
    },
    {
        "id": "docker",
        "label": "Docker",
        "kind": "container",
        "description": "Moteur de conteneurs (script officiel get.docker.com).",
        "check": "command -v docker",
        "install": "curl -fsSL https://get.docker.com | sh && systemctl enable --now docker",
    },
    {
        "id": "redis",
        "label": "Redis",
        "kind": "database",
        "description": "Base de données clé-valeur en mémoire.",
        "check": "command -v redis-server",
        "install": "apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y redis-server && systemctl enable --now redis-server",
    },
    {
        "id": "postgresql",
        "label": "PostgreSQL",
        "kind": "database",
        "description": "Base de données relationnelle.",
        "check": "command -v psql",
        "install": "apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y postgresql && systemctl enable --now postgresql",
    },
    {
        "id": "fail2ban",
        "label": "Fail2ban",
        "kind": "security",
        "description": "Protection contre les attaques par force brute.",
        "check": "command -v fail2ban-client",
        "install": "apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y fail2ban && systemctl enable --now fail2ban",
    },
]

_CATALOG_BY_ID = {item["id"]: item for item in SERVICE_CATALOG}


async def install_from_catalog(server: Server, service_id: str) -> dict:
    item = _CATALOG_BY_ID.get(service_id)
    if not item:
        raise ServiceError("Service inconnu dans le catalogue.")
    async with _session(server) as (conn, sudo):
        already = await _run(conn, f"{item['check']} 2>/dev/null && echo __PRESENT__")
        if "__PRESENT__" in already:
            return {"id": service_id, "already_installed": True, "output": "Déjà installé."}
        out = await _run(conn, f"{sudo}sh -c {_shq(item['install'])} 2>&1", timeout=300)
        return {"id": service_id, "already_installed": False, "output": out or "(ok)"}


def _shq(s: str) -> str:
    # Quote pour passage en argument unique à sh -c (les commandes viennent du catalogue statique).
    return "'" + s.replace("'", "'\\''") + "'"

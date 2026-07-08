import ipaddress


def normalize_ip_address(address: str) -> str:
    """Return host IP without CIDR suffix (e.g. 203.0.113.1/32 → 203.0.113.1)."""
    raw = address.strip()
    if not raw:
        return raw
    try:
        if "/" in raw:
            return str(ipaddress.ip_interface(raw).ip)
        return str(ipaddress.ip_address(raw))
    except ValueError:
        if "/" in raw:
            return raw.split("/")[0].strip()
        return raw

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import Datacenter, Rack, Server

PROVIDERS = ["OVH", "Scaleway", "PulseHeberg", "Hetzner", "AWS", "GCP", "Azure", "Autre"]


def get_owned_datacenter(db: Session, datacenter_id: int, owner_id: int) -> Datacenter:
    dc = db.query(Datacenter).filter(Datacenter.id == datacenter_id, Datacenter.owner_id == owner_id).first()
    if not dc:
        raise HTTPException(status_code=404, detail="Datacenter not found")
    return dc


def get_owned_rack(db: Session, rack_id: int, owner_id: int) -> Rack:
    rack = (
        db.query(Rack)
        .join(Datacenter, Rack.datacenter_id == Datacenter.id)
        .filter(Rack.id == rack_id, Datacenter.owner_id == owner_id)
        .first()
    )
    if not rack:
        raise HTTPException(status_code=404, detail="Rack not found")
    return rack


def occupied_u_slots(server: Server) -> set[int]:
    if not server.rack_u:
        return set()
    units = max(1, server.rack_units or 1)
    return set(range(server.rack_u, server.rack_u + units))


def validate_server_placement(
    db: Session,
    owner_id: int,
    datacenter_id: int | None,
    rack_id: int | None,
    rack_u: int | None,
    rack_units: int = 1,
    exclude_server_id: int | None = None,
) -> None:
    if rack_id and not datacenter_id:
        raise HTTPException(status_code=400, detail="datacenter_id required when rack_id is set")

    if rack_u and not rack_id:
        raise HTTPException(status_code=400, detail="rack_id required when rack_u is set")

    if not datacenter_id:
        return

    rack_units = max(1, min(rack_units, 52))

    dc = get_owned_datacenter(db, datacenter_id, owner_id)

    if rack_id:
        if dc.type != "custom":
            raise HTTPException(status_code=400, detail="Racks are only available in custom datacenters")
        rack = get_owned_rack(db, rack_id, owner_id)
        if rack.datacenter_id != datacenter_id:
            raise HTTPException(status_code=400, detail="Rack does not belong to this datacenter")

        if rack_u:
            top_u = rack_u + rack_units - 1
            if top_u > rack.capacity_u:
                raise HTTPException(
                    status_code=400,
                    detail=f"Le serveur ({rack_units}U à partir de U{rack_u}) dépasse la capacité ({rack.capacity_u}U)",
                )

            requested = set(range(rack_u, rack_u + rack_units))
            others = (
                db.query(Server)
                .filter(Server.rack_id == rack_id, Server.owner_id == owner_id)
            )
            if exclude_server_id:
                others = others.filter(Server.id != exclude_server_id)

            for other in others.all():
                overlap = occupied_u_slots(other) & requested
                if overlap:
                    u = min(overlap)
                    raise HTTPException(
                        status_code=400,
                        detail=f"Conflit en U{u} avec « {other.name} » dans cette baie",
                    )


def apply_server_placement(
    server: Server,
    db: Session,
    owner_id: int,
    datacenter_id: int | None,
    rack_id: int | None,
    rack_u: int | None,
    rack_units: int | None = None,
) -> None:
    """Apply resolved placement values to a server."""
    if datacenter_id is None:
        server.datacenter_id = None
        server.rack_id = None
        server.rack_u = None
        return

    if rack_id is None:
        rack_u = None

    units = rack_units if rack_units is not None else (server.rack_units or 1)

    validate_server_placement(
        db, owner_id, datacenter_id, rack_id, rack_u, units, exclude_server_id=server.id
    )

    dc = get_owned_datacenter(db, datacenter_id, owner_id)
    if dc.type == "cloud":
        rack_id = None
        rack_u = None

    server.datacenter_id = datacenter_id
    server.rack_id = rack_id
    server.rack_u = rack_u
    if rack_units is not None:
        server.rack_units = max(1, rack_units)

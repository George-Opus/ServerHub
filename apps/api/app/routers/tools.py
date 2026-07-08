import re
import shutil
import subprocess

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.auth.deps import get_current_user
from app.models import User

router = APIRouter(prefix="/api/tools", tags=["tools"])

# Autorise noms d'hôte, IPv4/IPv6 et domaines. Bloque tout caractère shell.
TARGET_RE = re.compile(r"^[A-Za-z0-9._:-]{1,253}$")
DIG_RECORDS = {"A", "AAAA", "MX", "TXT", "NS", "CNAME", "SOA", "PTR", "SRV", "CAA"}


class NetToolRequest(BaseModel):
    tool: str = Field(pattern="^(whois|dig|ping)$")
    target: str = Field(min_length=1, max_length=253)
    record: str | None = None


class NetToolResult(BaseModel):
    tool: str
    target: str
    command: str
    output: str


def _run(cmd: list[str], timeout: int = 12) -> str:
    binary = shutil.which(cmd[0])
    if not binary:
        raise HTTPException(status_code=503, detail=f"L'outil « {cmd[0]} » n'est pas disponible sur le serveur.")
    try:
        proc = subprocess.run(  # noqa: S603 - args list, shell=False, entrée validée
            [binary, *cmd[1:]],
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="La commande a expiré (timeout).")
    out = (proc.stdout or "") + (proc.stderr or "")
    return out.strip() or "(aucune sortie)"


@router.post("/net", response_model=NetToolResult)
def net_tool(payload: NetToolRequest, _: User = Depends(get_current_user)):
    target = payload.target.strip()
    if not TARGET_RE.match(target):
        raise HTTPException(status_code=400, detail="Cible invalide (caractères autorisés : lettres, chiffres, . : _ -).")

    if payload.tool == "whois":
        cmd = ["whois", target]
    elif payload.tool == "dig":
        record = (payload.record or "A").upper()
        if record not in DIG_RECORDS:
            raise HTTPException(status_code=400, detail=f"Type d'enregistrement non supporté : {record}")
        cmd = ["dig", "+short", target, record]
    else:  # ping
        cmd = ["ping", "-c", "4", "-w", "6", target]

    output = _run(cmd)
    return NetToolResult(tool=payload.tool, target=target, command=" ".join(cmd), output=output)

from dataclasses import dataclass

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import PasswordProfile, Server, SshKeyProfile
from app.services.crypto import CredentialDecryptError, decrypt_private_key, encrypt_private_key, has_ssh_credentials


@dataclass
class ServerAuth:
    auth_type: str
    username: str
    private_key: str | None = None
    passphrase: str | None = None
    password: str | None = None


def has_server_auth(server: Server) -> bool:
    if server.auth_type == "password":
        return bool(server.ssh_password_encrypted)
    return has_ssh_credentials(server.ssh_private_key_encrypted)


def get_server_auth(server: Server) -> ServerAuth:
    if server.auth_type == "password":
        if not server.ssh_password_encrypted:
            raise CredentialDecryptError(
                "Aucun mot de passe SSH configuré. Ouvrez « Modifier » sur ce serveur ou choisissez un profil."
            )
        return ServerAuth(
            auth_type="password",
            username=server.ssh_username,
            password=decrypt_private_key(server.ssh_password_encrypted),
        )

    if not has_ssh_credentials(server.ssh_private_key_encrypted):
        raise CredentialDecryptError(
            "Aucune clé SSH configurée. Ouvrez « Modifier » sur ce serveur et ajoutez une clé privée."
        )
    private_key = decrypt_private_key(server.ssh_private_key_encrypted)  # type: ignore[arg-type]
    passphrase = (
        decrypt_private_key(server.ssh_key_passphrase_encrypted)
        if server.ssh_key_passphrase_encrypted
        else None
    )
    return ServerAuth(
        auth_type="key",
        username=server.ssh_username,
        private_key=private_key,
        passphrase=passphrase,
    )


def get_ssh_credentials(server: Server) -> tuple[str, str | None]:
    """Backward-compatible helper for key-based auth."""
    auth = get_server_auth(server)
    if auth.auth_type != "key" or not auth.private_key:
        raise CredentialDecryptError("Ce serveur utilise l'authentification par mot de passe.")
    return auth.private_key, auth.passphrase


def get_owned_ssh_key_profile(db: Session, profile_id: int, owner_id: int) -> SshKeyProfile:
    profile = (
        db.query(SshKeyProfile)
        .filter(SshKeyProfile.id == profile_id, SshKeyProfile.owner_id == owner_id)
        .first()
    )
    if not profile:
        raise HTTPException(status_code=404, detail="Profil de clé SSH introuvable")
    return profile


def get_owned_password_profile(db: Session, profile_id: int, owner_id: int) -> PasswordProfile:
    profile = (
        db.query(PasswordProfile)
        .filter(PasswordProfile.id == profile_id, PasswordProfile.owner_id == owner_id)
        .first()
    )
    if not profile:
        raise HTTPException(status_code=404, detail="Profil utilisateur/mot de passe introuvable")
    return profile


def get_default_ssh_key_profile(db: Session, owner_id: int) -> SshKeyProfile | None:
    return (
        db.query(SshKeyProfile)
        .filter(SshKeyProfile.owner_id == owner_id, SshKeyProfile.is_default.is_(True))
        .first()
    )


def get_default_password_profile(db: Session, owner_id: int) -> PasswordProfile | None:
    return (
        db.query(PasswordProfile)
        .filter(PasswordProfile.owner_id == owner_id, PasswordProfile.is_default.is_(True))
        .first()
    )


def set_default_ssh_key(db: Session, owner_id: int, profile_id: int) -> SshKeyProfile:
    profile = get_owned_ssh_key_profile(db, profile_id, owner_id)
    db.query(SshKeyProfile).filter(SshKeyProfile.owner_id == owner_id).update(
        {SshKeyProfile.is_default: False}
    )
    profile.is_default = True
    return profile


def set_default_password(db: Session, owner_id: int, profile_id: int) -> PasswordProfile:
    profile = get_owned_password_profile(db, profile_id, owner_id)
    db.query(PasswordProfile).filter(PasswordProfile.owner_id == owner_id).update(
        {PasswordProfile.is_default: False}
    )
    profile.is_default = True
    return profile


@dataclass
class ResolvedServerAuth:
    auth_type: str
    ssh_username: str
    ssh_private_key_encrypted: str | None = None
    ssh_key_passphrase_encrypted: str | None = None
    ssh_password_encrypted: str | None = None
    ssh_key_profile_id: int | None = None
    password_profile_id: int | None = None


def resolve_server_auth(
    db: Session,
    owner_id: int,
    *,
    auth_type: str,
    ssh_username: str | None,
    ssh_private_key: str | None = None,
    ssh_key_passphrase: str | None = None,
    ssh_password: str | None = None,
    ssh_key_profile_id: int | None = None,
    password_profile_id: int | None = None,
) -> ResolvedServerAuth:
    auth_type = auth_type if auth_type in ("key", "password") else "key"

    if auth_type == "key":
        if ssh_key_profile_id:
            profile = get_owned_ssh_key_profile(db, ssh_key_profile_id, owner_id)
            return ResolvedServerAuth(
                auth_type="key",
                ssh_username=ssh_username or "root",
                ssh_private_key_encrypted=profile.private_key_encrypted,
                ssh_key_passphrase_encrypted=profile.passphrase_encrypted,
                ssh_password_encrypted=None,
                ssh_key_profile_id=profile.id,
                password_profile_id=None,
            )
        if ssh_private_key and ssh_private_key.strip():
            return ResolvedServerAuth(
                auth_type="key",
                ssh_username=ssh_username or "root",
                ssh_private_key_encrypted=encrypt_private_key(ssh_private_key.strip()),
                ssh_key_passphrase_encrypted=(
                    encrypt_private_key(ssh_key_passphrase) if ssh_key_passphrase else None
                ),
                ssh_password_encrypted=None,
                ssh_key_profile_id=None,
                password_profile_id=None,
            )
        default = get_default_ssh_key_profile(db, owner_id)
        if default:
            return ResolvedServerAuth(
                auth_type="key",
                ssh_username=ssh_username or "root",
                ssh_private_key_encrypted=default.private_key_encrypted,
                ssh_key_passphrase_encrypted=default.passphrase_encrypted,
                ssh_password_encrypted=None,
                ssh_key_profile_id=default.id,
                password_profile_id=None,
            )
        raise HTTPException(
            status_code=400,
            detail="Aucune clé SSH fournie. Saisissez une clé, choisissez un profil ou définissez un profil par défaut.",
        )

    # password auth
    if password_profile_id:
        profile = get_owned_password_profile(db, password_profile_id, owner_id)
        return ResolvedServerAuth(
            auth_type="password",
            ssh_username=ssh_username or profile.username,
            ssh_private_key_encrypted=None,
            ssh_key_passphrase_encrypted=None,
            ssh_password_encrypted=profile.password_encrypted,
            ssh_key_profile_id=None,
            password_profile_id=profile.id,
        )
    if ssh_password and ssh_password.strip():
        return ResolvedServerAuth(
            auth_type="password",
            ssh_username=ssh_username or "root",
            ssh_private_key_encrypted=None,
            ssh_key_passphrase_encrypted=None,
            ssh_password_encrypted=encrypt_private_key(ssh_password),
            ssh_key_profile_id=None,
            password_profile_id=None,
        )
    default = get_default_password_profile(db, owner_id)
    if default:
        return ResolvedServerAuth(
            auth_type="password",
            ssh_username=ssh_username or default.username,
            ssh_private_key_encrypted=None,
            ssh_key_passphrase_encrypted=None,
            ssh_password_encrypted=default.password_encrypted,
            ssh_key_profile_id=None,
            password_profile_id=default.id,
        )
    raise HTTPException(
        status_code=400,
        detail="Aucun mot de passe fourni. Saisissez un mot de passe, choisissez un profil ou définissez un profil par défaut.",
    )


def apply_resolved_auth(server: Server, resolved: ResolvedServerAuth) -> None:
    server.auth_type = resolved.auth_type
    server.ssh_username = resolved.ssh_username
    server.ssh_private_key_encrypted = resolved.ssh_private_key_encrypted
    server.ssh_key_passphrase_encrypted = resolved.ssh_key_passphrase_encrypted
    server.ssh_password_encrypted = resolved.ssh_password_encrypted
    server.ssh_key_profile_id = resolved.ssh_key_profile_id
    server.password_profile_id = resolved.password_profile_id

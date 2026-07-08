import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from app.config import settings


class CredentialDecryptError(Exception):
    """Raised when stored SSH credentials cannot be decrypted."""


def _get_fernet() -> Fernet:
    if settings.fernet_key:
        return Fernet(settings.fernet_key.encode())
    derived = hashlib.sha256(settings.secret_key.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(derived))


def encrypt_private_key(private_key: str) -> str:
    return _get_fernet().encrypt(private_key.encode()).decode()


def encrypt_secret(value: str) -> str:
    return encrypt_private_key(value)


PENDING_SSH_PLACEHOLDER = "__PENDING_SSH__"


def encrypt_pending_ssh() -> str:
    return encrypt_private_key(PENDING_SSH_PLACEHOLDER)


def has_ssh_credentials(encrypted: str | None) -> bool:
    if not encrypted:
        return False
    try:
        key = decrypt_private_key(encrypted)
        return key != PENDING_SSH_PLACEHOLDER and bool(key.strip())
    except CredentialDecryptError:
        return False


def decrypt_secret(encrypted: str) -> str:
    return decrypt_private_key(encrypted)


def decrypt_private_key(encrypted: str) -> str:
    try:
        return _get_fernet().decrypt(encrypted.encode()).decode()
    except InvalidToken as exc:
        raise CredentialDecryptError(
            "Impossible de déchiffrer la clé SSH enregistrée. "
            "Ouvrez « Modifier » sur ce serveur et ressaisissez la clé privée (et la passphrase si besoin)."
        ) from exc

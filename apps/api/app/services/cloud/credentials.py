import json

from app.services.crypto import decrypt_secret, encrypt_secret

SYNC_PROVIDERS = {"OVH", "Hetzner", "Scaleway"}

PROVIDER_CREDENTIAL_FIELDS: dict[str, list[dict[str, str]]] = {
    "OVH": [
        {"key": "application_key", "label": "Application Key", "type": "text"},
        {"key": "application_secret", "label": "Application Secret", "type": "password"},
        {"key": "consumer_key", "label": "Consumer Key", "type": "password"},
        {"key": "endpoint", "label": "Endpoint", "type": "text", "placeholder": "ovh-eu"},
    ],
    "Hetzner": [
        {"key": "api_token", "label": "API Token", "type": "password"},
    ],
    "Scaleway": [
        {"key": "access_key", "label": "Access Key", "type": "text"},
        {"key": "secret_key", "label": "Secret Key", "type": "password"},
        {"key": "project_id", "label": "Project ID", "type": "text"},
        {"key": "zone", "label": "Zone", "type": "text", "placeholder": "fr-par-1"},
    ],
}


def encrypt_credentials(credentials: dict[str, str]) -> str:
    return encrypt_secret(json.dumps(credentials))


def decrypt_credentials(encrypted: str) -> dict[str, str]:
    return json.loads(decrypt_secret(encrypted))

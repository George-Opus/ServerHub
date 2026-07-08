from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.database import get_db
from app.models import PasswordProfile, SshKeyProfile, User
from app.schemas import (
    PasswordProfileCreate,
    PasswordProfileOut,
    PasswordProfileUpdate,
    SshKeyProfileCreate,
    SshKeyProfileOut,
    SshKeyProfileUpdate,
)
from app.services.crypto import encrypt_private_key
from app.services.server_credentials import (
    get_owned_password_profile,
    get_owned_ssh_key_profile,
    set_default_password,
    set_default_ssh_key,
)

router = APIRouter(prefix="/api/credentials", tags=["credentials"])


@router.get("/ssh-keys", response_model=list[SshKeyProfileOut])
def list_ssh_keys(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return (
        db.query(SshKeyProfile)
        .filter(SshKeyProfile.owner_id == current_user.id)
        .order_by(SshKeyProfile.is_default.desc(), SshKeyProfile.name)
        .all()
    )


@router.post("/ssh-keys", response_model=SshKeyProfileOut, status_code=status.HTTP_201_CREATED)
def create_ssh_key(
    payload: SshKeyProfileCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.is_default:
        db.query(SshKeyProfile).filter(SshKeyProfile.owner_id == current_user.id).update(
            {SshKeyProfile.is_default: False}
        )
    profile = SshKeyProfile(
        name=payload.name,
        private_key_encrypted=encrypt_private_key(payload.private_key),
        passphrase_encrypted=encrypt_private_key(payload.passphrase) if payload.passphrase else None,
        is_default=payload.is_default,
        owner_id=current_user.id,
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


@router.patch("/ssh-keys/{profile_id}", response_model=SshKeyProfileOut)
def update_ssh_key(
    profile_id: int,
    payload: SshKeyProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = get_owned_ssh_key_profile(db, profile_id, current_user.id)
    data = payload.model_dump(exclude_unset=True)
    if "private_key" in data:
        key = data.pop("private_key")
        if key:
            profile.private_key_encrypted = encrypt_private_key(key)
    if "passphrase" in data:
        passphrase = data.pop("passphrase")
        profile.passphrase_encrypted = encrypt_private_key(passphrase) if passphrase else None
    for key, value in data.items():
        setattr(profile, key, value)
    db.commit()
    db.refresh(profile)
    return profile


@router.post("/ssh-keys/{profile_id}/default", response_model=SshKeyProfileOut)
def make_ssh_key_default(
    profile_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = set_default_ssh_key(db, current_user.id, profile_id)
    db.commit()
    db.refresh(profile)
    return profile


@router.delete("/ssh-keys/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_ssh_key(
    profile_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = get_owned_ssh_key_profile(db, profile_id, current_user.id)
    db.delete(profile)
    db.commit()


@router.get("/passwords", response_model=list[PasswordProfileOut])
def list_passwords(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return (
        db.query(PasswordProfile)
        .filter(PasswordProfile.owner_id == current_user.id)
        .order_by(PasswordProfile.is_default.desc(), PasswordProfile.name)
        .all()
    )


@router.post("/passwords", response_model=PasswordProfileOut, status_code=status.HTTP_201_CREATED)
def create_password(
    payload: PasswordProfileCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.is_default:
        db.query(PasswordProfile).filter(PasswordProfile.owner_id == current_user.id).update(
            {PasswordProfile.is_default: False}
        )
    profile = PasswordProfile(
        name=payload.name,
        username=payload.username,
        password_encrypted=encrypt_private_key(payload.password),
        is_default=payload.is_default,
        owner_id=current_user.id,
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


@router.patch("/passwords/{profile_id}", response_model=PasswordProfileOut)
def update_password(
    profile_id: int,
    payload: PasswordProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = get_owned_password_profile(db, profile_id, current_user.id)
    data = payload.model_dump(exclude_unset=True)
    if "password" in data:
        password = data.pop("password")
        if password:
            profile.password_encrypted = encrypt_private_key(password)
    for key, value in data.items():
        setattr(profile, key, value)
    db.commit()
    db.refresh(profile)
    return profile


@router.post("/passwords/{profile_id}/default", response_model=PasswordProfileOut)
def make_password_default(
    profile_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = set_default_password(db, current_user.id, profile_id)
    db.commit()
    db.refresh(profile)
    return profile


@router.delete("/passwords/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_password(
    profile_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = get_owned_password_profile(db, profile_id, current_user.id)
    db.delete(profile)
    db.commit()

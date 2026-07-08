"use client";

import { useCallback, useEffect, useState } from "react";
import { KeyRound, Plus, Star, Trash2 } from "lucide-react";
import { Modal } from "@/components/Modal";
import { SshKeyFields } from "@/components/SshKeyFields";
import {
  api,
  ApiError,
  type PasswordProfile,
  type SshKeyProfile,
} from "@/lib/api";
import { getToken } from "@/lib/auth";

type Tab = "ssh" | "password";

export default function CredentialsPage() {
  const token = getToken()!;
  const [tab, setTab] = useState<Tab>("ssh");
  const [sshKeys, setSshKeys] = useState<SshKeyProfile[]>([]);
  const [passwords, setPasswords] = useState<PasswordProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [sshModalOpen, setSshModalOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [editingSsh, setEditingSsh] = useState<SshKeyProfile | null>(null);
  const [editingPassword, setEditingPassword] = useState<PasswordProfile | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [keys, pw] = await Promise.all([
        api.listSshKeyProfiles(token),
        api.listPasswordProfiles(token),
      ]);
      setSshKeys(keys);
      setPasswords(pw);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const setDefaultSsh = async (id: number) => {
    try {
      await api.setDefaultSshKeyProfile(token, id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur");
    }
  };

  const deleteSsh = async (id: number) => {
    if (!confirm("Supprimer ce profil de clé SSH ?")) return;
    try {
      await api.deleteSshKeyProfile(token, id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur");
    }
  };

  const setDefaultPassword = async (id: number) => {
    try {
      await api.setDefaultPasswordProfile(token, id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur");
    }
  };

  const deletePassword = async (id: number) => {
    if (!confirm("Supprimer ce profil user / mot de passe ?")) return;
    try {
      await api.deletePasswordProfile(token, id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur");
    }
  };

  return (
    <>
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="label mb-1">Sécurité</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Identifiants</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enregistrez des clés SSH et des couples user / mot de passe réutilisables sur vos serveurs.
          </p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            if (tab === "ssh") {
              setEditingSsh(null);
              setSshModalOpen(true);
            } else {
              setEditingPassword(null);
              setPasswordModalOpen(true);
            }
          }}
        >
          <Plus className="h-4 w-4" />
          {tab === "ssh" ? "Ajouter une clé SSH" : "Ajouter un profil"}
        </button>
      </header>

      <div className="mb-6 flex gap-2 border-b border-border/60">
        <TabButton active={tab === "ssh"} onClick={() => setTab("ssh")}>
          Clés SSH ({sshKeys.length})
        </TabButton>
        <TabButton active={tab === "password"} onClick={() => setTab("password")}>
          User / Mot de passe ({passwords.length})
        </TabButton>
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-24">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : tab === "ssh" ? (
        sshKeys.length === 0 ? (
          <EmptyState
            icon={KeyRound}
            title="Aucune clé SSH enregistrée"
            description="Créez un profil pour l'appliquer rapidement lors de l'ajout d'un serveur."
            onAction={() => {
              setEditingSsh(null);
              setSshModalOpen(true);
            }}
            actionLabel="Ajouter une clé SSH"
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {sshKeys.map((k) => (
              <ProfileCard
                key={k.id}
                title={k.name}
                subtitle="Clé privée SSH"
                isDefault={k.is_default}
                onEdit={() => {
                  setEditingSsh(k);
                  setSshModalOpen(true);
                }}
                onDefault={() => setDefaultSsh(k.id)}
                onDelete={() => deleteSsh(k.id)}
              />
            ))}
          </div>
        )
      ) : passwords.length === 0 ? (
        <EmptyState
          icon={KeyRound}
          title="Aucun profil user / mot de passe"
          description="Définissez un profil par défaut pour l'attribuer automatiquement aux nouveaux serveurs."
          onAction={() => {
            setEditingPassword(null);
            setPasswordModalOpen(true);
          }}
          actionLabel="Ajouter un profil"
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {passwords.map((p) => (
            <ProfileCard
              key={p.id}
              title={p.name}
              subtitle={`Utilisateur : ${p.username}`}
              isDefault={p.is_default}
              onEdit={() => {
                setEditingPassword(p);
                setPasswordModalOpen(true);
              }}
              onDefault={() => setDefaultPassword(p.id)}
              onDelete={() => deletePassword(p.id)}
            />
          ))}
        </div>
      )}

      <SshKeyModal
        open={sshModalOpen}
        profile={editingSsh}
        token={token}
        onClose={() => setSshModalOpen(false)}
        onSaved={() => {
          setSshModalOpen(false);
          load();
        }}
      />

      <PasswordProfileModal
        open={passwordModalOpen}
        profile={editingPassword}
        token={token}
        onClose={() => setPasswordModalOpen(false)}
        onSaved={() => {
          setPasswordModalOpen(false);
          load();
        }}
      />
    </>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-b-2 px-3 py-2 text-sm transition-colors ${
        active
          ? "border-primary font-medium text-primary"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function ProfileCard({
  title,
  subtitle,
  isDefault,
  onEdit,
  onDefault,
  onDelete,
}: {
  title: string;
  subtitle: string;
  isDefault: boolean;
  onEdit: () => void;
  onDefault: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-foreground">{title}</h3>
            {isDefault && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Défaut</span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex shrink-0 gap-1">
          {!isDefault && (
            <button type="button" onClick={onDefault} className="btn-icon" title="Définir par défaut">
              <Star className="h-4 w-4" />
            </button>
          )}
          <button type="button" onClick={onEdit} className="btn-ghost text-xs px-2">
            Modifier
          </button>
          <button type="button" onClick={onDelete} className="btn-icon text-destructive" title="Supprimer">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  onAction,
  actionLabel,
}: {
  icon: typeof KeyRound;
  title: string;
  description: string;
  onAction: () => void;
  actionLabel: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 py-16 text-center">
      <Icon className="mb-3 h-8 w-8 text-muted-foreground/60" />
      <h3 className="font-medium text-foreground">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      <button type="button" onClick={onAction} className="btn-primary mt-4">
        <Plus className="h-4 w-4" />
        {actionLabel}
      </button>
    </div>
  );
}

function SshKeyModal({
  open,
  profile,
  token,
  onClose,
  onSaved,
}: {
  open: boolean;
  profile: SshKeyProfile | null;
  token: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setName(profile?.name ?? "");
      setPrivateKey("");
      setPassphrase("");
      setIsDefault(profile?.is_default ?? false);
      setError("");
    }
  }, [open, profile]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (profile) {
        await api.updateSshKeyProfile(token, profile.id, {
          name,
          private_key: privateKey.trim() || undefined,
          passphrase: passphrase || undefined,
        });
        if (isDefault && !profile.is_default) {
          await api.setDefaultSshKeyProfile(token, profile.id);
        }
      } else {
        await api.createSshKeyProfile(token, {
          name,
          private_key: privateKey,
          passphrase: passphrase || undefined,
          is_default: isDefault,
        });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={profile ? "Modifier la clé SSH" : "Nouvelle clé SSH"}
      subtitle="La clé et le mot de passe sont chiffrés avant stockage."
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Nom du profil</label>
          <input
            className="input-field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Production OVH"
            required
          />
        </div>

        <SshKeyFields
          privateKey={privateKey}
          passphrase={passphrase}
          onPrivateKeyChange={setPrivateKey}
          onPassphraseChange={setPassphrase}
          requireKey={!profile}
          keyOptionalHint="Laisser vide pour conserver la clé actuelle"
          passphraseOptionalHint="Laisser vide pour conserver le mot de passe actuel"
        />

        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            className="rounded border-border"
          />
          Définir comme profil par défaut pour les nouveaux serveurs (clé SSH)
        </label>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-ghost">
            Annuler
          </button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function PasswordProfileModal({
  open,
  profile,
  token,
  onClose,
  onSaved,
}: {
  open: boolean;
  profile: PasswordProfile | null;
  token: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("root");
  const [password, setPassword] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setName(profile?.name ?? "");
      setUsername(profile?.username ?? "root");
      setPassword("");
      setIsDefault(profile?.is_default ?? false);
      setError("");
    }
  }, [open, profile]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (profile) {
        await api.updatePasswordProfile(token, profile.id, {
          name,
          username,
          password: password || undefined,
        });
        if (isDefault && !profile.is_default) {
          await api.setDefaultPasswordProfile(token, profile.id);
        }
      } else {
        await api.createPasswordProfile(token, {
          name,
          username,
          password,
          is_default: isDefault,
        });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={profile ? "Modifier le profil" : "Nouveau profil user / mot de passe"}
      subtitle="Le mot de passe est chiffré avant stockage."
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Nom du profil</label>
          <input
            className="input-field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Admin production"
            required
          />
        </div>

        <div>
          <label className="label">Utilisateur</label>
          <input
            className="input-field"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="root"
            required
          />
        </div>

        <div>
          <label className="label">Mot de passe{profile ? " (optionnel)" : ""}</label>
          <input
            type="password"
            className="input-field"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={profile ? "Laisser vide pour conserver" : "Mot de passe SSH"}
            autoComplete="new-password"
            required={!profile}
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            className="rounded border-border"
          />
          Définir comme profil par défaut pour les nouveaux serveurs (mot de passe)
        </label>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-ghost">
            Annuler
          </button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

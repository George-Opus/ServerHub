"use client";

import { useEffect, useState } from "react";
import { api, type PasswordProfile, type SshKeyProfile } from "@/lib/api";
import { SshKeyFields } from "./SshKeyFields";

export type CredentialAuthState = {
  authType: "key" | "password";
  source: "saved" | "manual";
  sshKeyProfileId: number | null;
  passwordProfileId: number | null;
  sshPrivateKey: string;
  sshKeyPassphrase: string;
  sshPassword: string;
  clearPassphrase: boolean;
};

type Props = {
  token: string;
  active: boolean;
  mode: "create" | "edit";
  value: CredentialAuthState;
  onChange: (value: CredentialAuthState) => void;
  onTouched?: () => void;
  hasStoredCredentials?: boolean;
  storedAuthType?: "key" | "password";
  credentialsTouched?: boolean;
};

export function CredentialAuthFields({
  token,
  active,
  mode,
  value,
  onChange,
  onTouched,
  hasStoredCredentials = false,
  storedAuthType = "key",
  credentialsTouched = false,
}: Props) {
  const [sshKeys, setSshKeys] = useState<SshKeyProfile[]>([]);
  const [passwords, setPasswords] = useState<PasswordProfile[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!active) return;
    setLoading(true);
    Promise.all([api.listSshKeyProfiles(token), api.listPasswordProfiles(token)])
      .then(([keys, pw]) => {
        setSshKeys(keys);
        setPasswords(pw);
      })
      .finally(() => setLoading(false));
  }, [active, token]);

  const patch = (partial: Partial<CredentialAuthState>) => {
    onTouched?.();
    onChange({ ...value, ...partial });
  };

  const defaultKey = sshKeys.find((k) => k.is_default);
  const defaultPassword = passwords.find((p) => p.is_default);
  const selectedPassword = passwords.find((p) => p.id === value.passwordProfileId);

  return (
    <div className="space-y-4 rounded-lg border border-border/60 bg-muted/20 p-4">
      <div>
        <p className="label mb-2">Authentification SSH</p>
        <div className="flex gap-2">
          <ToggleButton
            active={value.authType === "key"}
            onClick={() =>
              patch({
                authType: "key",
                passwordProfileId: null,
                sshPassword: "",
              })
            }
          >
            Clé SSH
          </ToggleButton>
          <ToggleButton
            active={value.authType === "password"}
            onClick={() =>
              patch({
                authType: "password",
                sshKeyProfileId: null,
                sshPrivateKey: "",
                sshKeyPassphrase: "",
              })
            }
          >
            User / Mot de passe
          </ToggleButton>
        </div>
      </div>

      <div>
        <p className="label mb-2">Source</p>
        <div className="flex gap-2">
          <ToggleButton active={value.source === "saved"} onClick={() => patch({ source: "saved" })}>
            Profil enregistré
          </ToggleButton>
          <ToggleButton active={value.source === "manual"} onClick={() => patch({ source: "manual" })}>
            Saisie directe
          </ToggleButton>
        </div>
      </div>

      {mode === "edit" && !credentialsTouched && hasStoredCredentials && (
        <p className="text-xs text-muted-foreground">
          Identifiants actuels : {storedAuthType === "password" ? "mot de passe" : "clé SSH"} enregistré(s) sur le
          serveur. Modifiez ci-dessous pour les remplacer.
        </p>
      )}

      {value.source === "saved" && value.authType === "key" && (
        <div>
          <label className="label">Profil de clé SSH</label>
          <select
            className="input-field"
            value={value.sshKeyProfileId ?? ""}
            onChange={(e) =>
              patch({
                sshKeyProfileId: e.target.value ? Number(e.target.value) : null,
              })
            }
            disabled={loading}
          >
            <option value="">
              {defaultKey ? `Par défaut — ${defaultKey.name}` : "Par défaut (aucun profil défini)"}
            </option>
            {sshKeys.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
                {k.is_default ? " (défaut)" : ""}
              </option>
            ))}
          </select>
          {sshKeys.length === 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              Aucun profil enregistré. Ajoutez-en dans Identifiants ou utilisez la saisie directe.
            </p>
          )}
        </div>
      )}

      {value.source === "saved" && value.authType === "password" && (
        <div>
          <label className="label">Profil user / mot de passe</label>
          <select
            className="input-field"
            value={value.passwordProfileId ?? ""}
            onChange={(e) =>
              patch({
                passwordProfileId: e.target.value ? Number(e.target.value) : null,
              })
            }
            disabled={loading}
          >
            <option value="">
              {defaultPassword
                ? `Par défaut — ${defaultPassword.name} (${defaultPassword.username})`
                : "Par défaut (aucun profil défini)"}
            </option>
            {passwords.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.username}
                {p.is_default ? " (défaut)" : ""}
              </option>
            ))}
          </select>
          {selectedPassword && (
            <p className="mt-1 text-xs text-muted-foreground">
              Utilisateur du profil : <span className="font-mono">{selectedPassword.username}</span> (modifiable via le
              champ Utilisateur SSH ci-dessus)
            </p>
          )}
          {passwords.length === 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              Aucun profil enregistré. Ajoutez-en dans Identifiants ou utilisez la saisie directe.
            </p>
          )}
        </div>
      )}

      {value.source === "manual" && value.authType === "key" && (
        <SshKeyFields
          privateKey={value.sshPrivateKey}
          passphrase={value.sshKeyPassphrase}
          onPrivateKeyChange={(v) => patch({ sshPrivateKey: v })}
          onPassphraseChange={(v) => patch({ sshKeyPassphrase: v, clearPassphrase: false })}
          requireKey={mode === "create"}
          keyOptionalHint="Laisser vide pour conserver la clé actuelle"
          passphraseOptionalHint="Laisser vide pour conserver le mot de passe actuel"
        />
      )}

      {value.source === "manual" && value.authType === "password" && (
        <div>
          <label className="label">Mot de passe SSH{mode === "create" ? "" : " (optionnel)"}</label>
          <input
            type="password"
            className="input-field"
            value={value.sshPassword}
            onChange={(e) => patch({ sshPassword: e.target.value })}
            placeholder={mode === "create" ? "Mot de passe du compte SSH" : "Laisser vide pour conserver le mot de passe actuel"}
            autoComplete="off"
            required={mode === "create"}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            L&apos;utilisateur SSH est défini dans le champ « Utilisateur SSH » ci-dessus.
          </p>
        </div>
      )}

      {value.source === "saved" && (
        <p className="text-xs text-muted-foreground">
          Si aucun profil n&apos;est sélectionné, le profil par défaut du type choisi sera appliqué automatiquement.
        </p>
      )}

      {mode === "edit" && value.source === "manual" && value.authType === "key" && (
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={value.clearPassphrase}
            onChange={(e) =>
              patch({
                clearPassphrase: e.target.checked,
                sshKeyPassphrase: e.target.checked ? "" : value.sshKeyPassphrase,
              })
            }
            className="rounded border-border"
          />
          Supprimer le mot de passe de clé enregistré
        </label>
      )}
    </div>
  );
}

function ToggleButton({
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
      className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
        active
          ? "bg-primary/15 font-medium text-primary"
          : "bg-muted/50 text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

export function buildCredentialPayload(
  auth: CredentialAuthState,
  mode: "create" | "edit",
): {
  auth_type: "key" | "password";
  ssh_private_key?: string;
  ssh_key_passphrase?: string;
  ssh_password?: string;
  ssh_key_profile_id?: number | null;
  password_profile_id?: number | null;
} | null {
  if (mode === "edit") {
    return null;
  }

  const payload: {
    auth_type: "key" | "password";
    ssh_private_key?: string;
    ssh_key_passphrase?: string;
    ssh_password?: string;
    ssh_key_profile_id?: number | null;
    password_profile_id?: number | null;
  } = { auth_type: auth.authType };

  if (auth.source === "saved") {
    if (auth.authType === "key" && auth.sshKeyProfileId) {
      payload.ssh_key_profile_id = auth.sshKeyProfileId;
    }
    if (auth.authType === "password" && auth.passwordProfileId) {
      payload.password_profile_id = auth.passwordProfileId;
    }
    return payload;
  }

  if (auth.authType === "key") {
    if (auth.sshPrivateKey.trim()) {
      payload.ssh_private_key = auth.sshPrivateKey;
    }
    if (auth.sshKeyPassphrase) {
      payload.ssh_key_passphrase = auth.sshKeyPassphrase;
    }
  } else if (auth.sshPassword) {
    payload.ssh_password = auth.sshPassword;
  }

  return payload;
}

export function buildCredentialUpdatePayload(
  auth: CredentialAuthState,
  touched: boolean,
): {
  auth_type?: "key" | "password";
  ssh_private_key?: string;
  ssh_key_passphrase?: string;
  ssh_password?: string;
  ssh_key_profile_id?: number | null;
  password_profile_id?: number | null;
} {
  if (!touched) return {};

  const payload: {
    auth_type?: "key" | "password";
    ssh_private_key?: string;
    ssh_key_passphrase?: string;
    ssh_password?: string;
    ssh_key_profile_id?: number | null;
    password_profile_id?: number | null;
  } = { auth_type: auth.authType };

  if (auth.source === "saved") {
    payload.ssh_key_profile_id = auth.authType === "key" ? auth.sshKeyProfileId : null;
    payload.password_profile_id = auth.authType === "password" ? auth.passwordProfileId : null;
    return payload;
  }

  if (auth.authType === "key") {
    if (auth.sshPrivateKey.trim()) {
      payload.ssh_private_key = auth.sshPrivateKey;
    }
    if (auth.clearPassphrase) {
      payload.ssh_key_passphrase = "";
    } else if (auth.sshKeyPassphrase) {
      payload.ssh_key_passphrase = auth.sshKeyPassphrase;
    }
  } else if (auth.sshPassword) {
    payload.ssh_password = auth.sshPassword;
  }

  return payload;
}

export const emptyCredentialAuth = (): CredentialAuthState => ({
  authType: "key",
  source: "saved",
  sshKeyProfileId: null,
  passwordProfileId: null,
  sshPrivateKey: "",
  sshKeyPassphrase: "",
  sshPassword: "",
  clearPassphrase: false,
});

export const credentialAuthFromServer = (server: {
  auth_type: "key" | "password";
  ssh_key_profile_id: number | null;
  password_profile_id: number | null;
  has_ssh_key: boolean;
}): CredentialAuthState => ({
  authType: server.auth_type,
  source:
    (server.auth_type === "key" && server.ssh_key_profile_id) ||
    (server.auth_type === "password" && server.password_profile_id)
      ? "saved"
      : "manual",
  sshKeyProfileId: server.ssh_key_profile_id,
  passwordProfileId: server.password_profile_id,
  sshPrivateKey: "",
  sshKeyPassphrase: "",
  sshPassword: "",
  clearPassphrase: false,
});

"use client";

type Props = {
  privateKey: string;
  passphrase: string;
  onPrivateKeyChange: (value: string) => void;
  onPassphraseChange: (value: string) => void;
  requireKey?: boolean;
  keyOptionalHint?: string;
  passphraseOptionalHint?: string;
};

export function SshKeyFields({
  privateKey,
  passphrase,
  onPrivateKeyChange,
  onPassphraseChange,
  requireKey = false,
  keyOptionalHint = "Laisser vide pour conserver la clé actuelle",
  passphraseOptionalHint = "Laisser vide pour conserver le mot de passe actuel",
}: Props) {
  return (
    <>
      <div>
        <label className="label">Clé privée SSH{requireKey ? "" : " (optionnel)"}</label>
        <textarea
          className="input-field min-h-[120px] font-mono text-xs"
          value={privateKey}
          onChange={(e) => onPrivateKeyChange(e.target.value)}
          placeholder={
            requireKey
              ? "-----BEGIN OPENSSH PRIVATE KEY-----"
              : keyOptionalHint
          }
          required={requireKey}
        />
      </div>

      <div>
        <label className="label">Mot de passe de la clé SSH (optionnel)</label>
        <input
          type="password"
          className="input-field"
          value={passphrase}
          onChange={(e) => onPassphraseChange(e.target.value)}
          placeholder={passphraseOptionalHint}
          autoComplete="off"
        />
        <p className="mt-1 text-xs text-slate-500">
          Renseignez le mot de passe si votre clé privée est protégée.
        </p>
      </div>
    </>
  );
}

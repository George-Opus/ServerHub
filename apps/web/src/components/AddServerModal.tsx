"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { api, ApiError, type ServerCreatePayload } from "@/lib/api";
import {
  buildCredentialPayload,
  CredentialAuthFields,
  emptyCredentialAuth,
} from "./CredentialAuthFields";
import { Modal } from "./Modal";
import { PlacementFields } from "./PlacementFields";

const DEFAULT_PROVIDERS = ["OVH", "Scaleway", "PulseHeberg", "Hetzner", "AWS", "GCP", "Azure", "Autre"];

type Props = {
  token: string;
  providers?: string[];
  onCreated: () => void;
};

const emptyForm = (provider: string) => ({
  ip_address: "",
  provider,
  ssh_port: 22,
  ssh_username: "root",
  notes: "",
  datacenter_id: null as number | null,
  rack_id: null as number | null,
  rack_u: null as number | null,
  rack_units: 1,
  auth: emptyCredentialAuth(),
});

export function AddServerModal({ token, providers = DEFAULT_PROVIDERS, onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm(providers[0] ?? "OVH"));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    if (form.rack_u && !form.rack_id) {
      setError("Sélectionnez une baie avant de choisir une position U");
      setLoading(false);
      return;
    }

    try {
      const credentialPayload = buildCredentialPayload(form.auth, "create") ?? { auth_type: "key" as const };
      const payload: ServerCreatePayload = {
        ip_address: form.ip_address,
        provider: form.provider,
        ssh_port: form.ssh_port,
        ssh_username: form.ssh_username,
        notes: form.notes || undefined,
        datacenter_id: form.datacenter_id ?? undefined,
        rack_id: form.rack_id ?? undefined,
        rack_u: form.rack_u ?? undefined,
        rack_units: form.rack_units,
        ...credentialPayload,
      };
      await api.createServer(token, payload);
      setOpen(false);
      setForm(emptyForm(providers[0] ?? "OVH"));
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur lors de la création");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-primary">
        <Plus className="h-4 w-4" />
        Ajouter un serveur
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Nouveau serveur"
        subtitle="Le nom sera défini automatiquement depuis le hostname SSH."
        maxWidth="max-w-xl"
      >
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Adresse IP">
              <input
                className="input-field font-mono"
                value={form.ip_address}
                onChange={(e) => setForm({ ...form, ip_address: e.target.value })}
                placeholder="203.0.113.42"
                required
              />
            </Field>
            <Field label="Provider">
              <select
                className="input-field"
                value={form.provider}
                onChange={(e) => setForm({ ...form, provider: e.target.value })}
              >
                {providers.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Port SSH">
              <input
                type="number"
                className="input-field"
                value={form.ssh_port}
                onChange={(e) => setForm({ ...form, ssh_port: Number(e.target.value) })}
                min={1}
                max={65535}
              />
            </Field>
            <Field label="Utilisateur SSH">
              <input
                className="input-field"
                value={form.ssh_username}
                onChange={(e) => setForm({ ...form, ssh_username: e.target.value })}
                placeholder="root"
              />
            </Field>
          </div>

          <CredentialAuthFields
            token={token}
            active={open}
            mode="create"
            value={form.auth}
            onChange={(auth) => setForm({ ...form, auth })}
          />

          <PlacementFields
            token={token}
            active={open}
            datacenterId={form.datacenter_id ?? null}
            rackId={form.rack_id ?? null}
            rackU={form.rack_u ?? null}
            rackUnits={form.rack_units ?? 1}
            onDatacenterChange={(id) => setForm({ ...form, datacenter_id: id, rack_id: null, rack_u: null })}
            onRackChange={(id) => setForm({ ...form, rack_id: id, rack_u: null })}
            onRackUChange={(u) => setForm({ ...form, rack_u: u })}
            onRackUnitsChange={(units) => setForm({ ...form, rack_units: units })}
          />

          <Field label="Notes (optionnel)">
            <input
              className="input-field"
              value={form.notes ?? ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Production, Paris DC..."
            />
          </Field>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
              Annuler
            </button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Création..." : "Créer le serveur"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

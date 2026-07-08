"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Pencil } from "lucide-react";
import { api, ApiError, type Server, type ServerUpdatePayload } from "@/lib/api";
import {
  buildCredentialUpdatePayload,
  credentialAuthFromServer,
  CredentialAuthFields,
} from "./CredentialAuthFields";
import { Modal } from "./Modal";
import { PlacementFields } from "./PlacementFields";

const DEFAULT_PROVIDERS = ["OVH", "Scaleway", "PulseHeberg", "Hetzner", "AWS", "GCP", "Azure", "Autre"];

type Props = {
  token: string;
  server: Server;
  providers?: string[];
  onUpdated: () => void;
  triggerClassName?: string;
  iconOnly?: boolean;
  triggerLabel?: string;
};

export function EditServerModal({
  token,
  server,
  providers = DEFAULT_PROVIDERS,
  onUpdated,
  triggerClassName,
  iconOnly = false,
  triggerLabel = "Modifier",
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [credentialsTouched, setCredentialsTouched] = useState(false);
  const [form, setForm] = useState({
    name: server.name,
    ip_address: server.ip_address,
    provider: server.provider,
    ssh_port: server.ssh_port,
    ssh_username: server.ssh_username,
    notes: server.notes ?? "",
    datacenter_id: server.datacenter_id,
    rack_id: server.rack_id,
    rack_u: server.rack_u,
    rack_units: server.rack_units ?? 1,
    auth: credentialAuthFromServer(server),
  });

  useEffect(() => {
    if (open) {
      setForm({
        name: server.name,
        ip_address: server.ip_address,
        provider: server.provider,
        ssh_port: server.ssh_port,
        ssh_username: server.ssh_username,
        notes: server.notes ?? "",
        datacenter_id: server.datacenter_id,
        rack_id: server.rack_id,
        rack_u: server.rack_u,
        rack_units: server.rack_units ?? 1,
        auth: credentialAuthFromServer(server),
      });
      setCredentialsTouched(false);
      setError("");
    }
  }, [open, server]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const payload: ServerUpdatePayload = {
      name: form.name,
      ip_address: form.ip_address,
      provider: form.provider,
      ssh_port: form.ssh_port,
      ssh_username: form.ssh_username,
      notes: form.notes || undefined,
      ...buildCredentialUpdatePayload(form.auth, credentialsTouched),
    };

    const placement = {
      datacenter_id: form.datacenter_id,
      rack_id: form.rack_id,
      rack_u: form.rack_u,
      rack_units: form.rack_units,
    };

    if (form.rack_u && !form.rack_id) {
      setError("Sélectionnez une baie avant de choisir une position U");
      setLoading(false);
      return;
    }

    try {
      await api.updateServer(token, server.id, payload);
      await api.updateServerPlacement(token, server.id, placement);
      setOpen(false);
      onUpdated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur lors de la modification");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={triggerClassName ?? "btn-ghost text-xs"}
        title="Modifier"
      >
        <Pencil className="h-3 w-3" />
        {!iconOnly && triggerLabel}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Modifier le serveur"
        subtitle="Mis à jour automatiquement lors d'une synchronisation SSH."
        maxWidth="max-w-xl"
      >
        <form onSubmit={submit} className="space-y-4">
          <Field label="Nom">
            <input
              className="input-field"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Adresse IP">
              <input
                className="input-field font-mono"
                value={form.ip_address}
                onChange={(e) => setForm({ ...form, ip_address: e.target.value })}
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
              />
            </Field>
          </div>

          <Collapsible
            label="Authentification SSH"
            hint={
              credentialsTouched
                ? "modifiée"
                : server.has_ssh_key
                  ? server.auth_type === "password"
                    ? "mot de passe enregistré"
                    : "clé enregistrée"
                  : "à configurer"
            }
          >
            <CredentialAuthFields
              token={token}
              active={open}
              mode="edit"
              value={form.auth}
              onChange={(auth) => setForm({ ...form, auth })}
              onTouched={() => setCredentialsTouched(true)}
              hasStoredCredentials={server.has_ssh_key}
              storedAuthType={server.auth_type}
              credentialsTouched={credentialsTouched}
            />
          </Collapsible>

          <Collapsible
            label="Emplacement"
            hint={form.datacenter_id ? "défini" : "non assigné"}
          >
            <PlacementFields
              token={token}
              active={open}
              serverId={server.id}
              datacenterId={form.datacenter_id}
              rackId={form.rack_id}
              rackU={form.rack_u}
              rackUnits={form.rack_units}
              onDatacenterChange={(id) => setForm({ ...form, datacenter_id: id, rack_id: null, rack_u: null })}
              onRackChange={(id) => setForm({ ...form, rack_id: id, rack_u: null })}
              onRackUChange={(u) => setForm({ ...form, rack_u: u })}
              onRackUnitsChange={(units) => setForm({ ...form, rack_units: units })}
            />
          </Collapsible>

          <Field label="Notes (optionnel)">
            <input
              className="input-field"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
              Annuler
            </button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Enregistrement..." : "Enregistrer"}
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

function Collapsible({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-border/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm"
      >
        <span className="font-medium text-foreground">{label}</span>
        <span className="flex items-center gap-2">
          {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      {open && <div className="border-t border-border/60 p-3">{children}</div>}
    </div>
  );
}

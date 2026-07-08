"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CloudDownload, Link2, RefreshCw, Unlink, X } from "lucide-react";
import { api, ApiError, type CloudConnection, type CloudDiscoverResult, type DatacenterInventory } from "@/lib/api";

type Props = {
  token: string;
  datacenter: DatacenterInventory;
  onUpdated: () => void;
  onMessage?: (msg: string) => void;
};

export function CloudSyncPanel({ token, datacenter, onUpdated, onMessage }: Props) {
  const [connection, setConnection] = useState<CloudConnection | null>(null);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [discover, setDiscover] = useState<CloudDiscoverResult | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");

  const loadConnection = useCallback(async () => {
    try {
      const conn = await api.getCloudConnection(token, datacenter.id);
      setConnection(conn);
      const defaults: Record<string, string> = {};
      conn.credential_fields.forEach((f) => {
        defaults[f.key] = f.placeholder ?? "";
      });
      setCredentials(defaults);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur");
    }
  }, [token, datacenter.id]);

  useEffect(() => {
    if (datacenter.type === "cloud") loadConnection();
  }, [datacenter.type, loadConnection]);

  // Réinitialise l'aperçu et l'état local quand on change de datacenter
  useEffect(() => {
    setDiscover(null);
    setError("");
    setConfigOpen(false);
  }, [datacenter.id]);

  if (datacenter.type !== "cloud") return null;

  const supported = connection?.sync_supported ?? datacenter.cloud_sync_supported;

  const saveConnection = async () => {
    setLoading(true);
    setError("");
    try {
      const conn = await api.setCloudConnection(token, datacenter.id, credentials);
      setConnection(conn);
      setConfigOpen(false);
      onUpdated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Connexion échouée");
    } finally {
      setLoading(false);
    }
  };

  const removeConnection = async () => {
    setLoading(true);
    setError("");
    try {
      await api.deleteCloudConnection(token, datacenter.id);
      setDiscover(null);
      await loadConnection();
      onUpdated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  };

  const preview = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api.discoverCloudInstances(token, datacenter.id);
      setDiscover(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Découverte échouée");
    } finally {
      setLoading(false);
    }
  };

  const sync = async () => {
    setSyncing(true);
    setError("");
    try {
      const result = await api.syncCloudInstances(token, datacenter.id);
      setDiscover(null);
      await loadConnection();
      onUpdated();
      onMessage?.(result.message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Synchronisation échouée");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="mb-6 rounded-xl border border-border/80 bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">Synchronisation API {datacenter.provider}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {supported
              ? connection?.connected
                ? `Connecté${connection.last_sync_at ? ` · Dernière sync ${new Date(connection.last_sync_at).toLocaleString("fr-FR")}` : ""}`
                : "Configurez les identifiants API pour importer vos serveurs automatiquement"
              : `L'API ${datacenter.provider} n'est pas encore supportée (OVH, Hetzner, Scaleway disponibles)`}
          </p>
        </div>

        {supported && (
          <div className="flex flex-wrap items-center gap-2">
            {connection?.connected ? (
              <>
                <button type="button" onClick={preview} disabled={loading || syncing} className="btn-ghost text-xs">
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                  Aperçu
                </button>
                <button type="button" onClick={sync} disabled={loading || syncing} className="btn-primary text-xs">
                  <CloudDownload className={`h-3.5 w-3.5 ${syncing ? "animate-pulse" : ""}`} />
                  {syncing ? "Import..." : "Importer / Mettre à jour"}
                </button>
                <button type="button" onClick={() => setConfigOpen(true)} className="btn-ghost text-xs" title="Modifier">
                  <Link2 className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={removeConnection} disabled={loading} className="btn-ghost text-xs hover:text-destructive" title="Déconnecter">
                  <Unlink className="h-3.5 w-3.5" />
                </button>
              </>
            ) : (
              <button type="button" onClick={() => setConfigOpen(true)} className="btn-primary text-xs">
                <Link2 className="h-3.5 w-3.5" />
                Connecter l&apos;API
              </button>
            )}
          </div>
        )}
      </div>

      {error && <p className="mt-3 whitespace-pre-line text-xs text-destructive">{error}</p>}

      {discover && discover.total > 0 && (
        <div className="mt-4 overflow-x-auto">
          <div className="mb-2 flex items-center justify-between">
            <p className="label mb-0">
              Aperçu · {discover.total} instance(s) sur {datacenter.provider}
            </p>
            <button
              type="button"
              onClick={() => setDiscover(null)}
              className="btn-ghost text-xs"
              title="Masquer l'aperçu"
            >
              <X className="h-3.5 w-3.5" />
              Masquer
            </button>
          </div>
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="py-2 pr-3">Nom</th>
                <th className="py-2 pr-3">IP</th>
                <th className="py-2 pr-3">Type</th>
                <th className="py-2 pr-3">Statut</th>
                <th className="py-2">ServerHub</th>
              </tr>
            </thead>
            <tbody>
              {discover.instances.map((inst) => (
                <tr key={inst.external_id} className="border-b border-border/50">
                  <td className="py-2 pr-3 font-medium">{inst.name}</td>
                  <td className="py-2 pr-3 font-mono">{inst.ip_address}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{inst.instance_type ?? "—"}</td>
                  <td className="py-2 pr-3">{inst.status}</td>
                  <td className="py-2">{inst.already_imported ? "Déjà importé" : "Nouveau"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AnimatePresence>
        {configOpen && connection && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[160] flex items-center justify-center bg-black/60 p-4"
            onClick={() => setConfigOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.96, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 12 }}
              className="glass w-full max-w-md p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-semibold">API {datacenter.provider}</h3>
                <button type="button" onClick={() => setConfigOpen(false)} className="btn-icon">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {datacenter.provider === "OVH" && (
                <div className="mb-4 rounded-lg border border-border/80 bg-muted/30 p-3 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">Création du Consumer Key</p>
                  <p className="mt-1">
                    Sur{" "}
                    <a
                      href="https://eu.api.ovh.com/createToken/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline"
                    >
                      eu.api.ovh.com/createToken
                    </a>
                    , ajoutez ces droits en <strong>GET</strong> :
                  </p>
                  <ul className="mt-2 list-inside list-disc font-mono text-[11px]">
                    <li>/dedicated/server</li>
                    <li>/dedicated/server/*</li>
                    <li>/vps</li>
                    <li>/vps/*</li>
                  </ul>
                  <p className="mt-2">Validez l&apos;e-mail OVH, puis collez le Consumer Key généré.</p>
                </div>
              )}

              <div className="space-y-3">
                {connection.credential_fields.map((field) => (
                  <div key={field.key}>
                    <label className="label">{field.label}</label>
                    <input
                      className="input-field"
                      type={field.type === "password" ? "password" : "text"}
                      placeholder={field.placeholder ?? undefined}
                      value={credentials[field.key] ?? ""}
                      onChange={(e) => setCredentials({ ...credentials, [field.key]: e.target.value })}
                    />
                  </div>
                ))}
              </div>

              {error && <p className="mt-3 whitespace-pre-line text-sm text-destructive">{error}</p>}

              <div className="mt-5 flex gap-2">
                <button type="button" onClick={() => setConfigOpen(false)} className="btn-ghost flex-1">
                  Annuler
                </button>
                <button type="button" onClick={saveConnection} disabled={loading} className="btn-primary flex-1">
                  {loading ? "Test..." : "Enregistrer & tester"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

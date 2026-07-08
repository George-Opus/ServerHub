"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Boxes, Download, Play, RefreshCw, RotateCw, Square } from "lucide-react";
import {
  api,
  ApiError,
  type DockerContainer,
  type ServiceCatalogItem,
  type ServiceDetail,
  type ServiceItem,
  type Server,
} from "@/lib/api";
import { getToken } from "@/lib/auth";

type ActionKind = "start" | "stop" | "restart" | "reload";

function stateDot(active: string, sub: string): string {
  if (sub === "running" || active === "active") return "bg-primary";
  if (active === "failed" || sub === "failed") return "bg-destructive";
  return "bg-muted-foreground";
}

function fmtDate(iso: string | null): string {
  if (!iso) return "jamais scanné";
  return "dernier scan : " + new Date(iso).toLocaleString(undefined);
}

export default function ServicesPage() {
  const token = getToken()!;
  const [servers, setServers] = useState<Server[]>([]);
  const [serverId, setServerId] = useState<number | null>(null);
  const [loadingServers, setLoadingServers] = useState(true);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [scannedAt, setScannedAt] = useState<string | null>(null);
  const [everScanned, setEverScanned] = useState(false);
  const [catalog, setCatalog] = useState<ServiceCatalogItem[]>([]);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<ServiceDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [busyAction, setBusyAction] = useState(false);
  const [output, setOutput] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    setLoadingServers(true);
    api
      .listServers(token)
      .then((srv) => {
        setServers(srv);
        setServerId((cur) => cur ?? srv[0]?.id ?? null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Impossible de charger les serveurs"))
      .finally(() => setLoadingServers(false));
    api
      .serviceCatalog(token)
      .then((cat) => setCatalog(cat.catalog))
      .catch(() => setCatalog([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const loadCached = useCallback(
    async (id: number) => {
      setError("");
      setSelected(null);
      setOutput("");
      try {
        const res = await api.listServices(token, id);
        setServices(res.services);
        setScannedAt(res.scanned_at);
        setEverScanned(res.scanned);
      } catch (err) {
        setServices([]);
        setEverScanned(false);
        setError(err instanceof ApiError ? err.message : "Chargement impossible");
      }
    },
    [token],
  );

  // Charge le dernier scan enregistré quand on change de serveur (sans SSH).
  useEffect(() => {
    if (serverId) loadCached(serverId);
  }, [serverId, loadCached]);

  const rescan = useCallback(
    async (id: number) => {
      setScanning(true);
      setError("");
      setSelected(null);
      setOutput("");
      try {
        const res = await api.scanServices(token, id);
        setServices(res.services);
        setScannedAt(res.scanned_at);
        setEverScanned(true);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Scan impossible");
      } finally {
        setScanning(false);
      }
    },
    [token],
  );

  const openService = async (name: string) => {
    if (!serverId) return;
    setLoadingDetail(true);
    setOutput("");
    try {
      setSelected(await api.getService(token, serverId, name));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Détail indisponible");
    } finally {
      setLoadingDetail(false);
    }
  };

  const refreshDetail = async (name: string) => {
    if (!serverId) return;
    try {
      setSelected(await api.getService(token, serverId, name));
    } catch {
      /* ignore */
    }
  };

  const doAction = async (name: string, action: ActionKind) => {
    if (!serverId) return;
    setBusyAction(true);
    setOutput(`❯ systemctl ${action} ${name}…`);
    try {
      const res = await api.serviceAction(token, serverId, name, action);
      setOutput(`❯ systemctl ${action} ${name}\n${res.output}\n\n→ actif: ${res.active}`);
      await refreshDetail(name);
    } catch (err) {
      setOutput(err instanceof ApiError ? err.message : "Action échouée");
    } finally {
      setBusyAction(false);
    }
  };

  const server = servers.find((s) => s.id === serverId) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return services;
    return services.filter(
      (s) => s.name.toLowerCase().includes(q) || (s.type ?? "").toLowerCase().includes(q),
    );
  }, [services, query]);

  return (
    <>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            <span className="text-primary">#</span> services
          </h1>
          <span className="text-xs text-muted-foreground">{fmtDate(scannedAt)}</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="input-field w-56 text-xs"
            value={serverId ?? ""}
            disabled={loadingServers || servers.length === 0}
            onChange={(e) => setServerId(Number(e.target.value))}
          >
            {loadingServers ? (
              <option value="">Chargement…</option>
            ) : servers.length === 0 ? (
              <option value="">Aucun serveur</option>
            ) : (
              servers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {s.ip_address}
                </option>
              ))
            )}
          </select>
          <button
            type="button"
            className="btn-primary text-xs"
            disabled={!serverId || scanning}
            onClick={() => serverId && rescan(serverId)}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${scanning ? "animate-spin" : ""}`} />
            {scanning ? "Scan…" : everScanned ? "Rescanner" : "Scanner"}
          </button>
        </div>
      </header>

      {error && <p className="mb-3 whitespace-pre-line text-xs text-destructive">{error}</p>}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1fr]">
        <div className="space-y-5">
          <section className="rounded-md border border-border/60 bg-card">
            <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                services{services.length ? ` (${services.length})` : ""}
              </span>
              {services.length > 0 && (
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="filtrer…"
                  className="w-32 bg-transparent text-xs outline-none placeholder:text-muted-foreground/50"
                />
              )}
            </div>
            {scanning ? (
              <p className="px-3 py-8 text-center text-xs text-muted-foreground">
                <span className="cursor-blink">scan en cours</span>
              </p>
            ) : services.length === 0 ? (
              <p className="px-3 py-8 text-center text-xs text-muted-foreground">
                {everScanned
                  ? "Aucun service détecté."
                  : "Aucun scan enregistré — cliquez « Scanner »."}
              </p>
            ) : (
              <div className="divide-y divide-border/40">
                {filtered.map((svc) => (
                  <button
                    key={svc.unit}
                    type="button"
                    onClick={() => openService(svc.name)}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-primary/5 ${
                      selected?.name === svc.name ? "bg-primary/10" : ""
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${stateDot(svc.active, svc.sub)}`} />
                    <span className="min-w-0 flex-1">
                      <span className="font-medium text-foreground">{svc.name}</span>
                      {svc.description && (
                        <span className="ml-2 truncate text-muted-foreground/70">{svc.description}</span>
                      )}
                    </span>
                    <span className="shrink-0 text-[10px] text-muted-foreground/70">{svc.sub}</span>
                    {svc.type && (
                      <span className="shrink-0 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary">
                        {svc.type}
                      </span>
                    )}
                    {svc.ports.length > 0 && (
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                        :{svc.ports.slice(0, 4).join(" :")}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </section>

          <ServiceLibrary
            catalog={catalog}
            token={token}
            serverId={serverId}
            onInstalled={() => serverId && rescan(serverId)}
          />
        </div>

        <div className="rounded-md border border-border/60 bg-card">
          {!selected ? (
            <div className="flex flex-col items-center justify-center px-3 py-16 text-center text-xs text-muted-foreground">
              <Boxes className="mb-3 h-8 w-8 text-muted-foreground/40" />
              Sélectionnez un service pour voir sa configuration et agir dessus.
            </div>
          ) : loadingDetail ? (
            <p className="px-3 py-16 text-center text-xs text-muted-foreground">
              <span className="cursor-blink">chargement</span>
            </p>
          ) : (
            <ServiceDetailPanel
              detail={selected}
              busy={busyAction}
              output={output}
              onAction={(a) => doAction(selected.name, a)}
              token={token}
              serverId={serverId!}
              onDeployed={(o) => setOutput(o)}
              onContainerActed={() => refreshDetail(selected.name)}
            />
          )}
        </div>
      </div>

      {server && (
        <p className="mt-4 text-[10px] text-muted-foreground/60">
          Cible : {server.ssh_username}@{server.ip_address}:{server.ssh_port} · les actions nécessitent les
          droits adéquats (root ou sudo NOPASSWD).
        </p>
      )}
    </>
  );
}

function ServiceDetailPanel({
  detail,
  busy,
  output,
  onAction,
  token,
  serverId,
  onDeployed,
  onContainerActed,
}: {
  detail: ServiceDetail;
  busy: boolean;
  output: string;
  onAction: (a: ActionKind) => void;
  token: string;
  serverId: number;
  onDeployed: (output: string) => void;
  onContainerActed: () => void;
}) {
  const summary = detail.config?.summary ?? {};
  const files = detail.config?.files ?? [];
  const editablePath = detail.config?.editable_path ?? "";
  const containers = detail.config?.containers;

  return (
    <div className="divide-y divide-border/40">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${detail.active === "active" ? "bg-primary" : "bg-destructive"}`} />
          <span className="font-medium text-foreground">{detail.name}</span>
          {detail.type && (
            <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary">{detail.type}</span>
          )}
          <span className="text-[10px] text-muted-foreground">
            {detail.active} · {detail.enabled}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <ActBtn icon={RefreshCw} label="reload" onClick={() => onAction("reload")} disabled={busy} />
          <ActBtn icon={RotateCw} label="restart" onClick={() => onAction("restart")} disabled={busy} />
          <ActBtn icon={Play} label="start" onClick={() => onAction("start")} disabled={busy} />
          <ActBtn icon={Square} label="stop" onClick={() => onAction("stop")} disabled={busy} />
        </div>
      </div>

      {containers && (
        <DockerContainers
          containers={containers}
          token={token}
          serverId={serverId}
          onActed={onContainerActed}
        />
      )}

      {Object.keys(summary).length > 0 && (
        <div className="px-3 py-2.5">
          <p className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">configuration</p>
          <div className="space-y-1.5">
            {Object.entries(summary).map(([key, value]) => (
              <SummaryRow key={key} label={key} value={value} />
            ))}
          </div>
        </div>
      )}

      {files.length > 0 && (
        <div className="px-3 py-2.5">
          <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">fichiers</p>
          {files.map((f) => (
            <p key={f} className="font-mono text-[11px] text-muted-foreground">
              {f}
            </p>
          ))}
        </div>
      )}

      {editablePath && (
        <ConfigDeployer
          token={token}
          serverId={serverId}
          name={detail.name}
          defaultPath={editablePath}
          defaultContent={detail.config?.raw ?? ""}
          testCmd={detail.config?.test_cmd}
          onDeployed={onDeployed}
        />
      )}

      {detail.status && (
        <details className="px-3 py-2.5">
          <summary className="cursor-pointer text-[10px] uppercase tracking-wider text-muted-foreground">
            statut systemd
          </summary>
          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-muted-foreground scroll-hidden">
            {detail.status}
          </pre>
        </details>
      )}

      {output && (
        <div className="px-3 py-2.5">
          <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">sortie</p>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-primary scroll-hidden">
            {output}
          </pre>
        </div>
      )}
    </div>
  );
}

function DockerContainers({
  containers,
  token,
  serverId,
  onActed,
}: {
  containers: DockerContainer[];
  token: string;
  serverId: number;
  onActed: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const act = async (name: string, action: "start" | "stop" | "restart") => {
    setBusy(name + action);
    setMsg("");
    try {
      const res = await api.dockerContainerAction(token, serverId, name, action);
      setMsg(`${name} → ${res.state}`);
      onActed();
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : "Action conteneur échouée");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="px-3 py-2.5">
      <p className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        conteneurs ({containers.length})
      </p>
      <div className="space-y-1">
        {containers.map((c) => (
          <div key={c.name} className="flex items-center gap-2 rounded border border-border/40 px-2 py-1.5">
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                c.state === "running" ? "bg-primary" : c.state === "exited" ? "bg-destructive" : "bg-muted-foreground"
              }`}
            />
            <div className="min-w-0 flex-1">
              <span className="font-mono text-[11px] font-medium text-foreground">{c.name}</span>
              <span className="ml-2 truncate text-[10px] text-muted-foreground/70">{c.image}</span>
              {c.ports && <span className="ml-2 font-mono text-[10px] text-muted-foreground/60">{c.ports}</span>}
            </div>
            <span className="shrink-0 text-[10px] text-muted-foreground">{c.status}</span>
            <div className="flex shrink-0 items-center gap-0.5">
              <button type="button" onClick={() => act(c.name, "start")} disabled={!!busy} className="term-btn" title="start">
                <Play className="h-3 w-3" />
              </button>
              <button type="button" onClick={() => act(c.name, "restart")} disabled={!!busy} className="term-btn" title="restart">
                <RotateCw className="h-3 w-3" />
              </button>
              <button type="button" onClick={() => act(c.name, "stop")} disabled={!!busy} className="term-btn hover:!text-destructive" title="stop">
                <Square className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
      {msg && <p className="mt-1.5 font-mono text-[11px] text-primary">{msg}</p>}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: unknown }) {
  const render = () => {
    if (Array.isArray(value)) {
      if (value.length === 0) return <span className="text-muted-foreground/50">—</span>;
      if (typeof value[0] === "object") {
        return (
          <div className="space-y-0.5">
            {value.map((v, i) => (
              <p key={i} className="font-mono text-[11px] text-foreground">
                {Object.values(v as Record<string, unknown>).join("  ")}
              </p>
            ))}
          </div>
        );
      }
      return (
        <div className="flex flex-wrap gap-1">
          {(value as unknown[]).map((v, i) => (
            <span key={i} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
              {String(v)}
            </span>
          ))}
        </div>
      );
    }
    return <span className="font-mono text-[11px] text-foreground">{String(value)}</span>;
  };
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      {render()}
    </div>
  );
}

function ActBtn({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: typeof RefreshCw;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="term-btn" title={label}>
      <Icon className="h-3 w-3" /> {label}
    </button>
  );
}

function ConfigDeployer({
  token,
  serverId,
  name,
  defaultPath,
  defaultContent,
  testCmd,
  onDeployed,
}: {
  token: string;
  serverId: number;
  name: string;
  defaultPath: string;
  defaultContent: string;
  testCmd?: string;
  onDeployed: (output: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [path, setPath] = useState(defaultPath);
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);

  const deploy = async () => {
    if (!content.trim()) return;
    if (!confirm(`Déployer la configuration sur ${path} puis recharger ${name} ?`)) return;
    setBusy(true);
    try {
      const res = await api.deployServiceConfig(token, serverId, name, path, content);
      onDeployed(
        `❯ déploiement ${res.path}\n${res.test_output || "(pas de test)"}\n${res.reload_output}\n\n→ actif: ${res.active}`,
      );
    } catch (err) {
      onDeployed(err instanceof ApiError ? err.message : "Déploiement échoué");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-3 py-2.5">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open && !content) setContent(defaultContent);
        }}
        className="text-[10px] uppercase tracking-wider text-primary hover:underline"
      >
        {open ? "▾" : "▸"} déployer une configuration
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <input
            value={path}
            onChange={(e) => setPath(e.target.value)}
            className="input-field font-mono text-xs"
            placeholder="/etc/nginx/conf.d/monsite.conf"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="input-field min-h-[180px] font-mono text-[11px]"
            placeholder="Contenu du fichier de configuration…"
            spellCheck={false}
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">
              {testCmd ? `validé par « ${testCmd} » avant reload` : "reload après écriture"} · sauvegarde .bak créée
            </span>
            <button type="button" onClick={deploy} disabled={busy} className="btn-primary text-xs">
              <Download className="h-3.5 w-3.5" />
              {busy ? "Déploiement…" : "Déployer & recharger"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ServiceLibrary({
  catalog,
  token,
  serverId,
  onInstalled,
}: {
  catalog: ServiceCatalogItem[];
  token: string;
  serverId: number | null;
  onInstalled: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [result, setResult] = useState<{ id: string; text: string } | null>(null);

  const install = async (id: string) => {
    if (!serverId) return;
    if (!confirm(`Installer « ${id} » sur ce serveur ?`)) return;
    setBusyId(id);
    setResult(null);
    try {
      const res = await api.installService(token, serverId, id);
      setResult({ id, text: res.already_installed ? "Déjà installé." : res.output });
      onInstalled();
    } catch (err) {
      setResult({ id, text: err instanceof ApiError ? err.message : "Installation échouée" });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="rounded-md border border-border/60 bg-card">
      <div className="border-b border-border/60 px-3 py-2">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          bibliothèque · installer un service
        </span>
      </div>
      <div className="divide-y divide-border/40">
        {catalog.map((item) => (
          <div key={item.id} className="px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="text-xs font-medium text-foreground">{item.label}</span>
                <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {item.kind}
                </span>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{item.description}</p>
              </div>
              <button
                type="button"
                onClick={() => install(item.id)}
                disabled={!serverId || busyId === item.id}
                className="term-btn shrink-0 !text-primary hover:bg-primary/10"
                title={serverId ? "Installer" : "Sélectionnez un serveur"}
              >
                <Download className={`h-3 w-3 ${busyId === item.id ? "animate-pulse" : ""}`} />
                {busyId === item.id ? "install…" : "installer"}
              </button>
            </div>
            {result?.id === item.id && (
              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-primary scroll-hidden">
                {result.text}
              </pre>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

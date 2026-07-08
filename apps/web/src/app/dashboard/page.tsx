"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ServerCrash } from "lucide-react";
import { ServerDrawer, type ServerPanel } from "@/components/datacenter/ServerDrawer";
import { useTerminal } from "@/components/terminal/TerminalContext";
import { AddServerModal } from "@/components/AddServerModal";
import { ServerTable } from "@/components/ServerTable";
import { api, type Datacenter, type Server } from "@/lib/api";
import { getToken } from "@/lib/auth";

export default function DashboardPage() {
  return (
    <Suspense fallback={<Booting />}>
      <DashboardInner />
    </Suspense>
  );
}

function Booting() {
  return (
    <div className="flex justify-center py-24">
      <span className="cursor-blink text-sm text-primary">chargement</span>
    </div>
  );
}

function DashboardInner() {
  const token = getToken()!;
  const searchParams = useSearchParams();
  const [servers, setServers] = useState<Server[]>([]);
  const [datacenters, setDatacenters] = useState<Datacenter[]>([]);
  const [providers, setProviders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [panel, setPanel] = useState<ServerPanel>(null);
  const [query, setQuery] = useState("");
  const terminal = useTerminal();

  useEffect(() => {
    setQuery(searchParams.get("q") ?? "");
  }, [searchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [serverList, providerList, dcList] = await Promise.all([
        api.listServers(token),
        api.providers(token),
        api.listDatacenters(token),
      ]);
      setServers(serverList);
      setProviders(providerList.providers);
      setDatacenters(dcList);
      setPanel((prev) => {
        if (!prev) return null;
        const updated = serverList.find((s) => s.id === prev.server.id);
        return updated ? { ...prev, server: updated } : null;
      });
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const sync = async (id: number) => {
    setSyncingId(id);
    try {
      const { server } = await api.syncServer(token, id);
      setServers((prev) => prev.map((s) => (s.id === id ? server : s)));
      setPanel((prev) => (prev?.server.id === id ? { ...prev, server } : prev));
    } catch {
      await load();
    } finally {
      setSyncingId(null);
    }
  };

  const remove = async (id: number) => {
    if (!confirm("Supprimer ce serveur ?")) return;
    await api.deleteServer(token, id);
    setServers((prev) => prev.filter((s) => s.id !== id));
    setPanel((prev) => (prev?.server.id === id ? null : prev));
  };

  const onlineCount = servers.filter((s) => s.status === "online").length;
  const offlineCount = servers.filter((s) => s.status === "offline").length;

  const dcNameById = useMemo(() => {
    const m = new Map<number, string>();
    for (const d of datacenters) m.set(d.id, d.name);
    return m;
  }, [datacenters]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return servers;
    return servers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.ip_address.toLowerCase().includes(q) ||
        s.provider.toLowerCase().includes(q) ||
        (s.os_info ?? "").toLowerCase().includes(q),
    );
  }, [servers, query]);

  return (
    <>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            <span className="text-primary">#</span> serveurs
          </h1>
          <span className="text-xs text-muted-foreground">
            {servers.length} total · <span className="text-primary">{onlineCount}</span> online ·{" "}
            <span className={offlineCount ? "text-destructive" : ""}>{offlineCount}</span> offline
          </span>
        </div>
        <AddServerModal token={token} providers={providers} onCreated={load} />
      </header>

      <div className="mb-3 flex items-center gap-2">
        <span className="text-xs text-muted-foreground">filter ❯</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="nom, ip, provider, os…"
          className="w-full max-w-sm bg-transparent font-mono text-xs text-foreground placeholder:text-muted-foreground/60 outline-none border-b border-border/60 pb-1 focus:border-primary/60"
        />
        {query && (
          <span className="text-xs text-muted-foreground">
            {filtered.length}/{servers.length}
          </span>
        )}
      </div>

      {loading && servers.length === 0 ? (
        <Booting />
      ) : servers.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border py-20 text-center">
          <ServerCrash className="mb-3 h-9 w-9 text-muted-foreground/40" />
          <h2 className="text-base font-medium text-foreground">Aucun serveur</h2>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            Ajoutez votre premier serveur, ou tapez <span className="text-primary">help</span> dans la barre du bas.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-16 text-center text-xs text-muted-foreground">
          aucun résultat pour « <span className="text-foreground">{query}</span> »
        </p>
      ) : (
        <ServerTable
          servers={filtered}
          token={token}
          providers={providers}
          syncingId={syncingId}
          dcNameById={dcNameById}
          onSync={sync}
          onDelete={remove}
          onUpdated={load}
              onOpenInfo={(s) => setPanel({ server: s, mode: "info" })}
              onOpenTerminal={(s) => terminal.open(s, "docked")}
        />
      )}

      <ServerDrawer
        panel={panel}
        token={token}
        providers={providers}
        onClose={() => setPanel(null)}
        onUpdated={load}
        onSync={sync}
        syncing={panel ? syncingId === panel.server.id : false}
      />
    </>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Cloud, HardDrive, MapPin, RefreshCw } from "lucide-react";
import { CloudServerGrid, UnplacedServers } from "@/components/datacenter/CloudServerGrid";
import { CloudSyncPanel } from "@/components/datacenter/CloudSyncPanel";
import { CreateDatacenterModal } from "@/components/datacenter/CreateDatacenterModal";
import { DeleteDatacenterButton } from "@/components/datacenter/DeleteDatacenterButton";
import { CreateRackModal } from "@/components/datacenter/CreateRackModal";
import { RackColumn } from "@/components/datacenter/RackColumn";
import { ServerDrawer, type ServerPanel } from "@/components/datacenter/ServerDrawer";
import { useTerminal } from "@/components/terminal/TerminalContext";
import { api, ApiError, type DatacenterInventory, type Inventory, type Server } from "@/lib/api";
import { getToken } from "@/lib/auth";

export default function DatacentersPage() {
  const token = getToken()!;
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [providers, setProviders] = useState<string[]>([]);
  const [selectedDcId, setSelectedDcId] = useState<number | "unassigned" | null>(null);
  const [panel, setPanel] = useState<ServerPanel>(null);
  const terminal = useTerminal();
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [uZoom, setUZoom] = useState<"fit" | number>("fit");
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);

  const selectedDcIdRef = useRef(selectedDcId);
  const hasInitializedDc = useRef(false);

  useEffect(() => {
    selectedDcIdRef.current = selectedDcId;
  }, [selectedDcId]);

  const showToast = (msg: string, type: "error" | "success" = "success") => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const openInfo = (server: Server) => setPanel({ server, mode: "info" });
  const openTerminal = (server: Server) => terminal.open(server, "docked");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [inv, prov] = await Promise.all([api.getInventory(token), api.providers(token)]);
      setInventory(inv);
      setProviders(prov.providers);

      if (!hasInitializedDc.current && inv.datacenters.length > 0) {
        hasInitializedDc.current = true;
        if (selectedDcIdRef.current === null) {
          const firstCustom = inv.datacenters.find((d) => d.type === "custom");
          setSelectedDcId(firstCustom?.id ?? inv.datacenters[0].id);
        }
      }

      setPanel((prev) => {
        if (!prev) return null;
        const all = [
          ...inv.unassigned_servers,
          ...inv.datacenters.flatMap((d) => [...d.servers, ...d.racks.flatMap((r) => r.servers)]),
        ];
        const updated = all.find((s) => s.id === prev.server.id);
        return updated ? { ...prev, server: updated } : null;
      });
    } finally {
      setLoading(false);
    }
  }, [token]);

  const moveServer = async (
    serverId: number,
    target: { datacenterId: number; rackId: number | null; rackU: number | null },
  ) => {
    try {
      await api.updateServerPlacement(token, serverId, {
        datacenter_id: target.datacenterId,
        rack_id: target.rackId,
        rack_u: target.rackU,
      });
      await load();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Impossible de déplacer le serveur", "error");
      throw err;
    }
  };

  const resizeServer = async (server: Server, units: number, rackU: number) => {
    try {
      await api.updateServerPlacement(token, server.id, {
        datacenter_id: server.datacenter_id,
        rack_id: server.rack_id,
        rack_u: rackU,
        rack_units: units,
      });
      await load();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Redimensionnement impossible", "error");
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sync = async (id: number) => {
    setSyncingId(id);
    try {
      const { server } = await api.syncServer(token, id);
      setPanel((prev) => (prev?.server.id === id ? { ...prev, server } : prev));
      await load();
    } finally {
      setSyncingId(null);
    }
  };

  const selectedDc: DatacenterInventory | null =
    selectedDcId && selectedDcId !== "unassigned"
      ? inventory?.datacenters.find((d) => d.id === selectedDcId) ?? null
      : null;

  const cloudDcs = inventory?.datacenters.filter((d) => d.type === "cloud") ?? [];
  const customDcs = inventory?.datacenters.filter((d) => d.type === "custom") ?? [];
  const activeServerId = panel?.server.id ?? terminal.session?.server.id ?? null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="mb-5 flex shrink-0 items-end justify-between">
        <div>
          <p className="label mb-1">Infrastructure</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Datacenters</h1>
        </div>
        <button type="button" onClick={load} className="btn-ghost text-xs">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Actualiser
        </button>
      </header>

      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`fixed bottom-6 right-6 z-50 rounded-lg border px-4 py-3 text-sm shadow-xl ${
            toast.type === "error"
              ? "border-destructive/30 bg-card text-destructive"
              : "border-primary/30 bg-card text-foreground"
          }`}
        >
          {toast.message}
        </motion.div>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row lg:items-stretch">
        <aside className="flex w-full shrink-0 flex-col rounded-xl border border-border/80 bg-card p-3 lg:sticky lg:top-[3.75rem] lg:w-52">
          <p className="label mb-2">Cloud</p>
          <div className="mb-4 space-y-0.5">
            {cloudDcs.map((dc) => (
              <DcButton
                key={dc.id}
                active={selectedDcId === dc.id}
                onClick={() => {
                  setSelectedDcId(dc.id);
                  setPanel(null);
                }}
                icon={Cloud}
                label={dc.name}
                sub={dc.provider ?? undefined}
              />
            ))}
          </div>

          <p className="label mb-2">On-premise</p>
          <div className="mb-4 flex-1 space-y-0.5">
            {customDcs.map((dc) => (
              <DcButton
                key={dc.id}
                active={selectedDcId === dc.id}
                onClick={() => {
                  setSelectedDcId(dc.id);
                  setPanel(null);
                }}
                icon={HardDrive}
                label={dc.name}
                sub={dc.location ?? `${dc.racks.length} baie(s)`}
              />
            ))}
          </div>

          {(inventory?.unassigned_servers.length ?? 0) > 0 && (
            <button
              type="button"
              onClick={() => {
                setSelectedDcId("unassigned");
                setPanel(null);
              }}
              className={`mb-3 w-full rounded-lg px-3 py-2 text-left text-xs transition-colors ${
                selectedDcId === "unassigned" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent"
              }`}
            >
              Non assignés · {inventory?.unassigned_servers.length}
            </button>
          )}

          <CreateDatacenterModal token={token} onCreated={load} />
        </aside>

        <main className="dot-grid flex min-h-0 min-w-0 flex-1 flex-col rounded-xl border border-border/80 bg-card/50 p-5">
          {loading && !inventory ? (
            <div className="flex h-full items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : selectedDcId === "unassigned" ? (
            <UnplacedServers
              servers={inventory?.unassigned_servers ?? []}
              activeServerId={activeServerId}
              onOpenInfo={openInfo}
              onOpenTerminal={openTerminal}
              draggable
            />
          ) : selectedDc ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="mb-6 flex shrink-0 flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-foreground">{selectedDc.name}</h2>
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    {selectedDc.type === "cloud" ? (
                      <span className="flex items-center gap-1">
                        <Cloud className="h-3 w-3" /> {selectedDc.provider}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <HardDrive className="h-3 w-3" /> On-premise
                      </span>
                    )}
                    {selectedDc.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {selectedDc.location}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {selectedDc.type === "custom" && selectedDc.racks.length > 0 && (
                    <div className="flex items-center gap-0.5 rounded-md border border-border/60 p-0.5 text-xs">
                      <span className="px-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">U</span>
                      {([["fit", "Ajuster"], [26, "M"], [40, "L"], [56, "XL"]] as const).map(([v, label]) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => setUZoom(v)}
                          className={`rounded px-2 py-1 transition-colors ${
                            uZoom === v ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedDc.type === "custom" && (
                    <CreateRackModal token={token} datacenterId={selectedDc.id} onCreated={load} />
                  )}
                  <DeleteDatacenterButton
                    token={token}
                    datacenter={selectedDc}
                    onDeleted={() => {
                      setSelectedDcId(null);
                      setPanel(null);
                      load();
                    }}
                    onError={(msg) => showToast(msg, "error")}
                  />
                </div>
              </div>

              {selectedDc.type === "cloud" ? (
                <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                  <CloudSyncPanel key={selectedDc.id} token={token} datacenter={selectedDc} onUpdated={load} onMessage={showToast} />
                  <CloudServerGrid
                    servers={selectedDc.servers}
                    activeServerId={activeServerId}
                    onOpenInfo={openInfo}
                    onOpenTerminal={openTerminal}
                    provider={selectedDc.provider}
                  />
                </div>
              ) : selectedDc.racks.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
                  <HardDrive className="mb-3 h-10 w-10 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">Créez une baie pour commencer</p>
                </div>
              ) : (
                <div
                  className="flex min-h-0 flex-1 flex-col"
                  onDragStartCapture={() => setDragging(true)}
                  onDragEndCapture={() => setDragging(false)}
                  onDropCapture={() => setDragging(false)}
                >
                  <div
                    className={`scroll-hidden -mx-1 flex min-h-0 flex-1 items-start gap-5 px-1 pb-1 ${
                      uZoom === "fit" ? "overflow-x-auto" : "overflow-auto"
                    }`}
                  >
                    {selectedDc.racks.map((rack, i) => (
                      <motion.div
                        key={rack.id}
                        className={uZoom === "fit" ? "h-full" : ""}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.04 }}
                      >
                        <RackColumn
                          datacenterId={selectedDc.id}
                          rack={rack}
                          activeServerId={activeServerId}
                          dragging={dragging}
                          uPxFixed={uZoom === "fit" ? undefined : uZoom}
                          onOpenInfo={openInfo}
                          onMoveServer={moveServer}
                          onResizeServer={resizeServer}
                        />
                      </motion.div>
                    ))}
                  </div>
                  {(dragging || selectedDc.servers.length > 0) && (
                    <UnplacedServers
                      servers={selectedDc.servers}
                      activeServerId={activeServerId}
                      onOpenInfo={openInfo}
                      onOpenTerminal={openTerminal}
                      label="Hors baie"
                      datacenterId={selectedDc.id}
                      draggable
                      onMoveServer={moveServer}
                    />
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <MapPin className="mb-3 h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Créez un datacenter pour commencer</p>
            </div>
          )}
        </main>
      </div>

      <ServerDrawer
        panel={panel}
        token={token}
        providers={providers}
        onClose={() => setPanel(null)}
        onUpdated={load}
        onSync={sync}
        syncing={panel ? syncingId === panel.server.id : false}
      />
    </div>
  );
}

function DcButton({
  active,
  onClick,
  icon: Icon,
  label,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  sub?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-all duration-150 ${
        active
          ? "bg-primary/10 text-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      }`}
    >
      <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${active ? "text-primary" : ""}`} />
      <div className="min-w-0">
        <p className="truncate text-xs font-medium">{label}</p>
        {sub && <p className="truncate text-[10px] text-muted-foreground">{sub}</p>}
      </div>
    </button>
  );
}

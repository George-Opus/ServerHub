"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Cpu, HardDrive, MemoryStick, RefreshCw, Terminal as TerminalIcon, X } from "lucide-react";
import { ProviderBadge, StatusDot } from "../badges";
import { EditServerModal } from "../EditServerModal";
import { useTerminal } from "../terminal/TerminalContext";
import type { Server } from "@/lib/api";

export type ServerPanel = { server: Server; mode: "info" } | null;

type Props = {
  panel: ServerPanel;
  token: string;
  providers: string[];
  onClose: () => void;
  onUpdated: () => void;
  onSync: (id: number) => Promise<void>;
  syncing?: boolean;
};

export function ServerDrawer({ panel, token, providers, onClose, onUpdated, onSync, syncing }: Props) {
  const terminal = useTerminal();

  useEffect(() => {
    if (!panel) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel, onClose]);

  return (
    <AnimatePresence>
      {panel && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] bg-black/50"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 34, stiffness: 380 }}
            className="fixed inset-y-0 right-0 z-[160] flex w-full max-w-md flex-col border-l border-border bg-card shadow-2xl"
          >
            <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-lg font-semibold tracking-tight">{panel.server.name}</h2>
                  <ProviderBadge provider={panel.server.provider} />
                </div>
                <p className="font-mono text-xs text-muted-foreground">
                  {panel.server.ssh_username}@{panel.server.ip_address}:{panel.server.ssh_port}
                </p>
                <div className="mt-2">
                  <StatusDot status={panel.server.status} />
                </div>
              </div>
              <button type="button" onClick={onClose} className="btn-icon" aria-label="Fermer">
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="scroll-hidden flex-1 overflow-y-auto p-5">
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  <Stat icon={MemoryStick} label="RAM" value={panel.server.memory_total ?? "—"} />
                  <Stat icon={HardDrive} label="Disque" value={panel.server.disk_total ?? "—"} />
                  <Stat icon={Cpu} label="CPU" value={panel.server.cpu_count != null ? `${panel.server.cpu_count}` : "—"} />
                  <Stat icon={Cpu} label="OS" value={panel.server.os_info ?? "—"} small />
                </div>

                {(panel.server.rack_u || panel.server.datacenter_id) && (
                  <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
                    <p className="label mb-1">Emplacement</p>
                    <p className="text-sm">
                      {panel.server.rack_u
                        ? `Baie · U${panel.server.rack_u}${(panel.server.rack_units ?? 1) > 1 ? `–${panel.server.rack_u + (panel.server.rack_units ?? 1) - 1} (${panel.server.rack_units}U)` : ""}`
                        : "Datacenter assigné"}
                    </p>
                  </div>
                )}

                {panel.server.notes && (
                  <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
                    <p className="label mb-1">Notes</p>
                    <p className="text-sm text-muted-foreground">{panel.server.notes}</p>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onSync(panel.server.id)}
                    disabled={syncing}
                    className="btn-primary text-xs"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
                    Sync
                  </button>
                  <EditServerModal token={token} server={panel.server} providers={providers} onUpdated={onUpdated} />
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      terminal.open(panel.server, "docked");
                    }}
                    className="btn-ghost text-xs"
                  >
                    <TerminalIcon className="h-3.5 w-3.5" />
                    Terminal
                  </button>
                </div>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  small,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 px-3 py-3">
      <Icon className="mb-2 h-4 w-4 text-primary/70" />
      <p className="label mb-0.5">{label}</p>
      <p className={`font-medium ${small ? "text-xs line-clamp-2" : "text-sm"}`}>{value}</p>
    </div>
  );
}

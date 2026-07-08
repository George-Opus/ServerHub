"use client";

import type { ComponentType } from "react";
import { motion } from "framer-motion";
import { Cpu, HardDrive, Info, MemoryStick, RefreshCw, Terminal, Trash2 } from "lucide-react";
import { ProviderBadge, StatusDot } from "./badges";
import type { Server as ServerType } from "@/lib/api";
import { EditServerModal } from "./EditServerModal";

type Props = {
  server: ServerType;
  token: string;
  providers?: string[];
  onSync: (id: number) => void;
  onDelete: (id: number) => void;
  onUpdated: () => void;
  onOpenInfo?: (server: ServerType) => void;
  onOpenTerminal?: (server: ServerType) => void;
  syncing?: boolean;
  index?: number;
};

export function ServerCard({
  server,
  token,
  providers,
  onSync,
  onDelete,
  onUpdated,
  onOpenInfo,
  onOpenTerminal,
  syncing,
  index = 0,
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      className="group relative overflow-hidden rounded-xl border border-border/80 bg-card p-5 transition-all duration-200 hover:border-primary/25"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold tracking-tight text-foreground">{server.name}</h3>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">{server.ip_address}</p>
        </div>
        <ProviderBadge provider={server.provider} />
      </div>

      <StatusDot status={server.status} />

      {server.os_info && (
        <p className="mt-3 truncate text-xs text-muted-foreground">{server.os_info}</p>
      )}

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Stat icon={MemoryStick} label="RAM" value={server.memory_total ?? "—"} />
        <Stat icon={HardDrive} label="Disk" value={server.disk_total ?? "—"} />
        <Stat icon={Cpu} label="CPU" value={server.cpu_count != null ? `${server.cpu_count}` : "—"} />
      </div>

      <div className="mt-4 flex gap-2 border-t border-border/60 pt-4 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        {onOpenInfo ? (
          <button type="button" onClick={() => onOpenInfo(server)} className="btn-ghost flex-1 text-xs">
            <Info className="h-3.5 w-3.5" />
            Infos
          </button>
        ) : (
          <EditServerModal token={token} server={server} providers={providers} onUpdated={onUpdated} triggerClassName="btn-ghost flex-1 text-xs" />
        )}
        <button type="button" onClick={() => onSync(server.id)} disabled={syncing} className="btn-ghost text-xs">
          <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
        </button>
        {onOpenTerminal ? (
          <button type="button" onClick={() => onOpenTerminal(server)} className="btn-primary flex-1 text-xs">
            <Terminal className="h-3.5 w-3.5" />
            Terminal
          </button>
        ) : (
          <a href={`/dashboard/servers/${server.id}`} className="btn-primary flex-1 text-xs">
            <Terminal className="h-3.5 w-3.5" />
            Terminal
          </a>
        )}
        <button
          type="button"
          onClick={() => onDelete(server.id)}
          className="btn-icon text-destructive hover:bg-destructive/10"
          aria-label="Supprimer"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg bg-muted/40 px-2 py-2 text-center">
      <Icon className="mx-auto mb-1 h-3 w-3 text-muted-foreground" />
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="truncate font-mono text-[11px] font-medium text-foreground" title={value}>
        {value}
      </p>
    </div>
  );
}

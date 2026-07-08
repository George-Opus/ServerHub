"use client";

import { motion } from "framer-motion";
import { GripVertical } from "lucide-react";
import { StatusDot } from "../badges";
import type { Server } from "@/lib/api";

export type ServerActionHandlers = {
  onOpenInfo: (server: Server) => void;
  onOpenTerminal: (server: Server) => void;
};

type TileProps = ServerActionHandlers & {
  server: Server;
  variant: "tile";
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent, server: Server) => void;
  active?: boolean;
  subtitle?: string;
};

type ChipProps = ServerActionHandlers & {
  server: Server;
  variant: "chip";
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent, server: Server) => void;
  active?: boolean;
};

type Props = TileProps | ChipProps;

export function ServerActions(props: Props) {
  const { server, onOpenInfo, draggable, onDragStart, active } = props;

  const statusClass =
    server.status === "online"
      ? "border-emerald-500/30 bg-emerald-500/10"
      : server.status === "offline"
        ? "border-red-500/30 bg-red-500/10"
        : "border-border bg-muted/50";

  if (props.variant === "chip") {
    return (
      <button
        type="button"
        draggable={draggable}
        onDragStart={draggable && onDragStart ? (e) => onDragStart(e, server) : undefined}
        onClick={() => onOpenInfo(server)}
        className={`group/server flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all duration-200 ${statusClass} ${
          draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
        } ${active ? "ring-1 ring-primary/60" : "hover:brightness-110"}`}
      >
        {draggable && <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50" />}
        <StatusDot status={server.status} />
        <span className="text-sm font-medium text-foreground">{server.name}</span>
      </button>
    );
  }

  // tile
  const { subtitle } = props;
  return (
    <motion.button
      type="button"
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => onOpenInfo(server)}
      className={`group/server relative w-full overflow-hidden rounded-xl border p-4 text-left transition-all duration-200 ${statusClass} ${
        active ? "ring-1 ring-primary/50" : "hover:border-primary/40 hover:brightness-110"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold tracking-tight text-foreground">{server.name}</p>
          <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">{server.ip_address}</p>
        </div>
        <StatusDot status={server.status} />
      </div>
      {subtitle && <p className="mt-3 truncate text-xs text-muted-foreground">{subtitle}</p>}
      <p className="mt-3 text-[10px] uppercase tracking-widest text-muted-foreground/60 opacity-0 transition-opacity group-hover/server:opacity-100">
        clic → détails &amp; terminal
      </p>
    </motion.button>
  );
}

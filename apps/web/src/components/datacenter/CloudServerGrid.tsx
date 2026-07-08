"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Cloud, HardDrive } from "lucide-react";
import { getServerDragData, setServerDragData } from "./dnd";
import { ServerActions, type ServerActionHandlers } from "./ServerActions";
import type { Server } from "@/lib/api";

type Props = ServerActionHandlers & {
  servers: Server[];
  activeServerId: number | null;
  provider?: string | null;
};

export function CloudServerGrid({ servers, activeServerId, onOpenInfo, onOpenTerminal, provider }: Props) {
  if (servers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Cloud className="mb-3 h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Aucun serveur dans ce cloud</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {servers.map((server, i) => (
        <motion.div
          key={server.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.03, duration: 0.25 }}
        >
          <ServerActions
            variant="tile"
            server={server}
            onOpenInfo={onOpenInfo}
            onOpenTerminal={onOpenTerminal}
            active={activeServerId === server.id}
            subtitle={provider ? `${provider}${server.os_info ? ` · ${server.os_info}` : ""}` : server.os_info ?? undefined}
          />
        </motion.div>
      ))}
    </div>
  );
}

type UnplacedProps = ServerActionHandlers & {
  servers: Server[];
  activeServerId: number | null;
  label?: string;
  datacenterId?: number;
  draggable?: boolean;
  onMoveServer?: (serverId: number, target: { datacenterId: number; rackId: null; rackU: null }) => Promise<void>;
};

export function UnplacedServers({
  servers,
  activeServerId,
  onOpenInfo,
  onOpenTerminal,
  label = "Non assignés",
  datacenterId,
  draggable = false,
  onMoveServer,
}: UnplacedProps) {
  const [dragOver, setDragOver] = useState(false);
  const [moving, setMoving] = useState(false);

  if (servers.length === 0 && !datacenterId) return null;

  const startDrag = (e: React.DragEvent, server: Server) => {
    setServerDragData(e, {
      serverId: server.id,
      datacenterId: server.datacenter_id,
      rackId: server.rack_id,
      rackU: server.rack_u,
    });
  };

  const handleDrop = async (e: React.DragEvent) => {
    if (!datacenterId || !onMoveServer) return;
    e.preventDefault();
    setDragOver(false);
    const payload = getServerDragData(e);
    if (!payload || moving) return;
    setMoving(true);
    try {
      await onMoveServer(payload.serverId, { datacenterId, rackId: null, rackU: null });
    } finally {
      setMoving(false);
    }
  };

  const dropZone = Boolean(datacenterId && onMoveServer);

  return (
    <div className="mt-3 shrink-0 border-t border-border/60 pt-3">
      <div className="mb-2 flex items-center gap-2">
        <HardDrive className="h-3.5 w-3.5 text-muted-foreground" />
        <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{label}</h3>
      </div>

      {draggable || dropZone ? (
        <div
          className={`flex min-h-[48px] flex-wrap gap-2 rounded-xl border border-dashed p-3 transition-colors ${
            dragOver ? "border-primary/40 bg-primary/5" : "border-border/60"
          }`}
          onDragOver={
            dropZone
              ? (e) => {
                  e.preventDefault();
                  setDragOver(true);
                }
              : undefined
          }
          onDragLeave={() => setDragOver(false)}
          onDrop={dropZone ? handleDrop : undefined}
        >
          {servers.length === 0 ? (
            <p className="w-full py-2 text-center text-xs text-muted-foreground">Déposer pour retirer de la baie</p>
          ) : (
            servers.map((server) => (
              <ServerActions
                key={server.id}
                variant="chip"
                server={server}
                draggable={draggable}
                onDragStart={startDrag}
                onOpenInfo={onOpenInfo}
                onOpenTerminal={onOpenTerminal}
                active={activeServerId === server.id}
              />
            ))
          )}
        </div>
      ) : (
        <CloudServerGrid
          servers={servers}
          activeServerId={activeServerId}
          onOpenInfo={onOpenInfo}
          onOpenTerminal={onOpenTerminal}
        />
      )}
    </div>
  );
}

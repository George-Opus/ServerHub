"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { GripVertical } from "lucide-react";
import { getServerDragData, getActiveDrag, setServerDragData, clearServerDrag } from "./dnd";
import { canPlaceAt, serverUnits } from "./rackPlacement";
import type { RackWithServers, Server } from "@/lib/api";

const MIN_U_PX = 9;
const GAP = 1;

type MoveTarget = {
  datacenterId: number;
  rackId: number | null;
  rackU: number | null;
};

type Props = {
  datacenterId: number;
  rack: RackWithServers;
  activeServerId: number | null;
  dragging?: boolean;
  uPxFixed?: number;
  onOpenInfo: (server: Server) => void;
  onMoveServer: (serverId: number, target: MoveTarget) => Promise<void>;
  onResizeServer: (server: Server, units: number, rackU: number) => Promise<void>;
};

export function RackColumn({
  datacenterId,
  rack,
  activeServerId,
  dragging = false,
  uPxFixed,
  onOpenInfo,
  onMoveServer,
  onResizeServer,
}: Props) {
  const [dragOverU, setDragOverU] = useState<number | null>(null);
  const [dragOverPool, setDragOverPool] = useState(false);
  const [moving, setMoving] = useState(false);
  const [resizing, setResizing] = useState<{ serverId: number; units: number; rackU: number } | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [computedUPx, setComputedUPx] = useState(24);
  const resizingRef = useRef(false);

  const fitMode = uPxFixed == null;
  const uPx = fitMode ? computedUPx : uPxFixed;

  const slots = Array.from({ length: rack.capacity_u }, (_, i) => rack.capacity_u - i);
  const placed = rack.servers.filter((s) => s.rack_u);
  const unplaced = rack.servers.filter((s) => !s.rack_u);

  // En mode "Ajuster", calcule la hauteur d'un U pour que toute la baie tienne dans l'espace visible.
  useEffect(() => {
    if (!fitMode) return;
    const el = frameRef.current;
    if (!el) return;
    const compute = () => {
      const styles = getComputedStyle(el);
      const padY = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
      const inner = el.clientHeight - padY - (rack.capacity_u - 1) * GAP;
      setComputedUPx(Math.max(MIN_U_PX, inner / rack.capacity_u));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [rack.capacity_u, fitMode]);

  const effUnits = (s: Server) =>
    resizing?.serverId === s.id ? resizing.units : serverUnits(s);
  const effRackU = (s: Server) =>
    resizing?.serverId === s.id ? resizing.rackU : s.rack_u!;

  // Carte des U occupés en tenant compte de l'aperçu de redimensionnement.
  const ownerAt = new Map<number, Server>();
  const topUof = new Map<number, number>();
  for (const s of placed) {
    if (!s.rack_u) continue;
    const eu = effUnits(s);
    const ru = effRackU(s);
    topUof.set(s.id, ru + eu - 1);
    for (let k = 0; k < eu; k++) ownerAt.set(ru + k, s);
  }

  const handleDrop = async (e: React.DragEvent, target: MoveTarget) => {
    e.preventDefault();
    setDragOverU(null);
    setDragOverPool(false);
    const payload = getServerDragData(e);
    if (!payload || moving) return;
    setMoving(true);
    try {
      await onMoveServer(payload.serverId, target);
    } finally {
      setMoving(false);
    }
  };

  const startDrag = (e: React.DragEvent, server: Server) => {
    if (resizingRef.current) {
      e.preventDefault();
      return;
    }
    setServerDragData(e, {
      serverId: server.id,
      datacenterId: server.datacenter_id,
      rackId: server.rack_id,
      rackU: server.rack_u,
      rackUnits: serverUnits(server),
    });
    e.currentTarget.addEventListener("dragend", () => clearServerDrag(), { once: true });
  };

  const canDropAt = (u: number, dragUnits: number, excludeId?: number) =>
    canPlaceAt(placed, u, dragUnits, rack.capacity_u, excludeId);

  const beginResize = (e: React.PointerEvent, server: Server, edge: "top" | "bottom") => {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = true;
    const startY = e.clientY;
    const startUnits = serverUnits(server);
    const baseU = server.rack_u!;
    const topFixed = baseU + startUnits - 1;
    setResizing({ serverId: server.id, units: startUnits, rackU: baseU });

    const onMove = (ev: PointerEvent) => {
      if (edge === "top") {
        // Le bas reste fixe (baseU), on étend vers le haut.
        const delta = Math.round((startY - ev.clientY) / (uPx + GAP));
        let units = Math.max(1, startUnits + delta);
        units = Math.min(units, rack.capacity_u - (baseU - 1));
        while (units > 1 && !canPlaceAt(placed, baseU, units, rack.capacity_u, server.id)) units--;
        setResizing({ serverId: server.id, units, rackU: baseU });
      } else {
        // Le haut reste fixe (topFixed), on étend vers le bas (rackU diminue).
        const delta = Math.round((ev.clientY - startY) / (uPx + GAP));
        let ru = Math.min(topFixed, Math.max(1, baseU - delta));
        let units = topFixed - ru + 1;
        while (units > 1 && !canPlaceAt(placed, ru, units, rack.capacity_u, server.id)) {
          ru++;
          units = topFixed - ru + 1;
        }
        setResizing({ serverId: server.id, units, rackU: ru });
      }
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setResizing((cur) => {
        if (cur && (cur.units !== startUnits || cur.rackU !== baseU)) {
          void onResizeServer(server, cur.units, cur.rackU);
        }
        return null;
      });
      setTimeout(() => {
        resizingRef.current = false;
      }, 0);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <motion.div layout className={`flex w-[212px] shrink-0 flex-col ${fitMode ? "h-full" : ""}`}>
      <div className="mb-2 shrink-0 px-1">
        <p className="truncate text-sm font-semibold tracking-tight text-foreground">{rack.name}</p>
        <p className="text-[10px] text-muted-foreground">{rack.capacity_u}U</p>
      </div>

      <div
        ref={frameRef}
        className={`rack-frame flex flex-col gap-px overflow-hidden rounded-lg border border-border bg-muted/30 p-2 ${
          fitMode ? "min-h-0 flex-1" : ""
        }`}
      >
        {slots.map((u) => {
          const server = ownerAt.get(u) ?? null;

          if (server && topUof.get(server.id) !== u) {
            // continuation d'un serveur multi-U : couverte par le bloc du haut
            return null;
          }

          if (server) {
            const units = effUnits(server);
            const bottomU = effRackU(server);
            const topU = topUof.get(server.id)!;
            const blockH = units * uPx + (units - 1) * GAP;
            const isResizing = resizing?.serverId === server.id;
            const statusClass =
              server.status === "online"
                ? "border-emerald-500/40 bg-emerald-500/10"
                : server.status === "offline"
                  ? "border-red-500/40 bg-red-500/10"
                  : "border-border bg-muted/60";
            return (
              <div key={u} className="relative shrink-0" style={{ height: blockH }}>
                <span className="absolute -left-0.5 top-1 z-10 font-mono text-[8px] text-muted-foreground/60">
                  {units > 1 ? `${bottomU}·${topU}` : u}
                </span>
                <button
                  type="button"
                  draggable={!isResizing}
                  onDragStart={(e) => startDrag(e, server)}
                  onClick={() => {
                    if (resizingRef.current) return;
                    onOpenInfo(server);
                  }}
                  className={`group/server flex h-full w-full items-center gap-1.5 rounded-md border pl-5 pr-1.5 text-left transition-all duration-150 ${statusClass} ${
                    isResizing ? "cursor-ns-resize ring-1 ring-primary" : "cursor-grab active:cursor-grabbing"
                  } ${activeServerId === server.id ? "ring-1 ring-primary/60" : "hover:brightness-110"}`}
                >
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      server.status === "online"
                        ? "bg-emerald-500"
                        : server.status === "offline"
                          ? "bg-red-500"
                          : "bg-muted-foreground"
                    }`}
                  />
                  <span className="truncate font-mono text-xs font-medium text-foreground">{server.name}</span>
                  {units > 1 && (
                    <span className="ml-auto shrink-0 rounded bg-primary/20 px-1 font-mono text-[9px] text-primary">
                      {units}U
                    </span>
                  )}
                </button>

                {/* Poignée haut : étend vers le haut (zone centrale étroite, le reste reste déplaçable) */}
                <div
                  onPointerDown={(e) => beginResize(e, server, "top")}
                  onDragStart={(e) => e.preventDefault()}
                  title="Étirer vers le haut"
                  className="absolute left-1/2 top-0 z-20 flex h-2.5 w-14 -translate-x-1/2 cursor-ns-resize items-center justify-center"
                >
                  <span className="h-1 w-10 rounded-full bg-primary/30 transition-colors group-hover/server:bg-primary/70 hover:!bg-primary" />
                </div>

                {/* Poignée bas : étend vers le bas */}
                <div
                  onPointerDown={(e) => beginResize(e, server, "bottom")}
                  onDragStart={(e) => e.preventDefault()}
                  title="Étirer vers le bas"
                  className="absolute bottom-0 left-1/2 z-20 flex h-2.5 w-14 -translate-x-1/2 cursor-ns-resize items-center justify-center"
                >
                  <span className="h-1 w-10 rounded-full bg-primary/30 transition-colors group-hover/server:bg-primary/70 hover:!bg-primary" />
                </div>
              </div>
            );
          }

          const isOver = dragOverU === u;
          return (
            <div
              key={u}
              className="relative shrink-0"
              style={{ height: uPx }}
              onDragOver={(e) => {
                const payload = getActiveDrag();
                const dragUnits = payload?.rackUnits ?? 1;
                if (canDropAt(u, dragUnits, payload?.serverId)) {
                  e.preventDefault();
                  setDragOverU(u);
                }
              }}
              onDragLeave={() => setDragOverU((prev) => (prev === u ? null : prev))}
              onDrop={(e) => handleDrop(e, { datacenterId, rackId: rack.id, rackU: u })}
            >
              <span className="absolute -left-0.5 top-1/2 -translate-y-1/2 font-mono text-[8px] text-muted-foreground/50">
                {u}
              </span>
              <div
                className={`ml-4 h-full rounded border border-dashed transition-all duration-150 ${
                  isOver ? "border-primary/60 bg-primary/10" : "border-border/40 bg-background/40"
                }`}
              />
            </div>
          );
        })}
      </div>

      {(dragging || unplaced.length > 0) && (
        <div
          className={`mt-2 shrink-0 rounded-lg border border-dashed p-2 transition-colors ${
            dragOverPool ? "border-primary/40 bg-primary/5" : "border-border/60 bg-muted/20"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverPool(true);
          }}
          onDragLeave={() => setDragOverPool(false)}
          onDrop={(e) => handleDrop(e, { datacenterId, rackId: rack.id, rackU: null })}
        >
          <p className="mb-1.5 text-[9px] font-medium uppercase tracking-widest text-muted-foreground">Sans U</p>
          <div className="flex flex-wrap gap-1">
            {unplaced.map((server) => (
              <button
                key={server.id}
                type="button"
                draggable
                onDragStart={(e) => startDrag(e, server)}
                onClick={() => onOpenInfo(server)}
                className={`flex items-center gap-1.5 rounded border px-1.5 py-1 text-left transition-all hover:brightness-110 ${
                  server.status === "online"
                    ? "border-emerald-500/30 bg-emerald-500/10"
                    : server.status === "offline"
                      ? "border-red-500/30 bg-red-500/10"
                      : "border-border bg-muted/50"
                } ${activeServerId === server.id ? "ring-1 ring-primary/60" : ""} cursor-grab active:cursor-grabbing`}
              >
                <GripVertical className="h-2.5 w-2.5 shrink-0 text-muted-foreground/50" />
                <span className="truncate font-mono text-[10px] text-foreground">{server.name}</span>
              </button>
            ))}
            {unplaced.length === 0 && (
              <p className="w-full py-1 text-center text-[9px] text-muted-foreground/60">Déposer ici (sans U)</p>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}

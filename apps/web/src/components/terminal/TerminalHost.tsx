"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  PanelBottom,
  PanelRight,
  Terminal as TerminalIcon,
  X,
} from "lucide-react";
import { getToken } from "@/lib/auth";
import { DEFAULT_DOCK_HEIGHT, MINIMIZED_HEIGHT, useTerminal } from "./TerminalContext";

const TerminalPanel = dynamic(
  () => import("@/components/TerminalPanel").then((m) => m.TerminalPanel),
  { ssr: false },
);

export function TerminalHost() {
  const token = getToken();
  const { session, close, dock, toDrawer, expand, restore, minimize, setDockHeight } = useTerminal();
  const [resizing, setResizing] = useState(false);
  const resizeStart = useRef({ y: 0, h: DEFAULT_DOCK_HEIGHT });

  const isDrawer = session?.placement === "drawer";
  const isDocked = session && session.placement !== "drawer";
  const isMinimized = session?.placement === "minimized";
  const isExpanded = session?.placement === "expanded";

  useEffect(() => {
    if (!isDrawer) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isDrawer, close]);

  const onResizeStart = useCallback(
    (e: React.MouseEvent) => {
      if (!session || isMinimized) return;
      e.preventDefault();
      setResizing(true);
      resizeStart.current = { y: e.clientY, h: session.dockHeight };
    },
    [session, isMinimized],
  );

  useEffect(() => {
    if (!resizing) return;
    const onMove = (e: MouseEvent) => {
      setDockHeight(resizeStart.current.h + (resizeStart.current.y - e.clientY));
    };
    const onUp = () => setResizing(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [resizing, setDockHeight]);

  if (!session || !token) return null;

  const { server } = session;
  const dockHeight = isExpanded ? "72vh" : isMinimized ? `${MINIMIZED_HEIGHT}px` : `${session.dockHeight}px`;

  return (
    <>
      {isDrawer && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[180] bg-black/60"
          onClick={close}
        />
      )}

      <motion.div
        layout
        transition={{ type: "spring", damping: 32, stiffness: 360 }}
        className={
          isDrawer
            ? "fixed inset-y-0 right-0 z-[190] flex w-full max-w-2xl flex-col border-l border-border bg-[#0a0a0a] shadow-2xl"
            : "fixed inset-x-0 bottom-0 z-[200] flex flex-col border-t border-border bg-[#0a0a0a] shadow-[0_-12px_48px_rgba(0,0,0,0.7)]"
        }
        style={isDocked ? { height: dockHeight } : undefined}
      >
        {isDocked && !isMinimized && (
          <div
            role="separator"
            aria-label="Redimensionner"
            onMouseDown={onResizeStart}
            className={`absolute -top-1 left-0 right-0 z-10 h-2 cursor-ns-resize ${resizing ? "bg-primary/20" : ""}`}
          >
            <div className="mx-auto mt-0.5 h-0.5 w-10 rounded-full bg-border/80 hover:bg-primary/40" />
          </div>
        )}

        <div className="flex shrink-0 items-center gap-2 border-b border-border/80 bg-[#0a0a0a] px-3 py-2">
          <TerminalIcon className="h-3.5 w-3.5 text-primary" />
          <span className="min-w-0 flex-1 truncate font-mono text-xs">
            <span className="text-foreground">{server.name}</span>
            <span className="ml-2 text-muted-foreground">{server.ip_address}</span>
          </span>
          <div className="flex items-center gap-0.5">
            {isDrawer && (
              <button type="button" onClick={dock} className="btn-icon" title="Attacher en bas">
                <PanelBottom className="h-3.5 w-3.5" />
              </button>
            )}
            {isDocked && !isMinimized && (
              <>
                {!isExpanded ? (
                  <button type="button" onClick={expand} className="btn-icon" title="Agrandir">
                    <Maximize2 className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <button type="button" onClick={restore} className="btn-icon" title="Taille normale">
                    <Minimize2 className="h-3.5 w-3.5" />
                  </button>
                )}
                <button type="button" onClick={toDrawer} className="btn-icon" title="Panneau latéral">
                  <PanelRight className="h-3.5 w-3.5" />
                </button>
              </>
            )}
            {isDocked && (
              <button
                type="button"
                onClick={isMinimized ? restore : minimize}
                className="btn-icon"
                title={isMinimized ? "Développer" : "Réduire"}
              >
                {isMinimized ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
            )}
            <button type="button" onClick={close} className="btn-icon hover:text-destructive" title="Fermer">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {!isMinimized && (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <TerminalPanel
              serverId={server.id}
              token={token}
              serverName={server.name}
              fill
              layoutVersion={`${session.placement}-${session.dockHeight}`}
            />
          </div>
        )}
      </motion.div>
    </>
  );
}

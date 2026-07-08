"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Server } from "@/lib/api";

export type TerminalPlacement = "drawer" | "docked" | "expanded" | "minimized";

type TerminalSession = {
  server: Server;
  placement: TerminalPlacement;
  dockHeight: number;
};

type TerminalContextValue = {
  session: TerminalSession | null;
  open: (server: Server, placement?: TerminalPlacement) => void;
  close: () => void;
  dock: () => void;
  toDrawer: () => void;
  expand: () => void;
  restore: () => void;
  minimize: () => void;
  setDockHeight: (h: number) => void;
  dockOffset: number;
};

const TerminalContext = createContext<TerminalContextValue | null>(null);

export const DEFAULT_DOCK_HEIGHT = 300;
export const MIN_DOCK_HEIGHT = 160;
export const MAX_DOCK_HEIGHT = 720;
export const MINIMIZED_HEIGHT = 44;

function placementHeight(placement: TerminalPlacement, dockHeight: number): number {
  if (typeof window === "undefined") return 0;
  switch (placement) {
    case "minimized":
      return MINIMIZED_HEIGHT;
    case "expanded":
      return Math.min(window.innerHeight * 0.72, MAX_DOCK_HEIGHT);
    case "docked":
      return dockHeight;
    default:
      return 0;
  }
}

export function TerminalProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<TerminalSession | null>(null);
  const [dockOffset, setDockOffset] = useState(0);

  const updateOffset = useCallback((s: TerminalSession | null) => {
    if (!s || s.placement === "drawer") {
      setDockOffset(0);
      document.documentElement.style.setProperty("--terminal-dock-height", "0px");
      return;
    }
    const h = placementHeight(s.placement, s.dockHeight);
    setDockOffset(h);
    document.documentElement.style.setProperty("--terminal-dock-height", `${h}px`);
  }, []);

  useEffect(() => {
    updateOffset(session);
    const onResize = () => updateOffset(session);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [session, updateOffset]);

  const patch = useCallback(
    (fn: (s: TerminalSession) => TerminalSession) => {
      setSession((prev) => {
        if (!prev) return null;
        const next = fn(prev);
        updateOffset(next);
        return next;
      });
    },
    [updateOffset],
  );

  const open = useCallback(
    (server: Server, placement: TerminalPlacement = "drawer") => {
      const next: TerminalSession = { server, placement, dockHeight: DEFAULT_DOCK_HEIGHT };
      setSession(next);
      updateOffset(next);
    },
    [updateOffset],
  );

  const close = useCallback(() => {
    setSession(null);
    updateOffset(null);
  }, [updateOffset]);

  const dock = useCallback(() => patch((s) => ({ ...s, placement: "docked" })), [patch]);
  const toDrawer = useCallback(() => patch((s) => ({ ...s, placement: "drawer" })), [patch]);
  const expand = useCallback(() => patch((s) => ({ ...s, placement: "expanded" })), [patch]);
  const restore = useCallback(() => patch((s) => ({ ...s, placement: "docked" })), [patch]);
  const minimize = useCallback(() => patch((s) => ({ ...s, placement: "minimized" })), [patch]);

  const setDockHeight = useCallback(
    (h: number) => {
      const clamped = Math.max(MIN_DOCK_HEIGHT, Math.min(MAX_DOCK_HEIGHT, h));
      patch((s) => ({
        ...s,
        dockHeight: clamped,
        placement: s.placement === "expanded" ? "docked" : s.placement,
      }));
    },
    [patch],
  );

  const value = useMemo(
    () => ({
      session,
      open,
      close,
      dock,
      toDrawer,
      expand,
      restore,
      minimize,
      setDockHeight,
      dockOffset,
    }),
    [session, open, close, dock, toDrawer, expand, restore, minimize, setDockHeight, dockOffset],
  );

  return <TerminalContext.Provider value={value}>{children}</TerminalContext.Provider>;
}

export function useTerminal() {
  const ctx = useContext(TerminalContext);
  if (!ctx) throw new Error("useTerminal must be used within TerminalProvider");
  return ctx;
}

"use client";

import { useEffect, useRef } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { Terminal as XTerm } from "xterm";
import "xterm/css/xterm.css";
import { api } from "@/lib/api";

const TERM_THEME = {
  background: "#000000",
  foreground: "#d4d4d4",
  cursor: "#3b82f6",
  selectionBackground: "#3b82f640",
  black: "#0a0a0a",
  red: "#ef4444",
  green: "#22c55e",
  yellow: "#eab308",
  blue: "#3b82f6",
  magenta: "#a855f7",
  cyan: "#06b6d4",
  white: "#fafafa",
};

type Props = {
  serverId: number;
  token: string;
  serverName: string;
  fill?: boolean;
  layoutVersion?: string;
};

export function TerminalPanel({ serverId, token, serverName, fill, layoutVersion }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!containerRef.current || !token) return;

    const term = new XTerm({
      cursorBlink: true,
      fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
      fontSize: 13,
      lineHeight: 1.35,
      theme: TERM_THEME,
      scrollback: 5000,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());
    term.open(containerRef.current);

    const sendResize = (cols: number, rows: number) => {
      const ws = wsRef.current;
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "resize", cols, rows }));
      }
    };

    const fit = () => {
      if (!containerRef.current) return;
      const { clientWidth, clientHeight } = containerRef.current;
      if (clientWidth < 8 || clientHeight < 8) return;
      try {
        fitAddon.fit();
        sendResize(term.cols, term.rows);
      } catch {
        /* container not ready */
      }
    };

    term.writeln("\x1b[1mServerHub\x1b[0m \x1b[90m·\x1b[0m " + serverName);
    term.writeln("\x1b[90mConnexion…\x1b[0m\r\n");

    const ws = new WebSocket(api.terminalWsUrl(serverId, token));
    wsRef.current = ws;

    ws.onopen = () => {
      term.writeln("\x1b[32m● Connecté\x1b[0m\r\n");
      requestAnimationFrame(() => {
        fit();
        setTimeout(fit, 50);
        setTimeout(fit, 200);
      });
    };

    ws.onmessage = (event) => {
      term.write(typeof event.data === "string" ? event.data : new TextDecoder().decode(event.data));
    };

    ws.onerror = () => {
      term.writeln("\r\n\x1b[31mWebSocket échoué — reconnectez-vous à l'application.\x1b[0m\r\n");
    };

    ws.onclose = (event) => {
      if (event.code === 1008) {
        term.writeln("\r\n\x1b[31mSession expirée.\x1b[0m\r\n");
      } else if (event.code !== 1000) {
        term.writeln(`\r\n\x1b[33mFermé (${event.code}).\x1b[0m\r\n`);
      }
    };

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(data);
    });

    term.onResize(({ cols, rows }) => sendResize(cols, rows));

    const onWindowResize = () => requestAnimationFrame(fit);
    window.addEventListener("resize", onWindowResize);

    const ro = new ResizeObserver(() => requestAnimationFrame(fit));
    ro.observe(containerRef.current);
    if (containerRef.current.parentElement) {
      ro.observe(containerRef.current.parentElement);
    }

    return () => {
      window.removeEventListener("resize", onWindowResize);
      ro.disconnect();
      ws.close();
      wsRef.current = null;
      term.dispose();
    };
  }, [serverId, token, serverName]);

  useEffect(() => {
    if (!layoutVersion || !containerRef.current) return;
    const t = setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
    }, 80);
    return () => clearTimeout(t);
  }, [layoutVersion]);

  return (
    <div
      ref={containerRef}
      className={
        fill
          ? "h-full min-h-0 w-full flex-1 overflow-hidden bg-black [&_.xterm]:h-full [&_.xterm-viewport]:!overflow-y-auto"
          : "h-[480px] w-full overflow-hidden bg-black"
      }
    />
  );
}

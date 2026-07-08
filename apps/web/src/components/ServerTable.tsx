"use client";

import { RefreshCw, TerminalSquare, Trash2 } from "lucide-react";
import { EditServerModal } from "./EditServerModal";
import type { Server as ServerType } from "@/lib/api";

type Props = {
  servers: ServerType[];
  token: string;
  providers?: string[];
  syncingId: number | null;
  dcNameById: Map<number, string>;
  onSync: (id: number) => void;
  onDelete: (id: number) => void;
  onUpdated: () => void;
  onOpenInfo: (server: ServerType) => void;
  onOpenTerminal: (server: ServerType) => void;
};

function statusMeta(status: string) {
  if (status === "online") return { code: "ONL", dot: "bg-primary", text: "text-primary" };
  if (status === "offline") return { code: "OFF", dot: "bg-destructive", text: "text-destructive" };
  return { code: "---", dot: "bg-muted-foreground", text: "text-muted-foreground" };
}

function formatSync(iso: string | null): string {
  if (!iso) return "jamais";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}j`;
}

export function ServerTable({
  servers,
  token,
  providers,
  syncingId,
  dcNameById,
  onSync,
  onDelete,
  onUpdated,
  onOpenInfo,
  onOpenTerminal,
}: Props) {
  return (
    <div className="overflow-x-auto rounded-md border border-border/60 bg-card">
      <table className="w-full min-w-[760px] text-xs">
        <thead>
          <tr className="border-b border-border/60 text-left uppercase tracking-wider text-muted-foreground/70">
            <th className="px-3 py-2 font-normal">stat</th>
            <th className="px-3 py-2 font-normal">hostname</th>
            <th className="px-3 py-2 font-normal">ip</th>
            <th className="px-3 py-2 font-normal">provider</th>
            <th className="px-3 py-2 font-normal">datacenter</th>
            <th className="px-3 py-2 font-normal">os</th>
            <th className="px-3 py-2 font-normal">sync</th>
            <th className="px-3 py-2 text-right font-normal">actions</th>
          </tr>
        </thead>
        <tbody>
          {servers.map((server) => {
            const st = statusMeta(server.status);
            const dc = server.datacenter_id ? dcNameById.get(server.datacenter_id) : null;
            return (
              <tr
                key={server.id}
                className="group console-row cursor-pointer last:border-b-0"
                onClick={() => onOpenInfo(server)}
              >
                <td className="px-3 py-1.5">
                  <span className={`inline-flex items-center gap-1.5 ${st.text}`}>
                    <span className={`status-blink h-1.5 w-1.5 rounded-full ${st.dot}`} />
                    {st.code}
                  </span>
                </td>
                <td className="px-3 py-1.5 font-medium text-foreground">{server.name}</td>
                <td className="px-3 py-1.5 text-muted-foreground">{server.ip_address}</td>
                <td className="px-3 py-1.5 text-muted-foreground">
                  <span className="text-primary/80">[</span>
                  {server.provider}
                  <span className="text-primary/80">]</span>
                </td>
                <td className="px-3 py-1.5 text-muted-foreground">{dc ?? "—"}</td>
                <td className="px-3 py-1.5 max-w-[220px] truncate text-muted-foreground/80" title={server.os_info ?? ""}>
                  {server.os_info ?? "—"}
                </td>
                <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground/80">
                  {formatSync(server.last_sync_at)}
                </td>
                <td className="px-3 py-1.5" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1 opacity-40 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => onOpenTerminal(server)}
                      className="term-btn !text-primary hover:bg-primary/10"
                      title="Terminal SSH"
                    >
                      <TerminalSquare className="h-3 w-3" /> ssh
                    </button>
                    <button
                      type="button"
                      onClick={() => onSync(server.id)}
                      disabled={syncingId === server.id}
                      className="term-btn"
                      title="Synchroniser"
                    >
                      <RefreshCw className={`h-3 w-3 ${syncingId === server.id ? "animate-spin" : ""}`} /> sync
                    </button>
                    <EditServerModal
                      token={token}
                      server={server}
                      providers={providers}
                      onUpdated={onUpdated}
                      triggerClassName="term-btn"
                      triggerLabel="edit"
                    />
                    <button
                      type="button"
                      onClick={() => onDelete(server.id)}
                      className="term-btn hover:!text-destructive"
                      title="Supprimer"
                    >
                      <Trash2 className="h-3 w-3" /> del
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

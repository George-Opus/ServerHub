"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Cpu, HardDrive, MemoryStick, RefreshCw, Terminal } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ProviderBadge, StatusDot } from "@/components/badges";
import { EditServerModal } from "@/components/EditServerModal";
import { useTerminal } from "@/components/terminal/TerminalContext";
import { api, type Server } from "@/lib/api";
import { getToken } from "@/lib/auth";

export default function ServerDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const token = getToken()!;
  const terminal = useTerminal();
  const [server, setServer] = useState<Server | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [providers, setProviders] = useState<string[]>([]);

  const load = () => {
    api.getServer(token, id).then(setServer).catch(() => setServer(null));
  };

  useEffect(() => {
    load();
    api.providers(token).then((r) => setProviders(r.providers)).catch(() => undefined);
  }, [token, id]);

  const sync = async () => {
    setSyncing(true);
    try {
      const { server: updated } = await api.syncServer(token, id);
      setServer(updated);
    } finally {
      setSyncing(false);
    }
  };

  if (!server) {
    return (
      <div className="flex justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Link href="/dashboard" className="btn-ghost mb-2 inline-flex text-xs">
        <ArrowLeft className="h-3.5 w-3.5" />
        Retour
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{server.name}</h1>
            <ProviderBadge provider={server.provider} />
          </div>
          <p className="font-mono text-sm text-muted-foreground">
            {server.ssh_username}@{server.ip_address}:{server.ssh_port}
          </p>
          <div className="mt-2">
            <StatusDot status={server.status} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <EditServerModal token={token} server={server} providers={providers} onUpdated={load} />
          <button type="button" onClick={sync} disabled={syncing} className="btn-ghost">
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            Sync
          </button>
          <button type="button" onClick={() => terminal.open(server, "drawer")} className="btn-primary">
            <Terminal className="h-4 w-4" />
            Terminal
          </button>
          <button type="button" onClick={() => terminal.open(server, "docked")} className="btn-ghost">
            <Terminal className="h-4 w-4" />
            Attacher en bas
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <InfoCard icon={MemoryStick} label="Mémoire" value={server.memory_total ?? "—"} />
        <InfoCard icon={HardDrive} label="Disque" value={server.disk_total ?? "—"} />
        <InfoCard icon={Cpu} label="CPU" value={server.cpu_count != null ? `${server.cpu_count}` : "—"} />
        <InfoCard icon={Cpu} label="OS" value={server.os_info ?? "—"} small />
      </div>

      {server.notes && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="label mb-1">Notes</p>
          <p className="text-sm text-muted-foreground">{server.notes}</p>
        </div>
      )}
    </div>
  );
}

function InfoCard({
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
    <div className="rounded-xl border border-border bg-card p-4">
      <Icon className="mb-2 h-4 w-4 text-primary/70" />
      <p className="label mb-0.5">{label}</p>
      <p className={`font-medium ${small ? "text-sm" : "text-base"}`}>{value}</p>
    </div>
  );
}

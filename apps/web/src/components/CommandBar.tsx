"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Eraser, TerminalSquare } from "lucide-react";
import { useTerminal } from "@/components/terminal/TerminalContext";
import { api, ApiError } from "@/lib/api";
import { getToken } from "@/lib/auth";

type Line = { text: string; tone: "info" | "ok" | "err" };

const HELP: string[] = [
  "commandes :",
  "  s | serveurs            → liste des serveurs",
  "  d | datacenters         → datacenters",
  "  i | identifiants        → clés & mots de passe",
  "  ssh <nom|ip>            → ouvre un terminal SSH",
  "  sync <nom|ip>           → synchronise un serveur",
  "  find <texte>            → recherche dans les serveurs",
  "  whois <domaine|ip>      → informations whois",
  "  dig <domaine> [type]    → résolution DNS (A, MX, TXT, NS…)",
  "  ping <hôte|ip>          → test de connectivité",
  "  clear                   → efface la sortie",
  "  help | ?                → cette aide",
];

export function CommandBar() {
  const router = useRouter();
  const terminal = useTerminal();
  const [value, setValue] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [busy, setBusy] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  const print = (text: string, tone: Line["tone"] = "info") =>
    setLines((prev) => [...prev.slice(-100), { text, tone }]);

  // Auto-scroll vers le bas à chaque nouvelle ligne.
  useEffect(() => {
    const el = outputRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  const findServer = async (needle: string) => {
    const token = getToken();
    if (!token) return null;
    const servers = await api.listServers(token);
    const q = needle.toLowerCase();
    return (
      servers.find((s) => s.name.toLowerCase() === q || s.ip_address === needle) ??
      servers.find((s) => s.name.toLowerCase().includes(q) || s.ip_address.includes(needle)) ??
      null
    );
  };

  const run = async (raw: string) => {
    const cmd = raw.trim();
    if (!cmd) return;
    print(`❯ ${cmd}`, "info");
    const [name, ...rest] = cmd.split(/\s+/);
    const arg = rest.join(" ");
    const c = name.toLowerCase();

    if (c === "help" || c === "?") {
      HELP.forEach((l) => print(l));
      return;
    }
    if (c === "clear" || c === "cls") {
      setLines([]);
      return;
    }
    if (["s", "serveurs", "servers"].includes(c)) {
      router.push("/dashboard");
      return;
    }
    if (["d", "dc", "datacenters", "datacenter"].includes(c)) {
      router.push("/dashboard/datacenters");
      return;
    }
    if (["i", "id", "identifiants", "creds", "credentials"].includes(c)) {
      router.push("/dashboard/credentials");
      return;
    }
    if (c === "find" || c === "search") {
      if (!arg) return print("usage: find <texte>", "err");
      router.push(`/dashboard?q=${encodeURIComponent(arg)}`);
      return;
    }
    if (c === "ssh" || c === "term" || c === "terminal") {
      if (!arg) {
        if (terminal.session) {
          terminal.dock();
          return;
        }
        return print("usage: ssh <nom|ip>", "err");
      }
      setBusy(true);
      try {
        const server = await findServer(arg);
        if (!server) return print(`aucun serveur trouvé pour « ${arg} »`, "err");
        terminal.open(server, "docked");
        print(`connexion à ${server.name} (${server.ip_address})…`, "ok");
      } finally {
        setBusy(false);
      }
      return;
    }
    if (c === "sync") {
      if (!arg) return print("usage: sync <nom|ip>", "err");
      const token = getToken();
      if (!token) return;
      setBusy(true);
      try {
        const server = await findServer(arg);
        if (!server) return print(`aucun serveur trouvé pour « ${arg} »`, "err");
        print(`synchronisation de ${server.name}…`);
        const res = await api.syncServer(token, server.id);
        print(res.message ?? `${server.name} synchronisé`, "ok");
      } catch {
        print("échec de la synchronisation", "err");
      } finally {
        setBusy(false);
      }
      return;
    }

    if (c === "whois" || c === "dig" || c === "ping") {
      if (!arg) return print(`usage: ${c} <cible>${c === "dig" ? " [type]" : ""}`, "err");
      const token = getToken();
      if (!token) return;
      const [rawTarget, rawRecord] = arg.split(/\s+/);
      setBusy(true);
      try {
        const res = await api.netTool(token, c, rawTarget, c === "dig" ? rawRecord : undefined);
        print(`$ ${res.command}`);
        res.output.split("\n").forEach((l) => print(l, "ok"));
      } catch (err) {
        print(err instanceof ApiError ? err.message : "commande échouée", "err");
      } finally {
        setBusy(false);
      }
      return;
    }

    // fallback: recherche libre
    router.push(`/dashboard?q=${encodeURIComponent(cmd)}`);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = value;
    setValue("");
    if (collapsed) setCollapsed(false);
    await run(v);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl/Cmd + L : efface la sortie
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "l") {
      e.preventDefault();
      setLines([]);
    }
  };

  if (collapsed) {
    return (
      <div className="sticky bottom-0 z-20 border-t border-border/60 bg-[hsl(var(--sidebar))]">
        <button
          type="button"
          onClick={() => {
            setCollapsed(false);
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
          className="flex w-full items-center gap-2 px-4 py-1.5 text-left text-xs text-muted-foreground hover:text-foreground"
          title="Ouvrir le terminal"
        >
          <TerminalSquare className="h-3.5 w-3.5 text-primary" />
          <span className="text-primary">serverhub</span> ❯
          <span className="text-muted-foreground/60">terminal réduit — cliquer pour ouvrir</span>
          <ChevronUp className="ml-auto h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="sticky bottom-0 z-20 border-t border-border/60 bg-[hsl(var(--sidebar))]">
      {lines.length > 0 && (
        <div ref={outputRef} className="max-h-40 overflow-y-auto px-4 pt-2 text-xs leading-relaxed scroll-hidden">
          {lines.map((l, i) => (
            <pre
              key={i}
              className={`whitespace-pre-wrap font-mono ${
                l.tone === "ok"
                  ? "text-primary"
                  : l.tone === "err"
                    ? "text-destructive"
                    : "text-muted-foreground"
              }`}
            >
              {l.text}
            </pre>
          ))}
        </div>
      )}
      <form onSubmit={onSubmit} className="flex items-center gap-2 px-4 py-2">
        <span className="shrink-0 text-xs text-muted-foreground">
          <span className="text-primary">serverhub</span> ❯
        </span>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={busy ? "…" : "help pour les commandes"}
          disabled={busy}
          autoComplete="off"
          spellCheck={false}
          className="flex-1 bg-transparent font-mono text-xs text-foreground placeholder:text-muted-foreground/60 outline-none"
        />
        {lines.length > 0 && (
          <button
            type="button"
            onClick={() => setLines([])}
            className="btn-icon shrink-0"
            title="Effacer (cls / Ctrl+L)"
          >
            <Eraser className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="btn-icon shrink-0"
          title="Réduire le terminal"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  );
}

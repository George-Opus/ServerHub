"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Building2, KeyRound, LayoutGrid, LogOut, TerminalSquare } from "lucide-react";
import { ServerHubLogo } from "@/components/ServerHubLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TerminalHost } from "@/components/terminal/TerminalHost";
import { TerminalProvider } from "@/components/terminal/TerminalContext";
import { CommandBar } from "@/components/CommandBar";
import { api, type User } from "@/lib/api";
import { clearToken, getToken } from "@/lib/auth";

const NAV = [
  { href: "/dashboard", label: "Serveurs", icon: LayoutGrid },
  { href: "/dashboard/datacenters", label: "Datacenters", icon: Building2 },
  { href: "/dashboard/credentials", label: "Identifiants", icon: KeyRound },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [clock, setClock] = useState("");
  const isDatacenters = pathname?.startsWith("/dashboard/datacenters");

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    api.me(token).then(setUser).catch(() => {
      clearToken();
      router.replace("/login");
    });
  }, [router]);

  useEffect(() => {
    const tick = () =>
      setClock(
        new Date().toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const logout = () => {
    clearToken();
    router.replace("/login");
  };

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background font-mono">
        <span className="text-primary cursor-blink text-sm">booting</span>
      </div>
    );
  }

  return (
    <TerminalProvider>
      <div className="flex h-screen overflow-hidden bg-background font-mono text-sm text-foreground">
        <IconRail pathname={pathname ?? ""} />

        <div
          className="flex min-w-0 flex-1 flex-col overflow-hidden"
          style={{ paddingBottom: "var(--terminal-dock-height)" }}
        >
          <header className="sticky top-0 z-30 flex h-9 items-center justify-between border-b border-border/60 bg-background/95 px-4 text-xs backdrop-blur-md">
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="text-primary">serverhub</span>
              <span className="hidden sm:inline">v1.0.0</span>
              <span className="hidden text-border sm:inline">│</span>
              <span className="hidden text-muted-foreground/80 sm:inline">{clock}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="hidden sm:inline">
                <span className="text-primary">{user.username}</span>@serverhub
              </span>
              <ThemeToggle />
              <button type="button" onClick={logout} className="btn-icon" title="Déconnexion">
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </header>

          <main
            className={`mx-auto w-full ${
              isDatacenters
                ? "flex min-h-0 flex-1 flex-col overflow-hidden max-w-[1600px] px-3 py-3 sm:px-5"
                : "min-h-0 max-w-[1400px] flex-1 overflow-y-auto px-3 py-5 sm:px-6"
            }`}
          >
            {children}
          </main>

          <CommandBar />
          <TerminalHost />
        </div>
      </div>
    </TerminalProvider>
  );
}

function IconRail({ pathname }: { pathname: string }) {
  return (
    <aside className="sticky top-0 z-30 flex h-screen w-14 shrink-0 flex-col items-center border-r border-border/60 bg-[hsl(var(--sidebar))] py-3">
      <Link href="/dashboard" className="mb-4 flex h-10 w-10 items-center justify-center" title="ServerHub">
        <ServerHubLogo size="sm" framed />
      </Link>
      <nav className="flex flex-1 flex-col items-center gap-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={`rail-link ${active ? "rail-link-active" : ""}`}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-r bg-primary" />
              )}
              <Icon className="h-[18px] w-[18px]" />
            </Link>
          );
        })}
      </nav>
      <div className="mt-2 text-muted-foreground/50" title="Terminal">
        <TerminalSquare className="h-[18px] w-[18px]" />
      </div>
    </aside>
  );
}

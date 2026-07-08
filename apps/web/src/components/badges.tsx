const PROVIDER_COLORS: Record<string, string> = {

  OVH: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-800",

  Scaleway: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800",

  PulseHeberg: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800",

  Hetzner: "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800",

  AWS: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800",

  GCP: "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800",

  Azure: "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800",

  Autre: "bg-muted text-muted-foreground border-border",

};



export function ProviderBadge({ provider }: { provider: string }) {

  const colors = PROVIDER_COLORS[provider] ?? PROVIDER_COLORS.Autre;

  return (

    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${colors}`}>

      {provider}

    </span>

  );

}



export function StatusDot({ status }: { status: string }) {

  const online = status === "online";

  return (

    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">

      <span

        className={`inline-flex h-2 w-2 rounded-full ${

          online ? "bg-emerald-500" : status === "offline" ? "bg-red-500" : "bg-muted-foreground"

        }`}

      />

      {online ? "En ligne" : status === "offline" ? "Hors ligne" : "Inconnu"}

    </span>

  );

}


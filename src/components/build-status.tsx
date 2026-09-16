import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import pkg from "../../package.json";

type Env = "preview" | "published" | "dev";

function detectEnv(host: string): Env {
  if (host.includes("id-preview") || host.endsWith(".lovableproject.com")) return "preview";
  if (host.endsWith(".lovable.app")) return "published";
  if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".local")) return "dev";
  return "published";
}

const LABELS: Record<Env, { text: string; dot: string; variant: "secondary" | "default" | "outline" }> = {
  preview: { text: "Превью", dot: "bg-amber-500", variant: "secondary" },
  published: { text: "Опубликовано", dot: "bg-emerald-500", variant: "secondary" },
  dev: { text: "Локально", dot: "bg-sky-500", variant: "outline" },
};

export function BuildStatus({ className = "", forceEnv }: { className?: string; forceEnv?: Env }) {
  const [env, setEnv] = useState<Env | null>(forceEnv ?? null);

  useEffect(() => {
    if (!forceEnv) {
      setEnv(detectEnv(window.location.hostname));
    }
  }, [forceEnv]);

  if (!env) return null;
  const l = LABELS[env];

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <Badge variant={l.variant} className="gap-1.5 font-medium">
        <span className={`inline-block h-2 w-2 rounded-full ${l.dot}`} aria-hidden />
        {l.text}
      </Badge>
      <Badge variant="outline" className="font-mono text-[11px]">v{pkg.version}</Badge>
    </div>
  );
}

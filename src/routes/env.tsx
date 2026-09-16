import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import pkg from "../../package.json";

type Env = "preview" | "published" | "dev";

function detectEnv(host: string): Env {
  if (host.includes("id-preview") || host.endsWith(".lovableproject.com")) return "preview";
  if (host.endsWith(".lovable.app")) return "published";
  if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".local")) return "dev";
  return "published";
}

const LABELS: Record<Env, string> = {
  preview: "Превью",
  published: "Опубликовано",
  dev: "Локально",
};

export const Route = createFileRoute("/env")({
  component: EnvPage,
});

function EnvPage() {
  const [host, setHost] = useState<string>("");
  const [href, setHref] = useState<string>("");
  const [ua, setUa] = useState<string>("");
  const [forced, setForced] = useState<string>("");

  useEffect(() => {
    setHost(window.location.hostname);
    setHref(window.location.href);
    setUa(navigator.userAgent);
    setForced(new URLSearchParams(window.location.search).get("env") || "");
  }, []);

  const detected = host ? detectEnv(host) : null;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-2xl font-bold">Информация об окружении</h1>

        <div className="space-y-4">
          <div className="rounded-lg border p-4">
            <div className="text-sm text-muted-foreground">Hostname</div>
            <div className="font-mono text-lg">{host || "…"}</div>
          </div>

          <div className="rounded-lg border p-4">
            <div className="text-sm text-muted-foreground">Определённое окружение</div>
            <div className="mt-1">
              {detected ? (
                <Badge variant={detected === "preview" ? "secondary" : detected === "dev" ? "outline" : "default"}>
                  {LABELS[detected]}
                </Badge>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </div>
          </div>

          {forced && (
            <div className="rounded-lg border p-4">
              <div className="text-sm text-muted-foreground">Принудительный режим (query param)</div>
              <div className="mt-1">
                <Badge variant="destructive">{forced}</Badge>
              </div>
            </div>
          )}

          <div className="rounded-lg border p-4">
            <div className="text-sm text-muted-foreground">Версия проекта</div>
            <div className="font-mono">v{pkg.version}</div>
          </div>

          <div className="rounded-lg border p-4">
            <div className="text-sm text-muted-foreground">URL</div>
            <div className="break-all font-mono text-sm">{href || "—"}</div>
          </div>

          <div className="rounded-lg border p-4">
            <div className="text-sm text-muted-foreground">User Agent</div>
            <div className="break-all font-mono text-sm">{ua || "—"}</div>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link to="/">На главную</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/roof" search={{ env: "preview" }}>
              Тест: принудительно Превью
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/roof" search={{ env: "published" }}>
              Тест: принудительно Опубликовано
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/roof" search={{ env: "dev" }}>
              Тест: принудительно Локально
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

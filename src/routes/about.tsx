import { createFileRoute } from "@tanstack/react-router";
import { Info } from "lucide-react";
import { PorchNav } from "@/components/porch/PorchNav";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "О системах антиобледенения SARO" },
      { name: "description", content: "Принципы работы, преимущества и особенности систем антиобледенения и обогрева SARO." },
      { property: "og:title", content: "О системах антиобледенения SARO" },
      { property: "og:description", content: "Как работают системы обогрева кровли, крыльца и ступеней SARO." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <>
      <PorchNav title="О системе" />
      <div className="min-h-screen bg-background">
        <div className="container mx-auto max-w-4xl px-4 py-8">
          <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
            <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-muted">
              <Info className="h-12 w-12 text-muted-foreground" />
            </div>
            <h1 className="mb-4 text-3xl font-bold text-foreground">О системе антиобледенения</h1>
            <p className="max-w-md text-lg text-muted-foreground">
              Раздел находится в разработке. Здесь будет представлена информация о принципах работы,
              преимуществах и особенностях монтажа систем обогрева SARO.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

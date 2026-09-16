import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BuildStatus } from "@/components/build-status";
import { Snowflake, Footprints, BookOpen, Info, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Калькуляторы SARO — кровля и крыльцо" },
      { name: "description", content: "Два калькулятора SARO в одной программе: антиобледенение кровли и обогрев крыльца и ступеней." },
      { property: "og:title", content: "Калькуляторы SARO — кровля и крыльцо" },
      { property: "og:description", content: "Выберите расчет: антиобледенение кровли или обогрев крыльца и ступеней SARO." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StartScreen,
});

function StartScreen() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary font-bold tracking-tight text-primary-foreground">S</div>
            <div>
              <div className="text-sm font-semibold leading-tight">SARO</div>
              <div className="text-xs leading-tight text-muted-foreground">Системы обогрева</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <BuildStatus />
            <Link to="/env" className="text-muted-foreground transition-colors hover:text-foreground" title="Информация об окружении">
              <Info className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-12">
        <div className="mb-10 text-center">
          <Badge variant="secondary" className="mb-3">Предварительный технический подбор</Badge>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Калькуляторы SARO</h1>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
            Выберите, что нужно рассчитать: антиобледенение кровли или обогрев крыльца и ступеней.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="group flex flex-col transition-shadow hover:shadow-lg">
            <CardHeader>
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Snowflake className="h-6 w-6" />
              </div>
              <CardTitle>Антиобледенение кровли</CardTitle>
              <CardDescription>
                Желоба, лотки, трубы, ендовы, капельник и край ската. Кабель, мощность, токи, группы, крепёж и КП.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-auto">
              <Button asChild className="w-full">
                <Link to="/roof">
                  Открыть расчет кровли <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="group flex flex-col transition-shadow hover:shadow-lg">
            <CardHeader>
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Footprints className="h-6 w-6" />
              </div>
              <CardTitle>Крыльцо и ступени</CardTitle>
              <CardDescription>
                Ступени и площадка: шаг укладки, длина секции, 3D-раскладка кабеля, спецификация и коммерческое предложение.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-auto">
              <Button asChild className="w-full">
                <Link to="/porch">
                  Открыть расчет крыльца <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Button asChild variant="outline" className="justify-start">
            <Link to="/catalog">
              <BookOpen className="mr-2 h-4 w-4" /> Каталог продукции SARO
            </Link>
          </Button>
          <Button asChild variant="outline" className="justify-start">
            <Link to="/about">
              <Info className="mr-2 h-4 w-4" /> О системах антиобледенения
            </Link>
          </Button>
        </div>
      </main>
    </div>
  );
}

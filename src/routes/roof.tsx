import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  calculateTotalLength,
  splitSaroRooftopSections,
  selectResistiveSections,
  calculateSaroRooftopElectrical,
  calculateResistiveElectrical,
  calculateGroups,
  calculateFasteners,
  getResistiveSnakeAlternatives,
  buildSpecification,
} from "@/lib/saro/calculations";
import { buildKpHtml, openKpWindow } from "@/lib/saro/kp";
import { round1, round2 } from "@/lib/saro/constants";
import type { ObjectStep, ZonesStep, CableChoice, SurfaceType, FastenerItem } from "@/lib/saro/types";
import { ChevronLeft, ChevronRight, Snowflake, Zap, Cable, Settings2, ClipboardCheck, RotateCcw, Copy, FileText, AlertTriangle, Info, Printer, Download } from "lucide-react";
import { BuildStatus } from "@/components/build-status";

const indexSearchSchema = z.object({
  env: z.enum(["preview", "published", "dev"]).optional(),
});

export const Route = createFileRoute("/roof")({
  validateSearch: zodValidator(indexSearchSchema),
  head: () => ({
    meta: [
      { title: "Калькулятор антиобледенения кровли SARO" },
      { name: "description", content: "Предварительный подбор греющего кабеля, мощности, секций и автоматики SARO для антиобледенения кровли." },
      { property: "og:title", content: "Калькулятор антиобледенения кровли SARO" },
      { property: "og:description", content: "Предварительный технический подбор материалов SARO: кабель, длина, мощность, токи, секции, группы, автоматика." },
    ],
  }),
  component: SaroCalculator,
});

const STEPS = [
  { id: 1, name: "Объект", icon: Info },
  { id: 2, name: "Зоны кровли", icon: Snowflake },
  { id: 3, name: "Кабель", icon: Cable },
  { id: 4, name: "Питание и автоматика", icon: Zap },
  { id: 5, name: "Результат", icon: ClipboardCheck },
];

const defaultObject: ObjectStep = {
  objectType: "private",
  roofType: "pitched",
  drainType: "external",
  automationPlace: "outdoor",
  powerChoice: "auto",
};

const defaultZones: ZonesStep = {
  surfaceType: "unknown",
  gutter: { enabled: true, length: 0, topExtraLine: true },
  hangingTray: { enabled: false, length: 0, widthCm: 15 },
  downpipes: { enabled: true, quantity: 0, height: 0, hasFunnel: true },
  valleys: { enabled: false, length: 0 },
  dripEdge: { enabled: false, length: 0 },
  slopeEdge: { enabled: false, length: 0, widthCm: 50, stepCm: 10 },
};

const SURFACE_OPTIONS: { value: SurfaceType; label: string }[] = [
  { value: "metal_drain", label: "Металлический водосток" },
  { value: "plastic_drain", label: "Пластиковый водосток" },
  { value: "metal_tile", label: "Металлочерепица / профлист" },
  { value: "seam_roof", label: "Фальцевая кровля" },
  { value: "soft_roof", label: "Мягкая кровля" },
  { value: "unknown", label: "Не знаю / подобрать универсально" },
];

function SaroCalculator() {
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(1);
  const [obj, setObj] = useState<ObjectStep>(defaultObject);
  const [zones, setZones] = useState<ZonesStep>(defaultZones);
  const [cable, setCable] = useState<CableChoice>("compare");

  const zoneResults = useMemo(() => calculateTotalLength(zones), [zones]);
  const totalLength = useMemo(() => zoneResults.reduce((a, z) => a + z.length, 0), [zoneResults]);
  const totalPower = useMemo(() => totalLength * 30, [totalLength]);

  const rooftopSections = useMemo(() => splitSaroRooftopSections(totalLength), [totalLength]);
  const resistiveSel = useMemo(() => selectResistiveSections(totalLength), [totalLength]);
  const rooftopElec = useMemo(() => calculateSaroRooftopElectrical(totalLength), [totalLength]);
  const resistiveElec = useMemo(() => calculateResistiveElectrical(resistiveSel), [resistiveSel]);

  const rooftopGrouping = useMemo(
    () => calculateGroups(rooftopSections.map((s) => ({ length: s.length, workingCurrent: s.workingCurrent, startupCurrent: s.startupCurrent })), obj.powerChoice, true),
    [rooftopSections, obj.powerChoice],
  );
  const resistiveGrouping = useMemo(
    () => calculateGroups(resistiveSel.details.map((d) => ({ length: d.length, workingCurrent: d.current })), obj.powerChoice, false),
    [resistiveSel, obj.powerChoice],
  );
  const fasteners = useMemo(() => calculateFasteners(zones), [zones]);

  const slopeResult = useMemo(() => zoneResults.find((z) => z.key === "slope") ?? null, [zoneResults]);
  const snakeAlternatives = useMemo(
    () =>
      zones.slopeEdge.enabled && slopeResult && zones.slopeEdge.length > 0 && zones.slopeEdge.widthCm > 0
        ? getResistiveSnakeAlternatives(slopeResult.length, zones.slopeEdge.length, zones.slopeEdge.widthCm)
        : null,
    [zones.slopeEdge, slopeResult],
  );
  const [snakeChoice, setSnakeChoice] = useState<number | null>(null);

  const resetAll = () => {
    setObj(defaultObject);
    setZones(defaultZones);
    setCable("compare");
    setSnakeChoice(null);
    setStep(1);
    setStarted(false);
  };

  if (!started) return <Landing onStart={() => setStarted(true)} />;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:py-10">
        <Progress current={step} />
        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="min-w-0">
            {step === 1 && <Step1 obj={obj} setObj={setObj} />}
            {step === 2 && <Step2 zones={zones} setZones={setZones} />}
            {step === 3 && <Step3 cable={cable} setCable={setCable} totalLength={totalLength} />}
            {step === 4 && (
              <Step4
                obj={obj}
                cable={cable}
                rooftopGrouping={rooftopGrouping}
                resistiveGrouping={resistiveGrouping}
                rooftopSections={rooftopSections}
                resistiveSel={resistiveSel}
              />
            )}
            {step === 5 && (
              <Step5
                obj={obj}
                zoneResults={zoneResults}
                cable={cable}
                rooftopSections={rooftopSections}
                rooftopElec={rooftopElec}
                resistiveSel={resistiveSel}
                resistiveElec={resistiveElec}
                rooftopGrouping={rooftopGrouping}
                resistiveGrouping={resistiveGrouping}
                fasteners={fasteners}
                surfaceType={zones.surfaceType}
                snakeAlternatives={snakeAlternatives}
                snakeChoice={snakeChoice}
                setSnakeChoice={setSnakeChoice}
                onReset={resetAll}
              />
            )}

            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
              <Button variant="outline" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1}>
                <ChevronLeft /> Назад
              </Button>
              {step < 5 ? (
                <Button onClick={() => setStep((s) => Math.min(5, s + 1))}>
                  Далее <ChevronRight />
                </Button>
              ) : (
                <Button variant="outline" onClick={resetAll}>
                  <RotateCcw /> Начать новый расчет
                </Button>
              )}
            </div>
          </div>

          <aside className="lg:sticky lg:top-6 lg:self-start">
            <SummaryCard
              totalLength={totalLength}
              totalPower={totalPower}
              cable={cable}
              zonesCount={zoneResults.length}
              rooftopSections={rooftopSections.length}
              resistiveSections={resistiveSel.sections.length}
              snakeAlternatives={snakeAlternatives}
              snakeChoice={snakeChoice}
            />
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function Header() {
  const { env } = Route.useSearch();
  const forceEnv = env === "preview" || env === "published" || env === "dev" ? env : undefined;

  return (
    <header className="border-b border-border bg-card/60 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold tracking-tight" title="Все калькуляторы">S</Link>
          <div>
            <div className="text-sm font-semibold leading-tight">SARO</div>
            <div className="text-xs text-muted-foreground leading-tight">Антиобледенение кровли</div>
          </div>
          <Link to="/" className="ml-2 hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline">Все калькуляторы</Link>
        </div>
        <div className="flex items-center gap-3">
          <BuildStatus forceEnv={forceEnv} />
          <Link to="/env" className="text-muted-foreground hover:text-foreground transition-colors" title="Информация об окружении">
            <Info className="h-4 w-4" />
          </Link>
          <Badge variant="secondary" className="hidden sm:inline-flex">Предварительный технический подбор</Badge>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-16 border-t border-border bg-card/40">
      <div className="mx-auto max-w-7xl px-4 py-6 text-xs text-muted-foreground">
        Калькулятор SARO - предварительный подбор материалов. Не является проектом. Электропитание и коммутацию должен проверять специалист.
      </div>
    </footer>
  );
}

function Landing({ onStart }: { onStart: () => void }) {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-4xl px-4 pb-16 pt-12 sm:pt-20">
        <div className="text-center">
          <Badge variant="secondary" className="mb-4">Инженерный калькулятор</Badge>
          <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-5xl">
            Калькулятор антиобледенения <span className="text-primary">кровли SARO</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-base text-muted-foreground sm:text-lg">
            Предварительный подбор греющего кабеля, мощности, секций и автоматики для систем антиобледенения кровли.
          </p>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground">
            Калькулятор рассчитывает путь движения талой воды: желоба, лотки, трубы, ендовы, капельники и карнизные зоны. Расчет не является проектом и требует проверки по схеме кровли.
          </p>
          <Button size="lg" className="mt-8 h-12 px-8 text-base" onClick={onStart}>
            Начать расчет <ChevronRight />
          </Button>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-3">
          {[
            { icon: Cable, t: "Кабель и секции", d: "SAROROOFTOP до 105 м или резистивные секции 10-120 м" },
            { icon: Zap, t: "Токи и автоматика", d: "Рабочий и пусковой ток, автоматы типа C, группировка" },
            { icon: Settings2, t: "Шкафы SARO", d: "1- и 3-фазные исполнения, DIN/щитовой или уличный" },
          ].map((f, i) => (
            <Card key={i} className="border-border/60">
              <CardContent className="p-5">
                <f.icon className="mb-3 text-primary" />
                <div className="font-semibold">{f.t}</div>
                <div className="mt-1 text-sm text-muted-foreground">{f.d}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}

function Progress({ current }: { current: number }) {
  return (
    <div>
      <ol className="flex items-center gap-2 overflow-x-auto">
        {STEPS.map((s) => {
          const Icon = s.icon;
          const active = current === s.id;
          const done = current > s.id;
          return (
            <li key={s.id} className="flex min-w-0 items-center gap-2">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : done
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground"
                }`}
              >
                {done ? "✓" : <Icon className="h-4 w-4" />}
              </div>
              <span className={`hidden whitespace-nowrap text-sm sm:inline ${active ? "font-semibold" : "text-muted-foreground"}`}>
                {s.id}. {s.name}
              </span>
              {s.id < STEPS.length && <div className="mx-1 h-px w-6 bg-border sm:w-10" />}
            </li>
          );
        })}
      </ol>
      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-border">
        <div className="h-full bg-primary transition-all" style={{ width: `${(current / STEPS.length) * 100}%` }} />
      </div>
    </div>
  );
}

function StepHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}

function Step1({ obj, setObj }: { obj: ObjectStep; setObj: (o: ObjectStep) => void }) {
  return (
    <section>
      <StepHeader title="Шаг 1. Объект" description="Базовые параметры объекта. Влияют на исполнение автоматики и расчет." />

      <Card>
        <CardContent className="grid gap-6 p-6 sm:grid-cols-2">
          <Field label="Тип объекта">
            <RadioGroup value={obj.objectType} onValueChange={(v) => setObj({ ...obj, objectType: v as ObjectStep["objectType"] })} className="gap-2">
              <RadioRow value="private" label="Частный малоэтажный дом" hint="По умолчанию" />
              <RadioRow value="other" label="Другой объект" hint="Для сложных объектов требуется индивидуальная проверка схемы кровли." />
            </RadioGroup>
          </Field>

          <Field label="Тип кровли">
            <RadioGroup value={obj.roofType} onValueChange={(v) => setObj({ ...obj, roofType: v as ObjectStep["roofType"] })} className="gap-2">
              <RadioRow value="pitched" label="Скатная" />
              <RadioRow value="flat" label="Плоская" />
              <RadioRow value="mixed" label="Смешанная" />
            </RadioGroup>
          </Field>

          <Field label="Тип водостока">
            <RadioGroup value={obj.drainType} onValueChange={(v) => setObj({ ...obj, drainType: v as ObjectStep["drainType"] })} className="gap-2">
              <RadioRow value="external" label="Наружный" />
              <RadioRow value="internal" label="Внутренний" />
              <RadioRow value="mixed" label="Смешанный" />
            </RadioGroup>
          </Field>

          <Field label="Место установки автоматики">
            <RadioGroup value={obj.automationPlace} onValueChange={(v) => setObj({ ...obj, automationPlace: v as ObjectStep["automationPlace"] })} className="gap-2">
              <RadioRow value="outdoor" label="На улице" />
              <RadioRow value="indoor" label="В помещении или электрощите" />
            </RadioGroup>
          </Field>

          <Field label="Питание" className="sm:col-span-2">
            <RadioGroup value={obj.powerChoice} onValueChange={(v) => setObj({ ...obj, powerChoice: v as ObjectStep["powerChoice"] })} className="grid gap-2 sm:grid-cols-3">
              <RadioRow value="auto" label="Подобрать автоматически" />
              <RadioRow value="1ph" label="1 фаза" />
              <RadioRow value="3ph" label="3 фазы" />
            </RadioGroup>
          </Field>
        </CardContent>
      </Card>

      <HintAlert>
        Место установки влияет на исполнение автоматики: уличное или DIN/щитовой вариант. Питание можно выбрать вручную или оставить автоматический подбор.
      </HintAlert>
    </section>
  );
}

function RadioRow({ value, label, hint }: { value: string; label: string; hint?: string }) {
  return (
    <label
      htmlFor={`r-${value}`}
      className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-card p-3 transition-colors hover:border-primary/50 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
    >
      <RadioGroupItem id={`r-${value}`} value={value} className="mt-0.5" />
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
      </div>
    </label>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="mb-2 text-sm font-semibold">{label}</div>
      {children}
    </div>
  );
}

function NumberInput({
  value, onChange, unit, min = 0, step = 0.1, placeholder,
}: { value: number; onChange: (n: number) => void; unit: string; min?: number; step?: number; placeholder?: string }) {
  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        inputMode="decimal"
        value={Number.isFinite(value) && value !== 0 ? value : ""}
        min={min}
        step={step}
        placeholder={placeholder ?? "0"}
        onChange={(e) => {
          const v = e.target.value.replace(",", ".");
          const n = parseFloat(v);
          onChange(Number.isFinite(n) ? n : 0);
        }}
      />
      <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">{unit}</span>
    </div>
  );
}

function HintAlert({ children }: { children: React.ReactNode }) {
  return (
    <Alert className="mt-6 border-primary/20 bg-primary/5">
      <Info className="h-4 w-4 text-primary" />
      <AlertDescription className="text-sm">{children}</AlertDescription>
    </Alert>
  );
}

function ZoneCard({
  title, enabled, onToggle, hint, children,
}: { title: string; enabled: boolean; onToggle: (b: boolean) => void; hint?: string; children?: React.ReactNode }) {
  return (
    <Card className={enabled ? "border-primary/40" : ""}>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-3">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          {hint && <CardDescription className="mt-1 text-xs">{hint}</CardDescription>}
        </div>
        <Switch checked={enabled} onCheckedChange={onToggle} />
      </CardHeader>
      {enabled && <CardContent className="grid gap-4 pt-0 sm:grid-cols-2">{children}</CardContent>}
    </Card>
  );
}

type ZoneObjectKey = Exclude<keyof ZonesStep, "surfaceType">;

function Step2({ zones, setZones }: { zones: ZonesStep; setZones: (z: ZonesStep) => void }) {
  const update = <K extends ZoneObjectKey>(key: K, patch: Partial<ZonesStep[K]>) =>
    setZones({ ...zones, [key]: { ...zones[key], ...patch } });

  return (
    <section className="space-y-4">
      <StepHeader title="Шаг 2. Зоны кровли" description="Включите зоны, по которым нужен расчет. Не знаете точную длину? Укажите приблизительно, а затем проверьте по схеме кровли." />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Тип поверхности / водостока</CardTitle>
          <CardDescription>Влияет на тип крепежа в спецификации. Длина и мощность кабеля не зависят от этого выбора.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select value={zones.surfaceType} onValueChange={(v) => setZones({ ...zones, surfaceType: v as SurfaceType })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {SURFACE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="text-xs text-muted-foreground">
            Тип крепежа зависит от материала кровли и водосточной системы. В первой версии калькулятор выдаёт предварительный перечень крепежа без привязки к конкретной модели.
          </div>
        </CardContent>
      </Card>

      <ZoneCard
        title="Кровельный желоб"
        enabled={zones.gutter.enabled}
        onToggle={(b) => update("gutter", { enabled: b })}
        hint="Минимум 3 нитки внутри. Кровельный желоб и подвесной лоток считаются отдельно."
      >
        <Field label="Суммарная длина желоба">
          <NumberInput value={zones.gutter.length} onChange={(n) => update("gutter", { length: n })} unit="м" />
        </Field>
        <Field label="Дополнительная нитка по верху желоба">
          <label className="flex cursor-pointer items-center gap-3 rounded-md border border-border bg-card p-3">
            <Switch checked={zones.gutter.topExtraLine} onCheckedChange={(b) => update("gutter", { topExtraLine: b })} />
            <span className="text-sm">Усиление края (рекомендуется)</span>
          </label>
        </Field>
      </ZoneCard>

      <ZoneCard
        title="Подвесной лоток"
        enabled={zones.hangingTray.enabled}
        onToggle={(b) => update("hangingTray", { enabled: b })}
        hint="Наружный подвесной элемент водосточной системы. Не путать с кровельным желобом."
      >
        <Field label="Суммарная длина лотка">
          <NumberInput value={zones.hangingTray.length} onChange={(n) => update("hangingTray", { length: n })} unit="м" />
        </Field>
        <Field label="Ширина лотка">
          <NumberInput value={zones.hangingTray.widthCm} onChange={(n) => update("hangingTray", { widthCm: n })} unit="см" step={1} />
          <div className="mt-1 text-xs text-muted-foreground">До 15 см - 2 нитки, от 15 см - 3 нитки</div>
        </Field>
      </ZoneCard>

      <ZoneCard
        title="Водосточные трубы"
        enabled={zones.downpipes.enabled}
        onToggle={(b) => update("downpipes", { enabled: b })}
        hint="1 нитка по высоте, +1 м усиление в нижней части, +1,5 м на воронку"
      >
        <Field label="Количество труб">
          <NumberInput value={zones.downpipes.quantity} onChange={(n) => update("downpipes", { quantity: n })} unit="шт" step={1} />
        </Field>
        <Field label="Высота одной трубы">
          <NumberInput value={zones.downpipes.height} onChange={(n) => update("downpipes", { height: n })} unit="м" />
        </Field>
        <Field label="Воронка сверху" className="sm:col-span-2">
          <label className="flex cursor-pointer items-center gap-3 rounded-md border border-border bg-card p-3">
            <Switch checked={zones.downpipes.hasFunnel} onCheckedChange={(b) => update("downpipes", { hasFunnel: b })} />
            <span className="text-sm">Труба с воронкой сверху</span>
          </label>
        </Field>
      </ZoneCard>

      <ZoneCard
        title="Ендовы"
        enabled={zones.valleys.enabled}
        onToggle={(b) => update("valleys", { enabled: b })}
        hint="1/2 длины ендовы, 2 нитки кабеля"
      >
        <Field label="Суммарная длина ендов">
          <NumberInput value={zones.valleys.length} onChange={(n) => update("valleys", { length: n })} unit="м" />
        </Field>
      </ZoneCard>

      <ZoneCard
        title="Капельник"
        enabled={zones.dripEdge.enabled}
        onToggle={(b) => update("dripEdge", { enabled: b })}
        hint="1 нитка по длине капельника"
      >
        <Field label="Длина капельника">
          <NumberInput value={zones.dripEdge.length} onChange={(n) => update("dripEdge", { length: n })} unit="м" />
        </Field>
      </ZoneCard>

      <ZoneCard
        title="Карнизная зона ската / край ската змейкой"
        enabled={zones.slopeEdge.enabled}
        onToggle={(b) => update("slopeEdge", { enabled: b })}
        hint="Кабель укладывается змейкой по нижней части ската. Не заменяет капельник, желоб и трубу."
      >
        <Field label="Длина края ската">
          <NumberInput value={zones.slopeEdge.length} onChange={(n) => update("slopeEdge", { length: n })} unit="м" />
        </Field>
        <Field label="Ширина обогреваемой полосы">
          <NumberInput value={zones.slopeEdge.widthCm} onChange={(n) => update("slopeEdge", { widthCm: n })} unit="см" step={1} />
        </Field>
        <Field label="Шаг укладки">
          <Select value={String(zones.slopeEdge.stepCm)} onValueChange={(v) => update("slopeEdge", { stepCm: Number(v) })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="8">8 см</SelectItem>
              <SelectItem value="10">10 см (по умолчанию)</SelectItem>
              <SelectItem value="12">12 см</SelectItem>
              <SelectItem value="15">15 см</SelectItem>
              <SelectItem value="20">20 см (экономичный)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {zones.slopeEdge.stepCm === 20 && (
          <Alert variant="default" className="sm:col-span-2 border-amber-500/40 bg-amber-50 dark:bg-amber-950/20">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-xs">
              Шаг 20 см дает редкую укладку и меньшую удельную мощность. Используйте только осознанно и после проверки достаточности мощности для конкретной кровли.
            </AlertDescription>
          </Alert>
        )}
      </ZoneCard>
    </section>
  );
}

function Step3({ cable, setCable, totalLength }: { cable: CableChoice; setCable: (c: CableChoice) => void; totalLength: number }) {
  return (
    <section>
      <StepHeader title="Шаг 3. Кабель" description="Выберите тип расчета кабеля или сравните оба варианта SARO." />

      <RadioGroup value={cable} onValueChange={(v) => setCable(v as CableChoice)} className="grid gap-3 sm:grid-cols-3">
        <CableOption value="rooftop" title="SAROROOFTOP" desc="Саморегулирующийся, 30 Вт/м, режется. Секция до 105 м." selected={cable === "rooftop"} />
        <CableOption value="resistive" title="Резистивные секции SARO" desc="Готовые секции 10-120 м, шаг 10 м, не режутся." selected={cable === "resistive"} />
        <CableOption value="compare" title="Сравнить варианты" desc="Показать оба расчета параллельно (по умолчанию)." selected={cable === "compare"} />
      </RadioGroup>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Расчетная длина кабеля</CardTitle>
          <CardDescription>На основе включенных зон шага 2</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-primary">{round1(totalLength)} м</div>
          <div className="mt-1 text-sm text-muted-foreground">Мощность ~ {round2(totalLength * 30 / 1000)} кВт</div>
        </CardContent>
      </Card>

      <HintAlert>
        Для резистивного кабеля важна схема укладки, потому что секции не режутся. Для саморегулирующегося кабеля важен пусковой ток при холодном старте.
      </HintAlert>
    </section>
  );
}

function CableOption({ value, title, desc, selected }: { value: string; title: string; desc: string; selected: boolean }) {
  return (
    <label
      htmlFor={`c-${value}`}
      className={`cursor-pointer rounded-lg border p-4 transition-colors ${selected ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/50"}`}
    >
      <div className="flex items-start gap-2">
        <RadioGroupItem id={`c-${value}`} value={value} className="mt-0.5" />
        <div>
          <div className="font-semibold">{title}</div>
          <div className="mt-1 text-xs text-muted-foreground">{desc}</div>
        </div>
      </div>
    </label>
  );
}

function Step4({
  obj, cable, rooftopGrouping, resistiveGrouping, rooftopSections, resistiveSel,
}: any) {
  const showRoof = cable === "rooftop" || cable === "compare";
  const showRes = cable === "resistive" || cable === "compare";
  const automationLabel = obj.automationPlace === "outdoor" ? "уличное исполнение" : "DIN / щитовой вариант";

  return (
    <section className="space-y-4">
      <StepHeader title="Шаг 4. Питание и автоматика" description="Группировка секций, проверка по ограничениям шкафа SARO и подбор автоматики." />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Общие параметры</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <KV k="Напряжение" v="230 В" />
          <KV k="Автоматы" v="тип C" />
          <KV k="Шкаф SARO - макс. рабочая нагрузка" v="3 фазы × 32 А" />
          <KV k="Шкаф SARO - макс. пусковой ток группы" v="38 А" />
          <KV k="Место установки автоматики" v={automationLabel} />
        </CardContent>
      </Card>

      {showRoof && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">SAROROOFTOP - группы и питание</CardTitle>
            <CardDescription>Учет пускового тока при -15 °C, ограничение 38 А пускового тока группы</CardDescription>
          </CardHeader>
          <CardContent>
            <GroupingView grouping={rooftopGrouping} sections={rooftopSections.map((s: any) => ({ length: s.length, w: s.workingCurrent, st: s.startupCurrent }))} isRooftop />
          </CardContent>
        </Card>
      )}

      {showRes && resistiveSel.sections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Резистивные секции SARO - группы и питание</CardTitle>
            <CardDescription>Ограничение 32 А рабочего тока на фазу</CardDescription>
          </CardHeader>
          <CardContent>
            <GroupingView grouping={resistiveGrouping} sections={resistiveSel.details.map((d: any) => ({ length: d.length, w: d.current }))} />
          </CardContent>
        </Card>
      )}

      <AutomationCards obj={obj} />
    </section>
  );
}

function GroupingView({ grouping, sections, isRooftop = false }: any) {
  if (!sections.length) return <div className="text-sm text-muted-foreground">Нет секций для расчета. Заполните зоны на шаге 2.</div>;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant={grouping.phases === 3 ? "default" : "secondary"}>{grouping.phases === 3 ? "3 фазы" : "1 фаза"}</Badge>
        <Badge variant="outline">Автомат тип C</Badge>
        {grouping.withinCabinetLimits ? (
          <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-400">В пределах шкафа SARO</Badge>
        ) : (
          <Badge variant="destructive">Превышение - проверка</Badge>
        )}
      </div>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="p-2">Группа</th>
              <th className="p-2">Фаза</th>
              <th className="p-2">Секции</th>
              <th className="p-2">Рабочий ток</th>
              {isRooftop && <th className="p-2">Пусковой ток</th>}
            </tr>
          </thead>
          <tbody>
            {grouping.groups.map((g: any) => (
              <tr key={g.index} className="border-t border-border">
                <td className="p-2 font-medium">№{g.index}</td>
                <td className="p-2">L{g.phase}</td>
                <td className="p-2">{g.sections.map((s: any) => `${round1(s.length)} м`).join(" + ")}</td>
                <td className="p-2">{g.workingCurrent} А</td>
                {isRooftop && <td className="p-2">{g.startupCurrent} А</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {grouping.notes.map((n: string, i: number) => (
        <div key={i} className="text-xs text-muted-foreground">- {n}</div>
      ))}
    </div>
  );
}

function AutomationCards({ obj }: { obj: ObjectStep }) {
  const isOutdoor = obj.automationPlace === "outdoor";
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {isOutdoor ? "Уличный терморегулятор / метеостанция SARO" : "DIN-терморегулятор / DIN-метеостанция SARO"}
          </CardTitle>
          <CardDescription>
            Подходит, если автоматика подбирается как отдельное устройство. Исполнение зависит от места установки.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Точная модель подбирается по мощности, количеству групп, типу кабеля и месту установки.
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {isOutdoor ? "Уличный шкаф управления SARO в сборе" : "Шкаф управления SARO для помещения / электрощита"}
          </CardTitle>
          <CardDescription>
            Готовое решение с внутренним контактором и силовой автоматикой. Исполнение подбирается для улицы или помещения / электрощита.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Точная модель подбирается по мощности, количеству групп, типу кабеля и месту установки.
        </CardContent>
      </Card>
    </div>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}

function Step5({
  obj, zoneResults, cable, rooftopSections, rooftopElec, resistiveSel, resistiveElec, rooftopGrouping, resistiveGrouping, fasteners, surfaceType, snakeAlternatives, snakeChoice, setSnakeChoice, onReset,
}: any) {
  const [spec, setSpec] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [kpOrientation, setKpOrientation] = useState<"portrait" | "landscape">("portrait");
  const totalLen = zoneResults.reduce((a: number, z: any) => a + z.length, 0);

  const showRoof = cable === "rooftop" || cable === "compare";
  const showRes = cable === "resistive" || cable === "compare";

  const buildSnakePayload = () => {
    if (!snakeAlternatives) return { snakeChoice: null, snakeFallback: null };
    const pick = (s: any) => s ? { sectionLengthM: s.sectionLengthM, actualStepCm: s.actualStepCm } : null;
    if (snakeChoice != null) {
      const found = [snakeAlternatives.lower, snakeAlternatives.upper].find((a: any) => a && a.sectionLengthM === snakeChoice);
      return { snakeChoice: pick(found), snakeFallback: null };
    }
    return { snakeChoice: null, snakeFallback: pick(snakeAlternatives.upper ?? snakeAlternatives.lower) };
  };

  const generateSpec = () => {
    const primaryCable = cable === "resistive" ? "resistive" : "rooftop";
    const { snakeChoice: sc, snakeFallback: sf } = buildSnakePayload();
    const text = buildSpecification({
      obj,
      zones: zoneResults,
      cable: primaryCable,
      surfaceType,
      rooftopSections: primaryCable === "rooftop" ? rooftopSections : undefined,
      resistive: primaryCable === "resistive" ? resistiveSel : undefined,
      grouping: primaryCable === "rooftop" ? rooftopGrouping : resistiveGrouping,
      fasteners,
      snakeChoice: primaryCable === "resistive" ? sc : null,
      snakeFallback: primaryCable === "resistive" ? sf : null,
    });
    setSpec(text);
  };

  const buildKp = () => {
    const primaryCable = cable === "resistive" ? "resistive" : "rooftop";
    const { snakeChoice: sc, snakeFallback: sf } = buildSnakePayload();
    return buildKpHtml({
      obj,
      zones: zoneResults,
      cable,
      surfaceType,
      rooftopSections,
      rooftopElec,
      resistive: resistiveSel,
      resistiveElec,
      rooftopGrouping,
      resistiveGrouping,
      fasteners,
      snakeChoice: primaryCable === "resistive" ? sc : null,
      snakeFallback: primaryCable === "resistive" ? sf : null,
      orientation: kpOrientation,
    });
  };

  const printKp = () => openKpWindow(buildKp(), true);
  const previewKp = () => openKpWindow(buildKp(), false);
  const downloadKp = () => {
    const html = buildKp();
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `KP-SARO-${new Date().toISOString().slice(0, 10)}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const copyResult = async () => {
    const text = spec ?? `SARO - предварительный подбор\nДлина: ${round1(totalLen)} м\nМощность: ${round2(totalLen * 30 / 1000)} кВт\nКабель: ${cable === "resistive" ? "Резистивные секции SARO" : "SAROROOFTOP"}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  return (
    <section className="space-y-6">
      <StepHeader title="Шаг 5. Результат" description="Итог предварительного технического подбора SARO." />

      <Card className="overflow-hidden border-primary/40">
        <div className="bg-primary/5 p-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-primary">Итог расчета</div>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Расчетная длина" value={`${round1(totalLen)} м`} />
            <Stat label="Рабочая мощность" value={`${round2(totalLen * 30 / 1000)} кВт`} />
            <Stat label="Рабочий ток" value={`${round1(totalLen * 30 / 230)} А`} />
            <Stat label="Тип кабеля" value={cable === "compare" ? "Сравнение" : cable === "rooftop" ? "SAROROOFTOP" : "Резистивный SARO"} />
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Расчет по зонам</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-3">Зона</th>
                  <th className="p-3">Введенные размеры</th>
                  <th className="p-3">Правило</th>
                  <th className="p-3">Длина</th>
                  <th className="p-3">Мощность</th>
                </tr>
              </thead>
              <tbody>
                {zoneResults.length === 0 ? (
                  <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">Зоны не выбраны</td></tr>
                ) : zoneResults.map((z: any) => (
                  <tr key={z.key} className="border-t border-border">
                    <td className="p-3 font-medium">{z.name}</td>
                    <td className="p-3 text-muted-foreground">{z.inputs}</td>
                    <td className="p-3 text-muted-foreground">{z.rule}</td>
                    <td className="p-3">{round1(z.length)} м</td>
                    <td className="p-3">{round2(z.power / 1000)} кВт</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {showRoof && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Вариант SAROROOFTOP</CardTitle>
            <CardDescription>Саморегулирующийся 30 Вт/м, секция до 105 м, пусковой коэффициент 1:2,5</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat small label="Общая длина" value={`${rooftopElec.totalLength} м`} />
              <Stat small label="Мощность" value={`${rooftopElec.totalPower} кВт`} />
              <Stat small label="Пусковой ток (-15 °C)" value={`${rooftopElec.totalStartup} А`} />
            </div>
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-2">Секция</th>
                    <th className="p-2">Длина</th>
                    <th className="p-2">Мощность</th>
                    <th className="p-2">Рабочий ток</th>
                    <th className="p-2">Пусковой ток</th>
                    <th className="p-2">Автомат</th>
                  </tr>
                </thead>
                <tbody>
                  {rooftopSections.map((s: any) => (
                    <tr key={s.index} className="border-t border-border">
                      <td className="p-2 font-medium">№{s.index}</td>
                      <td className="p-2">{s.length} м</td>
                      <td className="p-2">{round2(s.power / 1000)} кВт</td>
                      <td className="p-2">{s.workingCurrent} А</td>
                      <td className="p-2">
                        {s.startupCurrent} А {s.startupCurrent > 38 && <Badge variant="destructive" className="ml-1">&gt;38 А</Badge>}
                      </td>
                      <td className="p-2">{s.breaker}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="text-xs text-muted-foreground">Рекомендуемый автомат на максимальную секцию 105 м: C25</div>
          </CardContent>
        </Card>
      )}

      {showRes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Вариант резистивных секций SARO</CardTitle>
            <CardDescription>Готовые секции 30 Вт/м, шаг 10 м, не режутся</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat small label="Расчетная потребность" value={`${round1(totalLen)} м`} />
              <Stat small label="Итоговая длина" value={`${resistiveSel.totalLength} м`} />
              <Stat small label="Избыток" value={`${resistiveSel.excess} м`} />
            </div>
            {resistiveSel.details.length > 0 ? (
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="p-2">Секция</th>
                      <th className="p-2">Длина</th>
                      <th className="p-2">Мощность</th>
                      <th className="p-2">Ток</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resistiveSel.details.map((d: any, i: number) => (
                      <tr key={i} className="border-t border-border">
                        <td className="p-2 font-medium">№{i + 1}</td>
                        <td className="p-2">{d.length} м</td>
                        <td className="p-2">{round2(d.power / 1000)} кВт</td>
                        <td className="p-2">{d.current} А</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div className="text-sm text-muted-foreground">Нет данных для подбора секций.</div>}
            <Alert className="border-amber-500/40 bg-amber-50 dark:bg-amber-950/20">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-xs">
                Резистивные секции SARO не режутся. Подобранную длину нужно проверить по схеме укладки. Излишек нельзя отрезать.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {showRes && snakeAlternatives && (snakeAlternatives.lower || snakeAlternatives.upper) && (
        <SnakeAlternativesCard
          slopeLength={zoneResults.find((z: any) => z.key === "slope")?.length ?? 0}
          alternatives={snakeAlternatives}
          choice={snakeChoice}
          setChoice={setSnakeChoice}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Питание и группы</CardTitle>
          <CardDescription>Проверка по ограничениям шкафа SARO</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {showRoof && rooftopSections.length > 0 && (
            <div>
              <div className="mb-2 text-sm font-semibold">SAROROOFTOP</div>
              <GroupingView grouping={rooftopGrouping} sections={rooftopSections.map((s: any) => ({ length: s.length }))} isRooftop />
            </div>
          )}
          {showRes && resistiveSel.details.length > 0 && (
            <div>
              <div className="mb-2 text-sm font-semibold">Резистивные секции SARO</div>
              <GroupingView grouping={resistiveGrouping} sections={resistiveSel.details.map((d: any) => ({ length: d.length }))} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Крепёж и монтажные элементы SARO</CardTitle>
          <CardDescription>Предварительный перечень без привязки к конкретной модели. Запас 10%, количества округлены вверх.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {fasteners && fasteners.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-3">Зона</th>
                    <th className="p-3">Позиция</th>
                    <th className="p-3">Кол-во</th>
                    <th className="p-3">Примечание</th>
                  </tr>
                </thead>
                <tbody>
                  {fasteners.map((f: FastenerItem, i: number) => (
                    <tr key={i} className="border-t border-border">
                      <td className="p-3 font-medium">{f.zone}</td>
                      <td className="p-3">{f.item}</td>
                      <td className="p-3 whitespace-nowrap">{f.quantity} {f.unit}</td>
                      <td className="p-3 text-muted-foreground">{f.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-4 text-sm text-muted-foreground">Нет данных для расчета крепежа - включите зоны на шаге 2.</div>
          )}
        </CardContent>
      </Card>

      <div>
        <h3 className="mb-3 text-base font-semibold">Управление SARO</h3>
        <AutomationCards obj={obj} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-600" /> Предупреждения</CardTitle></CardHeader>
        <CardContent>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {[
              "Расчет является предварительным подбором материалов SARO.",
              "Калькулятор не рассчитывает монтаж и стоимость монтажных работ.",
              "Для точной спецификации нужна схема кровли или фото объекта.",
              "Крепёж рассчитан предварительно. Конкретный тип крепежа зависит от материала кровли, водосточной системы и способа фиксации кабеля.",
              "Резистивные секции SARO не режутся.",
              "SAROROOFTOP ограничен 105 м на одну секцию.",
              "Для SAROROOFTOP нужно учитывать пусковой ток при холодном старте.",
              "При большой мощности систему нужно делить на группы.",
              "Электропитание, защиту и коммутацию должен проверять специалист.",
            ].map((w, i) => <li key={i} className="flex gap-2"><span className="text-primary">•</span>{w}</li>)}
          </ul>
        </CardContent>
      </Card>

      <Card className="border-primary/40 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="text-base">Действия с коммерческим предложением</CardTitle>
          <CardDescription>Сформируйте красивое КП для отправки заказчику, распечатайте или сохраните в PDF.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium">Ориентация A4:</span>
            <div className="inline-flex rounded-md border bg-background p-0.5">
              <Button
                size="sm"
                variant={kpOrientation === "portrait" ? "default" : "ghost"}
                onClick={() => setKpOrientation("portrait")}
                className="h-8"
              >
                Книжная
              </Button>
              <Button
                size="sm"
                variant={kpOrientation === "landscape" ? "default" : "ghost"}
                onClick={() => setKpOrientation("landscape")}
                className="h-8"
              >
                Альбомная
              </Button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Button size="lg" onClick={previewKp} className="justify-start">
              <FileText /> Открыть КП
            </Button>
            <Button size="lg" variant="secondary" onClick={printKp} className="justify-start">
              <Printer /> Печать / сохранить PDF
            </Button>
            <Button size="lg" variant="outline" onClick={downloadKp} className="justify-start">
              <Download /> Скачать (HTML)
            </Button>
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            Кнопка «Печать / сохранить PDF» откроет КП и вызовет диалог печати — в нём выберите «Сохранить как PDF» для получения PDF-файла. Ориентацию также можно поменять прямо в окне КП.
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={generateSpec}><FileText /> Текстовая спецификация</Button>
        <Button variant="outline" onClick={copyResult}><Copy /> {copied ? "Скопировано" : "Скопировать расчет"}</Button>
        <Button variant="ghost" onClick={onReset}><RotateCcw /> Начать новый расчет</Button>
      </div>

      {spec && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Спецификация SARO</CardTitle>
            <CardDescription>Без цен. Предварительный подбор.</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-muted p-4 text-xs">{spec}</pre>
          </CardContent>
        </Card>
      )}
    </section>
  );
}

function SnakeAlternativesCard({
  slopeLength, alternatives, choice, setChoice,
}: {
  slopeLength: number;
  alternatives: { lower: any; upper: any };
  choice: number | null;
  setChoice: (n: number | null) => void;
}) {
  const renderAlt = (a: any, title: string) => {
    if (!a) return null;
    const selected = choice === a.sectionLengthM;
    return (
      <label
        className={`flex cursor-pointer flex-col gap-2 rounded-md border p-4 transition-colors ${
          selected ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/50"
        }`}
        onClick={() => setChoice(selected ? null : a.sectionLengthM)}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-semibold">{title}</div>
          {selected && <Badge>Выбрано</Badge>}
        </div>
        <div className="text-2xl font-bold text-primary">{a.sectionLengthM} м</div>
        <div className="text-sm">Фактический шаг укладки ~ <span className="font-semibold">{a.actualStepCm} см</span></div>
        <div className="text-xs text-muted-foreground">
          {a.direction === "lower" ? "Укладка станет реже, удельная мощность снизится." : "Укладка станет плотнее, удельная мощность увеличится."}
        </div>
        {a.warnings.map((w: string, i: number) => (
          <div key={i} className="flex gap-1.5 rounded-md border border-amber-500/40 bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/20 dark:text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> <span>{w}</span>
          </div>
        ))}
      </label>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Край ската змейкой - подбор резистивной секции</CardTitle>
        <CardDescription>
          Расчетная длина змейки: {round1(slopeLength)} м. Резистивная секция не режется, поэтому шаг змейки можно скорректировать под фактическую длину секции.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          {renderAlt(alternatives.lower, "Ближайшая меньшая секция")}
          {renderAlt(alternatives.upper, "Ближайшая большая секция")}
        </div>
        <div className="text-xs text-muted-foreground">
          Выберите вариант после проверки кровли. Резистивная секция не режется, поэтому шаг змейки можно скорректировать под фактическую длину секции.
        </div>
        {choice == null && (
          <Alert className="border-amber-500/40 bg-amber-50 dark:bg-amber-950/20">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-xs">
              Вариант не выбран - в спецификацию попадёт ближайшая большая секция с пометкой "требуется проверка шага укладки".
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, small = false }: { label: string; value: React.ReactNode; small?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={small ? "mt-1 text-lg font-semibold" : "mt-1 text-2xl font-bold"}>{value}</div>
    </div>
  );
}

function SummaryCard({
  totalLength, totalPower, cable, zonesCount, rooftopSections, resistiveSections, snakeAlternatives, snakeChoice,
}: { totalLength: number; totalPower: number; cable: CableChoice; zonesCount: number; rooftopSections: number; resistiveSections: number; snakeAlternatives?: any; snakeChoice?: number | null }) {
  const showSnake = (cable === "resistive" || cable === "compare") && snakeAlternatives && (snakeAlternatives.lower || snakeAlternatives.upper);
  const selected = showSnake && snakeChoice != null
    ? [snakeAlternatives.lower, snakeAlternatives.upper].find((a: any) => a && a.sectionLengthM === snakeChoice)
    : null;
  const fallback = showSnake && snakeChoice == null
    ? (snakeAlternatives.upper ?? snakeAlternatives.lower)
    : null;
  const snakeShown = selected ?? fallback;
  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Текущий расчет</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="text-xs text-muted-foreground">Длина кабеля</div>
          <div className="text-3xl font-bold text-primary">{round1(totalLength)} <span className="text-base font-medium text-muted-foreground">м</span></div>
        </div>
        <Separator />
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Мощность</div>
            <div className="font-semibold">{round2(totalPower / 1000)} кВт</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Ток</div>
            <div className="font-semibold">{round1(totalPower / 230)} А</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Зон</div>
            <div className="font-semibold">{zonesCount}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Кабель</div>
            <div className="font-semibold text-xs">{cable === "compare" ? "Сравнение" : cable === "rooftop" ? "SAROROOFTOP" : "Резистивный"}</div>
          </div>
        </div>
        <Separator />
        <div className="space-y-1 text-xs text-muted-foreground">
          {(cable === "rooftop" || cable === "compare") && <div>SAROROOFTOP: {rooftopSections} секц. до 105 м</div>}
          {(cable === "resistive" || cable === "compare") && <div>Резистивных секций: {resistiveSections}</div>}
        </div>
        {showSnake && snakeShown && (
          <>
            <Separator />
            <div className="space-y-1">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Край ската змейкой</div>
              <div className="text-sm">
                Секция: <span className="font-semibold">{snakeShown.sectionLengthM} м</span>
                {!selected && <span className="ml-1 text-xs text-muted-foreground">(по умолчанию)</span>}
              </div>
              <div className="text-sm">
                Шаг укладки: <span className="font-semibold">{snakeShown.actualStepCm} см</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

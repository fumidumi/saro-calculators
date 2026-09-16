import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

interface SpacingOptimizationChartProps {
  platformLength: number;
  platformWidth: number;
  stairsLength: number;
  currentSpacing: number;
  selectedSection: number;
}

const MIN_SPACING = 7.5;
const MAX_SPACING = 12.5;
const TARGET_SPACING = 10;

const SpacingOptimizationChart = ({
  platformLength,
  platformWidth,
  currentSpacing,
  selectedSection,
}: SpacingOptimizationChartProps) => {
  const area = platformLength * platformWidth;
  const spacing = Number.isFinite(currentSpacing) ? currentSpacing : 0;

  // Статус
  let status: "optimal" | "acceptable" | "critical" = "critical";
  if (spacing >= 9 && spacing <= 11) status = "optimal";
  else if (spacing >= MIN_SPACING && spacing <= MAX_SPACING) status = "acceptable";

  const statusMeta = {
    optimal: {
      label: "Оптимальный шаг",
      color: "hsl(142 71% 45%)",
      Icon: CheckCircle2,
      hint: "Параметры площадки идеально подходят под выбранную секцию кабеля.",
    },
    acceptable: {
      label: "Допустимый шаг",
      color: "hsl(48 96% 53%)",
      Icon: AlertTriangle,
      hint: spacing < TARGET_SPACING
        ? "Шаг плотнее целевого 10 см — мощность на м² выше нормы. Можно немного увеличить площадку или взять секцию короче."
        : "Шаг шире целевого 10 см — мощность на м² ниже нормы. Можно уменьшить площадку или взять секцию длиннее.",
    },
    critical: {
      label: spacing < MIN_SPACING ? "Шаг слишком плотный" : "Шаг слишком редкий",
      color: "var(--destructive)",
      Icon: XCircle,
      hint: spacing < MIN_SPACING
        ? "Кабель будет лежать слишком плотно — риск перегрева. Увеличьте площадку или выберите секцию короче."
        : "Кабель уложен слишком редко — мощности не хватит. Уменьшите площадку или возьмите секцию длиннее.",
    },
  }[status];

  // Позиция указателя на шкале (диапазон отображения 5–15 см)
  const SCALE_MIN = 5;
  const SCALE_MAX = 15;
  const clamped = Math.max(SCALE_MIN, Math.min(SCALE_MAX, spacing));
  const pointerPct = ((clamped - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100;
  const minPct = ((MIN_SPACING - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100;
  const maxPct = ((MAX_SPACING - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100;
  const targetPct = ((TARGET_SPACING - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100;

  const StatusIcon = statusMeta.Icon;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <CardTitle>Шаг укладки кабеля</CardTitle>
            <CardDescription>
              Расстояние между соседними нитями кабеля на площадке
            </CardDescription>
          </div>
          <TooltipProvider>
            <UITooltip>
              <TooltipTrigger asChild>
                <button className="p-1.5 rounded-full hover:bg-accent transition-colors">
                  <Info className="h-5 w-5 text-muted-foreground" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs p-4 space-y-2 text-xs">
                <p className="font-semibold text-sm">Что это такое:</p>
                <p>
                  После того как мы выбрали стандартную секцию кабеля, остаток длины
                  раскладывается «змейкой» по площадке. Шаг — расстояние между соседними
                  нитями кабеля.
                </p>
                <p><strong>7.5–12.5 см</strong> — допустимый коридор по теплотехнике.</p>
                <p><strong>9–11 см</strong> — оптимальная зона около цели 10 см.</p>
                <p>
                  Чтобы сместить шаг — измените длину или ширину площадки, либо примите
                  другую секцию кабеля.
                </p>
              </TooltipContent>
            </UITooltip>
          </TooltipProvider>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Главное число + статус */}
        <div className="flex items-center justify-between gap-4 p-4 rounded-lg border bg-muted/30">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">
              Итоговый шаг
            </div>
            <div className="text-3xl font-bold mt-0.5">
              {spacing > 0 ? `${spacing.toFixed(1)} см` : "—"}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              цель: {TARGET_SPACING} см • допустимо: {MIN_SPACING}–{MAX_SPACING} см
            </div>
          </div>
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium"
            style={{ backgroundColor: `${statusMeta.color}20`, color: statusMeta.color }}
          >
            <StatusIcon className="h-5 w-5" />
            {statusMeta.label}
          </div>
        </div>

        {/* Шкала */}
        <div className="space-y-2">
          <div className="relative h-10">
            {/* Полоса со зонами */}
            <div className="absolute top-3 left-0 right-0 h-4 rounded-full overflow-hidden bg-destructive/30">
              <div
                className="absolute top-0 bottom-0 bg-yellow-400/40"
                style={{ left: `${minPct}%`, width: `${maxPct - minPct}%` }}
              />
              <div
                className="absolute top-0 bottom-0 bg-green-500/50"
                style={{
                  left: `${minPct + (maxPct - minPct) * 0.3}%`,
                  width: `${(maxPct - minPct) * 0.4}%`,
                }}
              />
            </div>

            {/* Целевая отметка */}
            <div
              className="absolute top-1 bottom-1 w-px bg-foreground/40"
              style={{ left: `${targetPct}%` }}
            />

            {/* Указатель */}
            {spacing > 0 && (
              <div
                className="absolute top-0 -translate-x-1/2 flex flex-col items-center"
                style={{ left: `${pointerPct}%` }}
              >
                <div
                  className="w-0.5 h-10 rounded"
                  style={{ backgroundColor: statusMeta.color }}
                />
                <div
                  className="absolute -top-1 w-3 h-3 rounded-full border-2 border-background"
                  style={{ backgroundColor: statusMeta.color }}
                />
              </div>
            )}
          </div>

          {/* Метки шкалы */}
          <div className="flex justify-between text-[11px] text-muted-foreground px-0.5">
            <span>{SCALE_MIN} см</span>
            <span style={{ marginLeft: `${minPct - 10}%` }}>{MIN_SPACING}</span>
            <span>{TARGET_SPACING} см ← цель</span>
            <span>{MAX_SPACING}</span>
            <span>{SCALE_MAX} см</span>
          </div>
        </div>

        {/* Подсказка-вердикт */}
        <div
          className="text-sm p-3 rounded-md border"
          style={{
            backgroundColor: `${statusMeta.color}10`,
            borderColor: `${statusMeta.color}40`,
          }}
        >
          {statusMeta.hint}
        </div>

        {/* Контекст расчёта */}
        <div className="grid grid-cols-3 gap-3 text-center text-xs">
          <div className="p-2 rounded-md bg-muted/40">
            <div className="text-muted-foreground">Площадка</div>
            <div className="font-semibold mt-0.5">
              {platformLength} × {platformWidth} м
            </div>
            <div className="text-muted-foreground mt-0.5">{area.toFixed(2)} м²</div>
          </div>
          <div className="p-2 rounded-md bg-muted/40">
            <div className="text-muted-foreground">Секция кабеля</div>
            <div className="font-semibold mt-0.5">
              {selectedSection > 0 ? `${selectedSection} м` : "—"}
            </div>
            <div className="text-muted-foreground mt-0.5">на площадку</div>
          </div>
          <div className="p-2 rounded-md bg-muted/40">
            <div className="text-muted-foreground">Целевой шаг</div>
            <div className="font-semibold mt-0.5">{TARGET_SPACING} см</div>
            <div className="text-muted-foreground mt-0.5">оптимум</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SpacingOptimizationChart;

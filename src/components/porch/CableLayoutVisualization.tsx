import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface CableLayoutVisualizationProps {
  stepLength: number;
  stepWidth: number;
  stepCount: number;
  platformLength: number;
  platformWidth: number;
  cableStep: number;
  threadsPerStep: number;
}

const CableLayoutVisualization = ({
  stepLength,
  stepWidth,
  stepCount,
  platformLength,
  platformWidth,
  cableStep,
  threadsPerStep,
}: CableLayoutVisualizationProps) => {
  // Используем реальные размеры площадки
  const platformDepth = platformLength;

  // Масштабирование для отображения (макс размер 400px)
  const totalDepth = platformDepth + (stepWidth * stepCount);
  const maxDimension = Math.max(platformWidth * 100, stepLength * 100, totalDepth * 100);
  const scale = Math.min(400 / maxDimension, 4);
  
  const scaledPlatformWidth = platformWidth * 100 * scale; // см в пиксели
  const scaledStepLength = stepLength * 100 * scale;
  const scaledStepWidth = stepWidth * 100 * scale;
  const scaledPlatformDepth = platformDepth * 100 * scale;
  
  const viewWidth = Math.max(scaledPlatformWidth, scaledStepLength) + 40;
  const viewHeight = scaledPlatformDepth + (scaledStepWidth * stepCount) + 40;

  // Генерация линий кабеля (змейкой)
  const generateCableLines = () => {
    const lines = [];
    // Защита от зависания: минимальный шаг 1см и лимит итераций
    const safeCableStep = Number.isFinite(cableStep) && cableStep > 1 ? cableStep : 10;
    const platformStep = safeCableStep * scale; // Реальный шаг площадки в пикселях
    
    // Кабель на площадке (змейкой с реальным шагом)
    let y = 20 + 5;
    let direction = 1;
    let passCount = 0;
    const MAX_PASSES = 500;
    while (y < 20 + scaledPlatformDepth - 5 && passCount < MAX_PASSES) {
      const startX = direction === 1 ? 20 + 5 : 20 + scaledPlatformWidth - 5;
      const endX = direction === 1 ? 20 + scaledPlatformWidth - 5 : 20 + 5;
      
      lines.push({
        x1: startX,
        y1: y,
        x2: endX,
        y2: y,
        type: 'platform'
      });
      
      if (y + platformStep < 20 + scaledPlatformDepth - 5) {
        lines.push({
          x1: endX,
          y1: y,
          x2: endX,
          y2: y + platformStep,
          type: 'platform'
        });
      }
      
      y += platformStep;
      direction *= -1;
      passCount++;
    }

    // Кабель на ступенях (змейкой - горизонтальные линии с вертикальными переходами)
    for (let i = 0; i < stepCount; i++) {
      const stepYStart = 20 + scaledPlatformDepth + (i * scaledStepWidth);
      const threadSpacing = scaledStepWidth / (threadsPerStep + 1); // Равномерное распределение
      
      let direction = 1; // 1 = слева направо, -1 = справа налево
      
      for (let thread = 1; thread <= threadsPerStep; thread++) {
        const y = stepYStart + (thread * threadSpacing);
        
        // Горизонтальная линия
        const startX = direction === 1 ? 20 + 5 : 20 + scaledStepLength - 5;
        const endX = direction === 1 ? 20 + scaledStepLength - 5 : 20 + 5;
        
        lines.push({
          x1: startX,
          y1: y,
          x2: endX,
          y2: y,
          type: 'step'
        });
        
        // Вертикальный переход к следующей нитке (если не последняя)
        if (thread < threadsPerStep) {
          const nextY = stepYStart + ((thread + 1) * threadSpacing);
          lines.push({
            x1: endX,
            y1: y,
            x2: endX,
            y2: nextY,
            type: 'step'
          });
        }
        
        direction *= -1; // Меняем направление для следующей нитки
      }
    }

    return lines;
  };

  const cableLines = generateCableLines();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Визуализация раскладки</CardTitle>
        <CardDescription>Схема укладки нагревательного кабеля</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <svg
            width={viewWidth}
            height={viewHeight}
            className="border border-border rounded-lg bg-muted/20"
          >
            {/* Площадка */}
            <rect
              x={20}
              y={20}
              width={scaledPlatformWidth}
              height={scaledPlatformDepth}
              fill="var(--card)"
              stroke="var(--border)"
              strokeWidth="2"
              className="transition-all"
            />
            <text
              x={20 + scaledPlatformWidth / 2}
              y={20 + scaledPlatformDepth / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-xs fill-muted-foreground font-medium"
            >
              Площадка
            </text>

            {/* Ступени */}
            {Array.from({ length: stepCount }).map((_, i) => (
              <g key={i}>
                <rect
                  x={20}
                  y={20 + scaledPlatformDepth + i * scaledStepWidth}
                  width={scaledStepLength}
                  height={scaledStepWidth}
                  fill="var(--card)"
                  stroke="var(--border)"
                  strokeWidth="2"
                  className="transition-all"
                />
                {/* Передний край ступени (свес) */}
                <line
                  x1={20}
                  y1={20 + scaledPlatformDepth + (i + 1) * scaledStepWidth}
                  x2={20 + scaledStepLength}
                  y2={20 + scaledPlatformDepth + (i + 1) * scaledStepWidth}
                  stroke="var(--foreground)"
                  strokeWidth="3"
                  className="transition-all"
                  opacity="0.6"
                />
                <text
                  x={20 + scaledStepLength / 2}
                  y={20 + scaledPlatformDepth + i * scaledStepWidth + scaledStepWidth / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="text-xs fill-muted-foreground font-medium"
                >
                  Ступень {i + 1}
                </text>
              </g>
            ))}

            {/* Линии кабеля */}
            {cableLines.map((line, i) => (
              <line
                key={i}
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke="var(--primary)"
                strokeWidth="2"
                strokeLinecap="round"
                className="transition-all"
                opacity="0.7"
              />
            ))}

            {/* Размеры */}
            {/* Ширина площадки */}
            <line
              x1={20}
              y1={viewHeight - 15}
              x2={20 + scaledPlatformWidth}
              y2={viewHeight - 15}
              stroke="var(--muted-foreground)"
              strokeWidth="1"
              markerStart="url(#arrowStart)"
              markerEnd="url(#arrowEnd)"
            />
            <text
              x={20 + scaledPlatformWidth / 2}
              y={viewHeight - 5}
              textAnchor="middle"
              className="text-xs fill-muted-foreground"
            >
              {platformWidth} м
            </text>

            {/* Стрелки для размеров */}
            <defs>
              <marker
                id="arrowStart"
                markerWidth="10"
                markerHeight="10"
                refX="5"
                refY="5"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <path d="M 9 1 L 1 5 L 9 9" fill="none" stroke="var(--muted-foreground)" strokeWidth="1" />
              </marker>
              <marker
                id="arrowEnd"
                markerWidth="10"
                markerHeight="10"
                refX="5"
                refY="5"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <path d="M 1 1 L 9 5 L 1 9" fill="none" stroke="var(--muted-foreground)" strokeWidth="1" />
              </marker>
            </defs>
          </svg>
        </div>

        {/* Легенда */}
        <div className="mt-4 flex items-center justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-primary rounded"></div>
            <span className="text-muted-foreground">Кабель (параллельные нитки на ступень, шаг {cableStep}см на площадке)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-4 border-2 border-border rounded bg-card"></div>
            <span className="text-muted-foreground">Поверхность</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CableLayoutVisualization;

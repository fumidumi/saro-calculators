import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceDot, ComposedChart } from "recharts";
import { HEATING_CABLES } from "@/data/products";

interface PricingChartProps {
  platformLength: number;
  platformWidth: number;
  stairsLength: number;
  stepLength: number;
  stepCount: number;
  currentTotalPrice: number;
}

const PricingChart = ({
  platformLength,
  platformWidth,
  stairsLength,
  stepLength,
  stepCount,
  currentTotalPrice,
}: PricingChartProps) => {
  const MARGIN_OFFSET = 0.15;
  const AVAILABLE_SECTIONS = [5, 10, 15, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120];
  const THERMOSTAT_PRICE = 8500;
  const FIXTAPE_PRICE_PER_ROLL = 480;
  const FIXTAPE_ROLL_LENGTH = 10;

  // Генерируем данные для графика
  const generateChartData = () => {
    const data = [];
    const minArea = 0.5;
    const maxArea = 30;
    const step = 0.5;

    for (let area = minArea; area <= maxArea; area += step) {
      // Предполагаем квадратную площадку для упрощения
      const side = Math.sqrt(area);
      const effectiveArea = Math.max(0, (side - MARGIN_OFFSET) * (side - MARGIN_OFFSET));
      
      // Находим подходящую секцию
      const targetLength = effectiveArea / 0.1; // Целевой шаг 10см
      const totalNeeded = stairsLength + targetLength + 2; // +2м запас
      const section = AVAILABLE_SECTIONS.find(s => s >= totalNeeded) || 120;
      
      // Получаем цену кабеля из каталога
      const selectedCable = HEATING_CABLES.find(cable => cable.length === section);
      const cablePrice = selectedCable?.price || 0;
      
      // Расчёт монтажной ленты
      const fixtapePlatformMeters = area * 2.5;
      const effectiveStepWidth = stepLength - MARGIN_OFFSET;
      const stripsPerStep = effectiveStepWidth / 0.4;
      const stripLength = 0.5;
      const fixtapeStepsMeters = stepCount * stripsPerStep * stripLength;
      const fixtapeTotalMeters = fixtapePlatformMeters + fixtapeStepsMeters;
      const fixtapeRollsCount = Math.ceil(fixtapeTotalMeters / FIXTAPE_ROLL_LENGTH);
      const fixtapePrice = fixtapeRollsCount * FIXTAPE_PRICE_PER_ROLL;
      
      // Итоговая стоимость
      const totalPrice = cablePrice + THERMOSTAT_PRICE + fixtapePrice;
      
      data.push({
        area: area,
        price: totalPrice,
        section: section,
        cablePrice: cablePrice,
      });
    }

    return data;
  };

  const chartData = generateChartData();
  const currentArea = platformLength * platformWidth;

  // Кастомный тултип
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium">Площадь: {payload[0].payload.area.toFixed(1)} м²</p>
          <p className="text-sm text-primary font-semibold">Стоимость: {payload[0].value.toLocaleString()} ₽</p>
          <p className="text-xs text-muted-foreground">Секция: {payload[0].payload.section}м</p>
        </div>
      );
    }
    return null;
  };

  // Находим минимальную и максимальную цену для настройки графика
  const prices = chartData.map(d => d.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice;
  const yAxisMin = Math.floor((minPrice - priceRange * 0.1) / 1000) * 1000;
  const yAxisMax = Math.ceil((maxPrice + priceRange * 0.1) / 1000) * 1000;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <CardTitle>График стоимости системы</CardTitle>
            <CardDescription>
              Зависимость стоимости от площади площадки
            </CardDescription>
          </div>
          <TooltipProvider>
            <UITooltip>
              <TooltipTrigger asChild>
                <button className="p-1.5 rounded-full hover:bg-accent transition-colors">
                  <Info className="h-5 w-5 text-muted-foreground" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs p-4 space-y-2">
                <p className="font-semibold text-sm">Как читать график:</p>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-start gap-2">
                    <div className="w-3 h-3 rounded-full bg-primary mt-0.5 shrink-0"></div>
                    <p><strong>Синяя линия</strong> — итоговая стоимость системы (кабель + термостат + монтажная лента)</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-3 h-3 rounded-full bg-accent border-2 border-primary mt-0.5 shrink-0"></div>
                    <p><strong>Жёлтая точка</strong> — стоимость для ваших текущих параметров</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground pt-2 border-t">
                  💡 График помогает оценить бюджет при изменении размеров площадки
                </p>
              </TooltipContent>
            </UITooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
              <defs>
                <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.05}/>
                </linearGradient>
              </defs>
              
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              
              <XAxis 
                dataKey="area" 
                label={{ value: 'Площадь площадки (м²)', position: 'insideBottom', offset: 0 }}
                className="text-xs"
                tick={{ fill: 'var(--muted-foreground)' }}
              />
              
              <YAxis 
                label={{ value: 'Стоимость (₽)', angle: -90, position: 'insideLeft' }}
                className="text-xs"
                tick={{ fill: 'var(--muted-foreground)' }}
                domain={[yAxisMin, yAxisMax]}
                tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
              />
              
              <Tooltip content={<CustomTooltip />} />
              
              {/* Основная линия графика */}
              <Line 
                type="monotone" 
                dataKey="price" 
                stroke="var(--primary)" 
                strokeWidth={2.5}
                dot={{ r: 2, fill: 'var(--primary)' }}
                activeDot={{ r: 6, fill: 'var(--primary)' }}
              />
              
              {/* Текущая точка пользователя */}
              <ReferenceDot
                x={currentArea}
                y={currentTotalPrice}
                r={8}
                fill="var(--accent)"
                stroke="var(--primary)"
                strokeWidth={3}
              />
              
              <ReferenceLine 
                x={currentArea} 
                stroke="var(--accent)" 
                strokeDasharray="5 5"
                strokeWidth={1.5}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        
        {/* Легенда */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-accent border-2 border-primary"></div>
              <span className="text-muted-foreground">Ваши параметры: {currentArea.toFixed(1)} м² → {currentTotalPrice.toLocaleString()} ₽</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            * График показывает примерную стоимость оборудования без учёта монтажных работ
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default PricingChart;

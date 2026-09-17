import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import CableLayoutVisualization from "@/components/porch/CableLayoutVisualization";
import CableLayout3D from "@/components/porch/CableLayout3DLazy";
import SpacingOptimizationChart from "@/components/porch/SpacingOptimizationChart";
import { HEATING_CABLES, THERMOSTATS as CATALOG_THERMOSTATS, CONTROL_CABINETS, MOUNTING_TAPES } from "@/data/products";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, AlertTriangle, ShieldCheck, Send, FileText, Printer } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { type QuoteVariant, type QuoteData } from "@/lib/porch/generateQuote";
import QuotePreviewDialog from "@/components/porch/QuotePreviewDialog";

const fmtNum = (n: number) => Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");


// Границы валидных значений параметров
const PARAM_LIMITS: Record<string, { min: number; max: number }> = {
  stepLength: { min: 0.5, max: 5 },
  stepCount: { min: 1, max: 20 },
  platformLength: { min: 0, max: 10 },
  platformWidth: { min: 0, max: 10 },
};

// Универсальный хук debounce значения
function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}


// Константы для расчётов
const CABLE_POWER_PER_METER = 30; // Вт/м для резистивного кабеля
const MARGIN_OFFSET = 0.15; // м - технический отступ от края (по 7.5 см с каждой стороны)
const THREADS_PER_STEP_BASE = 4; // Количество ниток кабеля на ступень
const RISER_THREAD = 1; // Дополнительная нитка на подступенок
const STEP_TECHNICAL_RESERVE = 0.45; // м - запас на петли и подступенок для каждой ступени
const PLATFORM_SPACING = 0.1; // м - шаг укладки на площадке (10 см)
const PLATFORM_SLACK = 2; // м - запас на сложные повороты площадки

// Доступные стандартные секции кабеля (метры)
const AVAILABLE_SECTIONS = [5, 10, 15, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120];
const COLD_END_LENGTH = 4; // м - длина холодного конца (уже в комплекте)

// Ценовые константы (примерные)
const CABLE_PRICE_PER_METER = 450; // руб/м
const FIXTAPE_PRICE_PER_ROLL = 480; // руб за рулон 10м
const FIXTAPE_ROLL_LENGTH = 10; // м - длина одного рулона
const FIXTAPE_STEP = 0.4; // м - шаг крепления ленты (40 см)

// Коэффициент 1.25 учитывает:
// - Пусковой ток холодного кабеля (+20%)
// - Скачки напряжения (до 250В)
// - Запас прочности автомата (не должен работать на пределе)
const SAFETY_FACTOR = 1.25;
const VOLTAGE = 220;

// Преобразуем терморегуляторы из каталога для использования в калькуляторе
const THERMOSTATS = CATALOG_THERMOSTATS.map(t => ({
  id: t.id,
  name: t.name,
  description: t.type === 'wall' ? 'DIN-рейка с датчиком воды. Макс. нагрузка 25 А.' :
               t.type === 'din' ? 'Датчик воздуха + датчик пола. Макс. нагрузка 16А.' :
               'Влагозащищенный корпус. Макс. нагрузка 32А.',
  max_amps: t.maxAmperage,
  price: t.price
}));

// Преобразуем шкафы управления из каталога
const CABINETS = CONTROL_CABINETS.map(c => ({
  amp: c.maxAmperage,
  name: c.name,
  price: c.price
}));

interface CalculatorState {
  stepLength: number;
  stepCount: number;
  platformLength: number;
  platformWidth: number;
}

const Calculator = () => {
  const [params, setParams] = useState<CalculatorState>({
    stepLength: 1.2,
    stepCount: 5,
    platformLength: 2,
    platformWidth: 1.5,
  });

  // Опция: греть подступенок (добавляет 5-ю нитку на каждую ступень)
  const [heatRiser, setHeatRiser] = useState(false);
  const threadsPerStep = THREADS_PER_STEP_BASE + (heatRiser ? RISER_THREAD : 0);

  // Опции отсутствия зон обогрева
  const [noStairs, setNoStairs] = useState(false);
  const [noPlatform, setNoPlatform] = useState(false);

  // Перила по периметру площадки — добавляют 25 см отступа от края
  const [hasRailings, setHasRailings] = useState(false);
  const RAILING_MARGIN = 0.25; // м с каждой стороны

  // Эффективные параметры (с учётом отключённых зон)
  const effStepCount = noStairs ? 0 : params.stepCount;
  const effPlatformLength = noPlatform ? 0 : params.platformLength;
  const effPlatformWidth = noPlatform ? 0 : params.platformWidth;

  // Состояние для выбора системы управления
  const [controlSystemMode, setControlSystemMode] = useState<'cabinet' | 'thermostat'>('cabinet');
  const [selectedThermostatId, setSelectedThermostatId] = useState<string>(CATALOG_THERMOSTATS[0]?.id || '');

  // Состояние видимости кнопки заказа при скролле
  const [showOrderButton, setShowOrderButton] = useState(false);

  // Состояние диалога выбора формата КП
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);

  // Состояние превью КП
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<QuoteData | null>(null);

  // Отслеживание скролла для анимации кнопки
  useEffect(() => {
    const handleScroll = () => {
      // Показываем кнопку после скролла на 300px
      setShowOrderButton(window.scrollY > 300);
    };
    
    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Проверяем начальную позицию
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // =============== ЛОГИКА ПОДБОРА СЕКЦИЙ ===============
  
  // Функция подбора оптимальных секций для заданной требуемой длины.
  // Стратегия: при длине > 120м делим на N равных секций так, чтобы
  // каждая была ≤ 90м (это позволяет распределить нагрузку и не уходить
  // в 3-фазный шкаф там, где можно обойтись несколькими 1-фазными цепями).
  const selectSections = (requiredLength: number): number[] => {
    if (requiredLength <= 0) return [];

    // Если умещается в одну секцию — берём её
    const single = AVAILABLE_SECTIONS.find(s => s >= requiredLength);
    if (single) return [single];

    // Иначе — равное разбиение
    const TARGET_MAX_PER_SECTION = 90;
    const numSections = Math.ceil(requiredLength / TARGET_MAX_PER_SECTION);
    const targetPerSection = requiredLength / numSections;
    const chosen = AVAILABLE_SECTIONS.find(s => s >= targetPerSection)
      || AVAILABLE_SECTIONS[AVAILABLE_SECTIONS.length - 1];
    return Array(numSections).fill(chosen);
  };
  
  // 1. Расчёт ступеней
  const effectiveStepWidth = params.stepLength - MARGIN_OFFSET;
  // При включённой опции добавляется доп. нить на подступенок площадки (1 шт, длиной effectiveStepWidth)
  const platformRiserLength = heatRiser && !noStairs ? effectiveStepWidth : 0;
  const stairsRequiredLength = noStairs ? 0 : (
    (effectiveStepWidth * threadsPerStep * effStepCount) +
    (effStepCount * STEP_TECHNICAL_RESERVE) +
    platformRiserLength
  );
  
  // 2. Площадь и эффективная площадь площадки (с учётом перил)
  const platformArea = effPlatformLength * effPlatformWidth;
  const railingOffset = hasRailings ? RAILING_MARGIN * 2 : 0; // по 25 см с каждой стороны
  const effectivePlatformArea = Math.max(0,
    (effPlatformLength - MARGIN_OFFSET - railingOffset) * (effPlatformWidth - MARGIN_OFFSET - railingOffset)
  );

  // 3. Расчёт площадки (целевая длина по стандарту 10см)
  const platformRequiredLength = noPlatform || effectivePlatformArea <= 0 ? 0 : (effectivePlatformArea / PLATFORM_SPACING + PLATFORM_SLACK);
  
  // 4. ГЛАВНАЯ ЛОГИКА: Если одной секции хватает на обе зоны — выбираем одну секцию
  const totalRequiredLength = stairsRequiredLength + platformRequiredLength;
  const MAX_SECTION_LENGTH = 120; // максимальная длина одной секции
  const MIN_PLATFORM_SPACING_CM = 7.5;
  const MAX_PLATFORM_SPACING_CM = 12.5;
  
  // Массив для отслеживания попыток подбора (для DEBUG)
  type SectionAttempt = {
    section: number;
    platformCable: number;
    spacingCm: number;
    status: 'too_dense' | 'too_sparse' | 'optimal' | 'selected';
    reason: string;
  };
  const sectionAttempts: SectionAttempt[] = [];
  
  // Функция расчёта шага площадки для заданной длины кабеля
  const calculatePlatformSpacing = (platformCableLength: number): number => {
    const realLength = platformCableLength - PLATFORM_SLACK;
    if (realLength <= 0 || effectivePlatformArea <= 0) return PLATFORM_SPACING * 100;
    return (effectivePlatformArea / realLength) * 100; // в см
  };
  
  // Функция подбора оптимальной секции с учётом ограничений по шагу
  const selectOptimalSection = (requiredLength: number, forPlatform: boolean = false): number => {
    // Находим секцию >= требуемой
    let selectedSection = AVAILABLE_SECTIONS.find(s => s >= requiredLength) 
      || AVAILABLE_SECTIONS[AVAILABLE_SECTIONS.length - 1];
    
    // Если это для площадки - проверяем плотность укладки
    if (forPlatform && effectivePlatformArea > 0) {
      let spacingCm = calculatePlatformSpacing(selectedSection);
      
      // Если шаг слишком плотный - пробуем меньшие секции
      if (spacingCm < MIN_PLATFORM_SPACING_CM) {
        // Ищем секцию, при которой шаг будет в допустимом диапазоне
        for (let i = AVAILABLE_SECTIONS.indexOf(selectedSection) - 1; i >= 0; i--) {
          const smallerSection = AVAILABLE_SECTIONS[i];
          const newSpacing = calculatePlatformSpacing(smallerSection);
          
          // Секция должна давать шаг >= 7.5 см, но не более 12.5 см
          if (newSpacing >= MIN_PLATFORM_SPACING_CM && newSpacing <= MAX_PLATFORM_SPACING_CM) {
            selectedSection = smallerSection;
            spacingCm = newSpacing;
            break;
          }
          // Если шаг стал слишком большим - берём предыдущую (более плотную)
          if (newSpacing > MAX_PLATFORM_SPACING_CM) {
            // Возвращаем секцию на одну больше, даже если она плотнее 7.5
            selectedSection = AVAILABLE_SECTIONS[i + 1] || smallerSection;
            break;
          }
        }
      }
    }
    
    return selectedSection;
  };
  
  let stairsSections: number[] = [];
  let platformSections: number[] = [];
  let stairsTotalLength: number = 0;
  let platformTotalLength: number = 0;
  
  if (totalRequiredLength <= MAX_SECTION_LENGTH) {
    // Одной секции достаточно на обе зоны
    // Сначала подбираем базовую секцию
    let baseSection = AVAILABLE_SECTIONS.find(s => s >= totalRequiredLength) 
      || AVAILABLE_SECTIONS[AVAILABLE_SECTIONS.length - 1];
    
    // Вычисляем сколько кабеля пойдёт на площадку
    let platformCable = Math.max(0, baseSection - stairsRequiredLength);
    let platformSpacingCm = calculatePlatformSpacing(platformCable);
    
    // Записываем первую попытку
    const initialStatus = platformSpacingCm < MIN_PLATFORM_SPACING_CM ? 'too_dense' : 
                         platformSpacingCm > MAX_PLATFORM_SPACING_CM ? 'too_sparse' : 'optimal';
    sectionAttempts.push({
      section: baseSection,
      platformCable: platformCable,
      spacingCm: Math.round(platformSpacingCm * 10) / 10,
      status: initialStatus,
      reason: `Первичный подбор: секция ${baseSection}м >= ${totalRequiredLength.toFixed(1)}м (требуется)`
    });
    
    // Если шаг слишком плотный - пробуем меньшую секцию
    if (platformSpacingCm < MIN_PLATFORM_SPACING_CM && effectivePlatformArea > 0) {
      const currentIndex = AVAILABLE_SECTIONS.indexOf(baseSection);
      
      for (let i = currentIndex - 1; i >= 0; i--) {
        const smallerSection = AVAILABLE_SECTIONS[i];
        // Секция должна покрывать хотя бы ступени
        if (smallerSection < stairsRequiredLength) {
          sectionAttempts.push({
            section: smallerSection,
            platformCable: 0,
            spacingCm: 0,
            status: 'too_sparse',
            reason: `❌ Секция ${smallerSection}м < ${stairsRequiredLength.toFixed(1)}м (нужно на ступени) - СТОП`
          });
          break;
        }
        
        const newPlatformCable = smallerSection - stairsRequiredLength;
        const newSpacing = calculatePlatformSpacing(newPlatformCable);
        
        if (newSpacing >= MIN_PLATFORM_SPACING_CM && newSpacing <= MAX_PLATFORM_SPACING_CM) {
          sectionAttempts.push({
            section: smallerSection,
            platformCable: newPlatformCable,
            spacingCm: Math.round(newSpacing * 10) / 10,
            status: 'selected',
            reason: `✅ Шаг ${newSpacing.toFixed(1)}см в норме (7.5-12.5) - ВЫБРАНА`
          });
          baseSection = smallerSection;
          platformCable = newPlatformCable;
          break;
        }
        if (newSpacing > MAX_PLATFORM_SPACING_CM) {
          sectionAttempts.push({
            section: smallerSection,
            platformCable: newPlatformCable,
            spacingCm: Math.round(newSpacing * 10) / 10,
            status: 'too_sparse',
            reason: `⚠️ Шаг ${newSpacing.toFixed(1)}см > 12.5см - слишком редко, возврат к предыдущей`
          });
          // Слишком редко - берём предыдущую секцию
          baseSection = AVAILABLE_SECTIONS[i + 1] || smallerSection;
          platformCable = baseSection - stairsRequiredLength;
          break;
        }
        // Ещё плотно - продолжаем искать
        sectionAttempts.push({
          section: smallerSection,
          platformCable: newPlatformCable,
          spacingCm: Math.round(newSpacing * 10) / 10,
          status: 'too_dense',
          reason: `↓ Шаг ${newSpacing.toFixed(1)}см < 7.5см - ещё плотно, пробуем меньше`
        });
      }
    } else if (initialStatus === 'optimal') {
      // Пометим первую попытку как выбранную
      sectionAttempts[0].status = 'selected';
      sectionAttempts[0].reason += ' - ВЫБРАНА';
    }
    
    stairsTotalLength = Math.min(stairsRequiredLength, baseSection);
    platformTotalLength = Math.max(0, baseSection - stairsTotalLength);
    stairsSections = [baseSection];
    platformSections = [];
  } else {
    // Требуется больше 120м — выбираем секции раздельно для каждой зоны
    stairsSections = selectSections(stairsRequiredLength);
    const platformSection = selectOptimalSection(platformRequiredLength, true);
    platformSections = [platformSection];
    stairsTotalLength = stairsSections.reduce((sum, s) => sum + s, 0);
    platformTotalLength = platformSection;
  }
  
  // 5. Пересчёт реального шага на площадке (с учётом выделенных секций)
  const platformRealLength = platformTotalLength - PLATFORM_SLACK;
  const realPlatformSpacing = effectivePlatformArea > 0 
    ? effectivePlatformArea / platformRealLength 
    : PLATFORM_SPACING;
  let realPlatformSpacingCm = Math.round(realPlatformSpacing * 100 * 10) / 10;
  
  // 6. Проверка допустимости шага (7.5-12.5 см)
  const isDensePacking = realPlatformSpacingCm < MIN_PLATFORM_SPACING_CM;
  const isSparsePacking = realPlatformSpacingCm > MAX_PLATFORM_SPACING_CM;
  
  // 7. Все секции и итоговая мощность
  const allSections = [...stairsSections, ...platformSections];
  const totalCableLength = stairsTotalLength + platformTotalLength;
  const totalPower = totalCableLength * CABLE_POWER_PER_METER;
  
  // 8. Расчёт нагрузки с учётом пусковых токов
  const nominalAmps = totalPower / VOLTAGE;
  const maxCalculatedAmps = nominalAmps * SAFETY_FACTOR;
  
  // 9. Автоматический подбор шкафа управления
  const selectedCabinet = CABINETS.find(c => c.amp >= maxCalculatedAmps);
  const needsThreePhase = !selectedCabinet;

  // 9b. Рекомендация: разбить нагрузку на несколько независимых 1-фазных
  // цепей/шкафов, если ток превышает предел 1-фазного шкафа (25 А).
  // Это часто дешевле и проще в монтаже, чем индивидуальный 3-фазный шкаф.
  const SINGLE_PHASE_MAX_AMPS = 25;
  const shouldRecommendMultiCircuit = maxCalculatedAmps > SINGLE_PHASE_MAX_AMPS;
  const recommendedNumCircuits = shouldRecommendMultiCircuit
    ? Math.ceil(maxCalculatedAmps / SINGLE_PHASE_MAX_AMPS)
    : 1;
  const recommendedAmpsPerCircuit = shouldRecommendMultiCircuit
    ? maxCalculatedAmps / recommendedNumCircuits
    : maxCalculatedAmps;
  const recommendedCabinet = shouldRecommendMultiCircuit
    ? CABINETS.find(c => c.amp >= recommendedAmpsPerCircuit)
    : null;
  const recommendedCabinetsTotalPrice = recommendedCabinet
    ? recommendedCabinet.price * recommendedNumCircuits
    : 0;
  
  // 10. Проверка выбранного терморегулятора
  const selectedThermostat = THERMOSTATS.find(t => t.id === selectedThermostatId) || THERMOSTATS[0];
  const isThermostatOverloaded = maxCalculatedAmps > selectedThermostat.max_amps;
  
  // 11. Для визуализации
  const cableStep = realPlatformSpacingCm;
  const stairsLength = stairsRequiredLength;

  // Расчёт монтажной ленты Fixtape
  // 1. Расход на площадку: 2.5 м ленты на 1 м² площади (шаг крепления 40 см)
  const fixtapePlatformMeters = platformArea * 2.5;
  
  // 2. Расход на ступени: лента крепится поперёк длины ступени
  const stripsPerStep = effectiveStepWidth / FIXTAPE_STEP; // количество полос на ступень
  const stripLength = 0.5; // м - длина одной полосы с загибом на край
  const fixtapeStepsMeters = effStepCount * stripsPerStep * stripLength;
  
  // 3. Итого рулонов (округляем вверх до целого рулона 10м)
  const fixtapeTotalMeters = fixtapePlatformMeters + fixtapeStepsMeters;
  const fixtapeRollsCount = Math.ceil(fixtapeTotalMeters / FIXTAPE_ROLL_LENGTH);
  const fixtapePrice = fixtapeRollsCount * FIXTAPE_PRICE_PER_ROLL;

  // 4. Крепёж ленты (дюбель-гвозди): 5 шт на 1 метр ленты
  const fastenersCount = Math.ceil(fixtapeTotalMeters * 5);
  
  // Смета - суммируем цены всех секций из каталога
  const cablePrice = allSections.reduce((sum, sectionLength) => {
    const cable = HEATING_CABLES.find(c => c.length === sectionLength);
    return sum + (cable?.price || (sectionLength * CABLE_POWER_PER_METER));
  }, 0);
  
  // Цена системы управления в зависимости от выбранного режима
  const controlSystemPrice = controlSystemMode === 'cabinet' 
    ? (selectedCabinet?.price || 0)
    : (selectedThermostat?.price || 0);
  
  const totalPrice = cablePrice + controlSystemPrice + fixtapePrice;

  // Валидация и кламп входных значений (защита от NaN/Infinity/отрицательных)
  const updateParam = (key: keyof CalculatorState, value: any) => {
    const limits = PARAM_LIMITS[key];
    let num = typeof value === "number" ? value : Number(value);

    if (!Number.isFinite(num)) {
      console.error("[Calculator] Некорректное значение параметра", { key, value, params });
      num = limits ? limits.min : 0;
    }

    if (limits) {
      if (num < limits.min) num = limits.min;
      if (num > limits.max) num = limits.max;
    }

    if (key === "stepCount") num = Math.max(1, Math.round(num));

    setParams((prev) => ({ ...prev, [key]: num }));
  };

  // Debounce параметров для тяжёлых компонентов (3D/2D/график),
  // чтобы при перетаскивании ползунка не пересоздавать сцену на каждый кадр.
  const debouncedParams = useDebouncedValue(params, 180);
  const debouncedCableStep = useDebouncedValue(cableStep, 180);
  const debouncedNoStairs = useDebouncedValue(noStairs, 180);
  const debouncedNoPlatform = useDebouncedValue(noPlatform, 180);
  const vizStepCount = debouncedNoStairs ? 0 : debouncedParams.stepCount;
  const vizPlatformLength = debouncedNoPlatform ? 0 : debouncedParams.platformLength;
  const vizPlatformWidth = debouncedNoPlatform ? 0 : debouncedParams.platformWidth;

  // Проверка корректности параметров для 3D-предпросмотра
  const params3DError = (() => {
    const stepLength = debouncedParams.stepLength;
    const stepCount = vizStepCount;
    const platformLength = vizPlatformLength;
    const platformWidth = vizPlatformWidth;
    const values = { stepLength, stepCount, platformLength, platformWidth, cableStep: debouncedCableStep };
    const allFinite = Object.values(values).every((v) => Number.isFinite(v));
    if (!allFinite) return { reason: "Параметры содержат NaN или Infinity", values };
    if (stepLength <= 0) return { reason: "Ширина пролёта должна быть > 0", values };
    if (stepCount < 0) return { reason: "Количество ступеней не может быть отрицательным", values };
    if (platformLength < 0 || platformWidth < 0) return { reason: "Размеры площадки не могут быть отрицательными", values };
    if (debouncedCableStep <= 0 && platformLength > 0 && platformWidth > 0) return { reason: "Шаг укладки кабеля должен быть > 0", values };
    if (stepCount === 0 && (platformLength === 0 || platformWidth === 0)) return { reason: "Нужно включить хотя бы одну зону обогрева", values };
    return null;
  })();

  useEffect(() => {
    if (params3DError) {
      console.error("[Calculator/3D] Некорректные параметры — 3D-предпросмотр отключён", params3DError);
    }
  }, [params3DError?.reason]);

  // Открытие диалога выбора формата КП
  const handleOrderClick = () => {
    if (navigator.vibrate) navigator.vibrate(50);
    setOrderDialogOpen(true);
  };

  // Сборка данных и открытие превью КП в выбранном варианте
  const generateAndPreviewQuote = (variant: QuoteVariant) => {
    const sections = allSections.map((sectionLength) => {
      const cable = HEATING_CABLES.find((c) => c.length === sectionLength);
      return {
        name: cable?.name || `Секция ${sectionLength}м`,
        article: cable?.article || '—',
        qty: '1 шт',
        price: cable?.price || sectionLength * CABLE_POWER_PER_METER,
      };
    });

    const controlSystemName =
      controlSystemMode === 'cabinet'
        ? selectedCabinet?.name || 'Индивидуальный расчёт (3-фазный)'
        : selectedThermostat.name;

    setPreviewData({
      variant,
      stepLength: noStairs ? 0 : params.stepLength,
      stepCount: effStepCount,
      platformLength: effPlatformLength,
      platformWidth: effPlatformWidth,
      heatRiser,
      totalCableLength,
      totalPower,
      maxAmps: maxCalculatedAmps,
      platformSpacingCm: realPlatformSpacingCm,
      threadsPerStep,
      sections,
      controlSystem: { name: controlSystemName, price: controlSystemPrice },
      fixtape: { rolls: fixtapeRollsCount, price: fixtapePrice },
      cablePrice,
      totalPrice,
    });
    setPreviewOpen(true);
  };

  // Финальное действие: открываем превью КП для печати/скачивания PDF.
  const handleQuoteVariantSelect = (variant: QuoteVariant) => {
    setOrderDialogOpen(false);
    generateAndPreviewQuote(variant);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">Калькулятор системы обогрева</h1>
          <p className="text-muted-foreground">Введите параметры для расчёта</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 items-start">
          {/* Левая колонка - форма ввода */}
          <div className="lg:col-span-2 space-y-6">
            {/* Размеры */}
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Параметры объекта</CardTitle>
                <CardDescription>Укажите размеры для расчёта</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* Площадка */}
                <div className={`space-y-4 ${noPlatform ? 'opacity-50' : ''}`}>
                  <div className="flex items-center justify-between border-b pb-2">
                    <h3 className="font-semibold text-lg">Площадка</h3>
                    <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={noPlatform}
                        onChange={(e) => setNoPlatform(e.target.checked)}
                        className="h-4 w-4 accent-primary"
                      />
                      Площадки нет
                    </label>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <Label className="text-base">Длина (м)</Label>
                      <span className="text-lg font-semibold text-primary">{params.platformLength.toFixed(2)} м</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Slider
                        value={[params.platformLength]}
                        onValueChange={([val]) => updateParam("platformLength", val)}
                        min={0}
                        max={10}
                        step={0.05}
                        className="py-2 flex-1"
                        disabled={noPlatform}
                      />
                      <Input
                        type="number"
                        min={0}
                        max={10}
                        step={0.05}
                        value={params.platformLength}
                        onChange={(e) => updateParam("platformLength", parseFloat(e.target.value) || 0)}
                        className="w-24 h-10 text-base"
                        disabled={noPlatform}
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <Label className="text-base">Ширина (м)</Label>
                      <span className="text-lg font-semibold text-primary">{params.platformWidth.toFixed(2)} м</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Slider
                        value={[params.platformWidth]}
                        onValueChange={([val]) => updateParam("platformWidth", val)}
                        min={0}
                        max={10}
                        step={0.05}
                        className="py-2 flex-1"
                        disabled={noPlatform}
                      />
                      <Input
                        type="number"
                        min={0}
                        max={10}
                        step={0.05}
                        value={params.platformWidth}
                        onChange={(e) => updateParam("platformWidth", parseFloat(e.target.value) || 0)}
                        className="w-24 h-10 text-base"
                        disabled={noPlatform}
                      />
                    </div>
                  </div>

                  {/* Перила */}
                  <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3 bg-muted/30">
                    <div className="space-y-0.5 flex-1">
                      <Label htmlFor="hasRailings" className="text-sm font-semibold cursor-pointer">
                        Перила по краю площадки
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Добавит отступ 25 см от края для безопасной укладки кабеля
                      </p>
                    </div>
                    <Switch
                      id="hasRailings"
                      checked={hasRailings}
                      onCheckedChange={setHasRailings}
                      disabled={noPlatform}
                    />
                  </div>

                  <div className="flex justify-between bg-accent/50 p-4 rounded-lg mt-2">
                    <span className="text-base text-muted-foreground">Площадь площадки:</span>
                    <span className="text-lg font-bold">{platformArea.toFixed(2)} м²</span>
                  </div>
                </div>

                <Separator />

                {/* Ступени */}
                <div className={`space-y-4 ${noStairs ? 'opacity-50' : ''}`}>
                  <div className="flex items-center justify-between border-b pb-2">
                    <h3 className="font-semibold text-lg">Ступени</h3>
                    <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={noStairs}
                        onChange={(e) => setNoStairs(e.target.checked)}
                        className="h-4 w-4 accent-primary"
                      />
                      Ступеней нет
                    </label>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <Label className="text-base">Ширина пролёта (м)</Label>
                      <span className="text-lg font-semibold text-primary">{params.stepLength} м</span>
                    </div>
                    <Slider
                      value={[params.stepLength]}
                      onValueChange={([val]) => updateParam("stepLength", val)}
                      min={0.5}
                      max={5}
                      step={0.1}
                      className="py-2"
                      disabled={noStairs}
                    />
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="stepCount" className="text-base">Количество ступеней (шт)</Label>
                    <Input
                      id="stepCount"
                      type="number"
                      min={1}
                      max={20}
                      value={params.stepCount}
                      onChange={(e) => updateParam("stepCount", parseInt(e.target.value) || 1)}
                      className="text-lg h-12"
                      disabled={noStairs}
                    />
                  </div>
                </div>

                <Separator />

                {/* Опция: греть подступенок */}
                <div className={`flex items-start justify-between gap-4 rounded-lg border border-border p-4 bg-muted/30 ${noStairs ? 'opacity-50' : ''}`}>
                  <div className="space-y-1 flex-1">
                    <Label htmlFor="heatRiser" className="text-base font-semibold cursor-pointer">
                      Греть подступенок
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Добавит дополнительную нитку на каждый подступенок ступеней и на подступенок площадки сверху
                    </p>
                  </div>
                  <Switch
                    id="heatRiser"
                    checked={heatRiser}
                    onCheckedChange={setHeatRiser}
                    disabled={noStairs}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Визуализация раскладки */}
            <Tabs defaultValue="2d" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="2d">2D Схема</TabsTrigger>
                <TabsTrigger value="3d">3D Модель</TabsTrigger>
              </TabsList>
              <TabsContent value="2d">
                <CableLayoutVisualization
                  stepLength={debouncedParams.stepLength}
                  stepWidth={0.3}
                  stepCount={vizStepCount}
                  platformLength={vizPlatformLength}
                  platformWidth={vizPlatformWidth}
                  cableStep={debouncedCableStep}
                  threadsPerStep={threadsPerStep}
                />
              </TabsContent>
              <TabsContent value="3d">
                {params3DError ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-destructive">
                        <AlertTriangle className="h-5 w-5" />
                        3D-предпросмотр недоступен
                      </CardTitle>
                      <CardDescription>{params3DError.reason}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <pre className="text-xs bg-muted p-3 rounded-md overflow-auto">
{JSON.stringify(params3DError.values, null, 2)}
                      </pre>
                      <p className="text-sm text-muted-foreground mt-3">
                        Скорректируйте параметры — 3D появится автоматически.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <CableLayout3D
                    stepLength={debouncedParams.stepLength}
                    stepWidth={0.3}
                    stepCount={vizStepCount}
                    platformLength={vizPlatformLength}
                    platformWidth={vizPlatformWidth}
                    cableStep={debouncedCableStep}
                    threadsPerStep={threadsPerStep}
                  />
                )}
              </TabsContent>
            </Tabs>

            {/* График оптимизации */}
            <SpacingOptimizationChart
              platformLength={debouncedParams.platformLength}
              platformWidth={debouncedParams.platformWidth}
              stairsLength={stairsLength}
              currentSpacing={realPlatformSpacingCm}
              selectedSection={platformSections[0] || 0}
            />
            {/* DEBUG: Отладочное окно алгоритма */}
            <Card className="border-2 border-amber-500 bg-amber-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-amber-600 flex items-center gap-2">
                  🐛 DEBUG: Алгоритм расчёта кабеля
                </CardTitle>
                <CardDescription className="text-amber-600/70">Временное окно для отладки</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-xs font-mono">
                {/* Шаг 1: Входные параметры */}
                <div className="space-y-1">
                  <h4 className="font-bold text-amber-700">1. ВХОДНЫЕ ПАРАМЕТРЫ:</h4>
                  <p>• Площадка: {params.platformLength}м × {params.platformWidth}м = {platformArea.toFixed(2)} м²</p>
                  <p>• Ступени: {params.stepCount} шт × {params.stepLength}м (ширина пролёта)</p>
                </div>

                {/* Шаг 2: Расчёт ступеней */}
                <div className="space-y-1 border-t border-amber-300 pt-2">
                  <h4 className="font-bold text-amber-700">2. РАСЧЁТ СТУПЕНЕЙ:</h4>
                  <p>• Эффективная ширина = {params.stepLength}м - {MARGIN_OFFSET}м (отступ) = <span className="text-primary font-bold">{effectiveStepWidth.toFixed(2)}м</span></p>
                  <p>• Кабель на ступени = {effectiveStepWidth.toFixed(2)}м × {threadsPerStep} нитки × {params.stepCount} шт = <span className="text-primary font-bold">{(effectiveStepWidth * threadsPerStep * params.stepCount).toFixed(2)}м</span></p>
                  <p>• Технический запас = {STEP_TECHNICAL_RESERVE}м × {params.stepCount} шт = <span className="text-primary font-bold">{(STEP_TECHNICAL_RESERVE * params.stepCount).toFixed(2)}м</span></p>
                  <p className="bg-amber-200/50 p-1 rounded">➜ <strong>Итого ступени: {stairsRequiredLength.toFixed(2)}м</strong></p>
                </div>

                {/* Шаг 3: Расчёт площадки */}
                <div className="space-y-1 border-t border-amber-300 pt-2">
                  <h4 className="font-bold text-amber-700">3. РАСЧЁТ ПЛОЩАДКИ:</h4>
                  <p>• Эффективная площадь = ({params.platformLength}м - {MARGIN_OFFSET}м) × ({params.platformWidth}м - {MARGIN_OFFSET}м) = <span className="text-primary font-bold">{effectivePlatformArea.toFixed(2)} м²</span></p>
                  <p>• Целевая длина = {effectivePlatformArea.toFixed(2)} м² / {PLATFORM_SPACING}м (шаг) = <span className="text-primary font-bold">{(effectivePlatformArea / PLATFORM_SPACING).toFixed(2)}м</span></p>
                  <p>• + Запас на повороты = {PLATFORM_SLACK}м</p>
                  <p className="bg-amber-200/50 p-1 rounded">➜ <strong>Итого площадка: {platformRequiredLength.toFixed(2)}м</strong></p>
                </div>

                {/* Шаг 4: Общая потребность */}
                <div className="space-y-1 border-t border-amber-300 pt-2">
                  <h4 className="font-bold text-amber-700">4. ОБЩАЯ ПОТРЕБНОСТЬ:</h4>
                  <p>• Всего требуется = {stairsRequiredLength.toFixed(2)}м + {platformRequiredLength.toFixed(2)}м = <span className="text-primary font-bold">{totalRequiredLength.toFixed(2)}м</span></p>
                  <p>• Макс. секция = 120м → {totalRequiredLength <= 120 ? "✅ Одна секция" : "⚠️ Нужно несколько"}</p>
                </div>

                {/* Шаг 5: Подбор секций с оптимизацией */}
                <div className="space-y-1 border-t border-amber-300 pt-2">
                  <h4 className="font-bold text-amber-700">5. ПОДБОР СЕКЦИЙ (с оптимизацией шага):</h4>
                  <p>• Доступные: [{AVAILABLE_SECTIONS.join(", ")}]м</p>
                  <p className="text-muted-foreground">• Допустимый шаг площадки: {MIN_PLATFORM_SPACING_CM}-{MAX_PLATFORM_SPACING_CM} см</p>
                  
                  {/* Таблица попыток */}
                  {sectionAttempts.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="font-semibold text-amber-600">Процесс перебора:</p>
                      <div className="bg-white/50 rounded border border-amber-300 overflow-hidden">
                        <table className="w-full text-[10px]">
                          <thead className="bg-amber-200/50">
                            <tr>
                              <th className="px-2 py-1 text-left">#</th>
                              <th className="px-2 py-1 text-left">Секция</th>
                              <th className="px-2 py-1 text-left">На площадку</th>
                              <th className="px-2 py-1 text-left">Шаг</th>
                              <th className="px-2 py-1 text-left">Результат</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sectionAttempts.map((attempt, idx) => (
                              <tr 
                                key={idx} 
                                className={`border-t border-amber-200 ${
                                  attempt.status === 'selected' ? 'bg-green-100' : 
                                  attempt.status === 'too_dense' ? 'bg-red-50' : 
                                  attempt.status === 'too_sparse' ? 'bg-orange-50' : ''
                                }`}
                              >
                                <td className="px-2 py-1">{idx + 1}</td>
                                <td className="px-2 py-1 font-bold">{attempt.section}м</td>
                                <td className="px-2 py-1">{attempt.platformCable.toFixed(1)}м</td>
                                <td className={`px-2 py-1 font-bold ${
                                  attempt.status === 'selected' ? 'text-green-600' :
                                  attempt.status === 'too_dense' ? 'text-red-600' :
                                  attempt.status === 'too_sparse' ? 'text-orange-600' : ''
                                }`}>
                                  {attempt.spacingCm > 0 ? `${attempt.spacingCm}см` : '-'}
                                </td>
                                <td className="px-2 py-1 text-[9px]">{attempt.reason}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  
                  <div className="mt-2">
                    <p>• Итого секций для ступеней: [{stairsSections.join(", ")}]м = <span className="text-primary font-bold">{stairsTotalLength}м</span></p>
                    <p>• Итого секций для площадки: [{platformSections.length ? platformSections.join(", ") : "из общей секции"}]м = <span className="text-primary font-bold">{platformTotalLength}м</span></p>
                    <p className="bg-amber-200/50 p-1 rounded mt-1">➜ <strong>Итого кабель: {totalCableLength}м ({totalPower} Вт)</strong></p>
                  </div>
                </div>

                {/* Шаг 6: Реальный шаг на площадке */}
                <div className="space-y-1 border-t border-amber-300 pt-2">
                  <h4 className="font-bold text-amber-700">6. РЕАЛЬНЫЙ ШАГ ПЛОЩАДКИ:</h4>
                  <p>• Кабель на площадку (без запаса) = {platformTotalLength}м - {PLATFORM_SLACK}м = <span className="text-primary font-bold">{platformRealLength.toFixed(2)}м</span></p>
                  <p>• Реальный шаг = {effectivePlatformArea.toFixed(2)} м² / {platformRealLength.toFixed(2)}м = <span className={`font-bold ${isDensePacking || isSparsePacking ? 'text-destructive' : 'text-green-600'}`}>{realPlatformSpacingCm} см</span></p>
                  <p>• Допустимый диапазон: {MIN_PLATFORM_SPACING_CM}-{MAX_PLATFORM_SPACING_CM} см</p>
                  {isDensePacking && <p className="text-destructive font-bold">⚠️ Слишком плотно!</p>}
                  {isSparsePacking && <p className="text-amber-600 font-bold">⚠️ Слишком редко!</p>}
                </div>

                {/* Шаг 7: Расчёт нагрузки */}
                <div className="space-y-1 border-t border-amber-300 pt-2">
                  <h4 className="font-bold text-amber-700">7. РАСЧЁТ НАГРУЗКИ (AMPS):</h4>
                  <p>• Мощность = {totalPower} Вт</p>
                  <p>• Номинальный ток = {totalPower} Вт / {VOLTAGE}В = <span className="text-primary font-bold">{nominalAmps.toFixed(2)}А</span></p>
                  <p>• Коэффициент запаса = {SAFETY_FACTOR} (пусковой ток +25%)</p>
                  <p className="bg-amber-200/50 p-1 rounded">➜ <strong>Расчётный ток: {nominalAmps.toFixed(2)}А × {SAFETY_FACTOR} = {maxCalculatedAmps.toFixed(2)}А</strong></p>
                </div>

                {/* Шаг 8: Подбор оборудования */}
                <div className="space-y-1 border-t border-amber-300 pt-2">
                  <h4 className="font-bold text-amber-700">8. ПОДБОР ОБОРУДОВАНИЯ:</h4>
                  <p>• Режим: <span className="font-bold">{controlSystemMode === 'cabinet' ? 'Готовый шкаф' : 'Терморегулятор'}</span></p>
                  {controlSystemMode === 'cabinet' ? (
                    <>
                      <p>• Шкафы: [{CABINETS.map(c => c.amp + 'А').join(", ")}]</p>
                      <p>• Ищем шкаф где amp ≥ {maxCalculatedAmps.toFixed(2)}А</p>
                      <p className="bg-amber-200/50 p-1 rounded">
                        ➜ <strong>{selectedCabinet ? `Выбран: ${selectedCabinet.name}` : "Нужен 3-фазный шкаф"}</strong>
                      </p>
                    </>
                  ) : (
                    <>
                      <p>• Выбран: {selectedThermostat.name} (макс. {selectedThermostat.max_amps}А)</p>
                      <p>• Проверка: {maxCalculatedAmps.toFixed(2)}А {isThermostatOverloaded ? '>' : '≤'} {selectedThermostat.max_amps}А</p>
                      <p className={`bg-amber-200/50 p-1 rounded ${isThermostatOverloaded ? 'text-destructive' : 'text-green-600'}`}>
                        ➜ <strong>{isThermostatOverloaded ? "⛔️ ПЕРЕГРУЗКА!" : "✅ OK"}</strong>
                      </p>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

          </div>

          {/* Правая колонка - результаты */}
          <div className="lg:sticky lg:top-6 space-y-6">
            {/* Результаты расчёта */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-muted-foreground font-normal">Вам подходит:</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  {/* Секции для ступеней */}
                  {stairsSections.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-muted-foreground">Секции для ступеней:</h4>
                      {stairsSections.map((sectionLength, idx) => {
                        const cable = HEATING_CABLES.find(c => c.length === sectionLength);
                        return (
                          <div key={`stairs-${idx}`} className="bg-gradient-to-br from-primary/10 to-primary/5 p-3 rounded-lg border border-primary/20 space-y-2">
                            <h3 className="text-base font-bold text-foreground leading-tight">
                              {cable?.name || `Секция ${sectionLength}м`}
                            </h3>
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-muted-foreground">Артикул:</span>
                              <span className="font-semibold">{cable?.article || `—`}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-muted-foreground">Мощность:</span>
                              <span className="font-semibold">{Math.round(sectionLength * CABLE_POWER_PER_METER)} Вт</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
                  {/* Секции для площадки */}
                  {platformSections.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-muted-foreground">Секции для площадки:</h4>
                      {platformSections.map((sectionLength, idx) => {
                        const cable = HEATING_CABLES.find(c => c.length === sectionLength);
                        return (
                          <div key={`platform-${idx}`} className="bg-gradient-to-br from-accent/30 to-accent/10 p-3 rounded-lg border border-accent space-y-2">
                            <h3 className="text-base font-bold text-foreground leading-tight">
                              {cable?.name || `Секция ${sectionLength}м`}
                            </h3>
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-muted-foreground">Артикул:</span>
                              <span className="font-semibold">{cable?.article || `—`}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-muted-foreground">Мощность:</span>
                              <span className="font-semibold">{Math.round(sectionLength * CABLE_POWER_PER_METER)} Вт</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
                  {/* Итоговая информация */}
                  <div className="bg-gradient-to-br from-primary/20 to-primary/10 p-4 rounded-lg border-2 border-primary/30 space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Всего секций:</span>
                      <span className="font-semibold">{allSections.length} шт</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Общая длина кабеля:</span>
                      <span className="font-semibold">{totalCableLength} м</span>
                    </div>
                    {heatRiser && (
                      <div className="flex justify-between items-start gap-2 text-xs bg-primary/10 -mx-1 px-2 py-1.5 rounded border border-primary/20">
                        <span className="text-muted-foreground leading-tight">
                          + Прогрев подступенков<br />
                          <span className="text-[11px] opacity-80">
                            ({params.stepCount} ступ. + 1 площ.) × {effectiveStepWidth.toFixed(2)} м
                          </span>
                        </span>
                        <span className="font-semibold text-primary whitespace-nowrap">
                          +{(effectiveStepWidth * (params.stepCount + 1)).toFixed(2)} м
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Общая мощность:</span>
                      <span className="font-semibold">{Math.round(totalPower)} Вт</span>
                    </div>
                    <Separator className="bg-primary/30" />
                    <div className="flex justify-between items-center">
                      <span className="text-base font-medium">Стоимость кабелей:</span>
                      <span className="text-2xl font-bold text-primary">{fmtNum(cablePrice)} ₽</span>
                    </div>
                  </div>

                  {/* Инструкция для монтажа */}
                  <div className="bg-accent/50 border border-accent p-4 rounded-lg space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🛠️</span>
                      <h4 className="font-semibold text-base">Инструкция для монтажа</h4>
                    </div>
                    <div className="space-y-2 text-sm leading-relaxed">
                      <p>
                        <span className="font-medium">• Ступени:</span> укладка в 4 нитки (стандарт)
                      </p>
                      <p className={isDensePacking || isSparsePacking ? 'text-destructive font-semibold' : ''}>
                        <span className="font-medium">• Площадка:</span> шаг укладки — <span className="text-lg font-bold">{realPlatformSpacingCm} см</span>
                      </p>
                      {isDensePacking && (
                        <p className="text-xs text-destructive font-medium mt-2 bg-destructive/10 p-2 rounded">
                          ⚠️ Внимание: слишком плотная укладка (меньше 7.5 см)!
                        </p>
                      )}
                      {isSparsePacking && (
                        <p className="text-xs text-amber-600 font-medium mt-2 bg-amber-600/10 p-2 rounded">
                          ⚠️ Внимание: слишком редкая укладка (больше 12.5 см)!
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Примечания */}
                  <div className="space-y-2 text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
                    <p>✓ В расчёт включены отступы от стен и запас на петли/подступенки</p>
                    <p>✓ Холодный конец (силовой кабель) 4м уже в комплекте</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Комплектация системы */}
            <Card>
              <CardHeader>
                <CardTitle>Комплектация системы</CardTitle>
                <CardDescription>Всё необходимое для установки</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-3">
                  {/* Нагревательные кабели */}
                  <div className="flex items-start gap-3 p-3 bg-accent/30 rounded-lg">
                    <div className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm">Нагревательные кабели</p>
                      <p className="text-xs text-muted-foreground">
                        {allSections.length} секция(и), общая длина {totalCableLength}м ({Math.round(totalPower)} Вт)
                      </p>
                    </div>
                  </div>

                  {/* Холодный конец */}
                  <div className="flex items-start gap-3 p-3 bg-accent/30 rounded-lg">
                    <div className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm">Холодный конец</p>
                      <p className="text-xs text-muted-foreground">
                        Силовой кабель 4м (в комплекте)
                      </p>
                    </div>
                  </div>

                  {/* Терморегулятор */}
                  <div className="flex items-start gap-3 p-3 bg-accent/30 rounded-lg">
                    <div className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm">Терморегулятор</p>
                      <p className="text-xs text-muted-foreground">
                        С датчиком температуры и программируемым таймером
                      </p>
                    </div>
                  </div>

                  {/* Датчик температуры */}
                  <div className="flex items-start gap-3 p-3 bg-accent/30 rounded-lg">
                    <div className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm">Датчик температуры</p>
                      <p className="text-xs text-muted-foreground">
                        Выносной датчик для точного контроля
                      </p>
                    </div>
                  </div>

                  {/* Монтажная лента */}
                  <div className="flex items-start gap-3 p-3 bg-accent/30 rounded-lg">
                    <div className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm">Монтажная лента Fixtape</p>
                      <p className="text-xs text-muted-foreground">
                        {fixtapeRollsCount} рулон(ов) × 10 м (≈{fixtapeTotalMeters.toFixed(1)} м расхода)
                      </p>
                    </div>
                  </div>

                  {/* Крепёж ленты */}
                  <div className="flex items-start gap-3 p-3 bg-accent/30 rounded-lg">
                    <div className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm">Крепёж ленты (дюбель-гвозди)</p>
                      <p className="text-xs text-muted-foreground">
                        {fastenersCount} шт — из расчёта 5 шт на 1 м монтажной ленты
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Смета */}
            <Card>
              <CardHeader>
                <CardTitle>Смета</CardTitle>
                <CardDescription>Примерная стоимость оборудования</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Нагревательный кабель:</span>
                  <span className="font-medium">{fmtNum(cablePrice)} ₽</span>
                </div>
                
                {/* Выбор системы управления */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm">Система управления</h4>
                  
                  <Tabs value={controlSystemMode} onValueChange={(v) => setControlSystemMode(v as 'cabinet' | 'thermostat')}>
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="cabinet" className="text-xs">
                        <ShieldCheck className="h-3 w-3 mr-1" />
                        Готовый шкаф
                      </TabsTrigger>
                      <TabsTrigger value="thermostat" className="text-xs">Своя сборка</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="cabinet" className="mt-3 space-y-2">
                      {needsThreePhase ? (
                        <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-lg">
                          <p className="text-sm font-medium text-amber-600">
                            ⚠️ Требуется трёхфазный шкаф (индивидуальный расчёт)
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Расчётный ток {maxCalculatedAmps.toFixed(1)}А превышает возможности однофазных шкафов
                          </p>
                        </div>
                      ) : (
                        <div className="bg-primary/10 border border-primary/30 p-3 rounded-lg space-y-2">
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-primary" />
                            <span className="font-medium text-sm">Автоматически подобран:</span>
                          </div>
                          <p className="text-base font-bold">{selectedCabinet?.name}</p>
                          <p className="text-lg font-bold text-primary">{fmtNum(selectedCabinet?.price || 0)} ₽</p>
                          <p className="text-xs text-muted-foreground">
                            Расчёт нагрузки выполнен с учетом пусковых токов (+25% запаса)
                          </p>
                        </div>
                      )}

                      {shouldRecommendMultiCircuit && recommendedCabinet && (
                        <div className="bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-lg space-y-1.5">
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-emerald-600" />
                            <span className="font-medium text-sm text-emerald-700">
                              💡 Альтернатива трёхфазному шкафу
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Расчётный ток {maxCalculatedAmps.toFixed(1)} А &gt; {SINGLE_PHASE_MAX_AMPS} А
                            (предел 1-фазной цепи). Можно разделить нагрузку на несколько независимых
                            1-фазных цепей — каждая со своим шкафом и своим автоматом.
                          </p>
                          <div className="bg-background/60 rounded p-2 text-sm space-y-1">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Цепей:</span>
                              <span className="font-semibold">{recommendedNumCircuits} × 1-фазная</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Ток на цепь:</span>
                              <span className="font-semibold">~{recommendedAmpsPerCircuit.toFixed(1)} А</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Шкаф на цепь:</span>
                              <span className="font-semibold">{recommendedCabinet.name}</span>
                            </div>
                            <div className="flex justify-between border-t pt-1">
                              <span className="text-muted-foreground">Итого шкафов:</span>
                              <span className="font-bold text-emerald-700">
                                {recommendedNumCircuits} × {fmtNum(recommendedCabinet.price)} = {fmtNum(recommendedCabinetsTotalPrice)} ₽
                              </span>
                            </div>
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            Преимущества: проще монтаж, питание от обычной 1-фазной сети,
                            при отказе одной цепи остальные продолжают работать.
                          </p>
                        </div>
                      )}
                    </TabsContent>

                    
                    <TabsContent value="thermostat" className="mt-3 space-y-3">
                      <RadioGroup value={selectedThermostatId} onValueChange={setSelectedThermostatId}>
                        {THERMOSTATS.map((thermostat) => (
                          <div 
                            key={thermostat.id} 
                            className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors ${
                              selectedThermostatId === thermostat.id 
                                ? 'border-primary bg-primary/5' 
                                : 'border-border'
                            }`}
                          >
                            <RadioGroupItem value={thermostat.id} id={thermostat.id} className="mt-1" />
                            <div className="flex-1">
                              <Label htmlFor={thermostat.id} className="font-medium text-sm cursor-pointer">
                                {thermostat.name}
                              </Label>
                              <p className="text-xs text-muted-foreground">{thermostat.description}</p>
                              <p className="text-sm font-bold text-primary mt-1">{fmtNum(thermostat.price)} ₽</p>
                            </div>
                          </div>
                        ))}
                      </RadioGroup>
                      
                      {isThermostatOverloaded && (
                        <div className="bg-destructive/10 border border-destructive/30 p-3 rounded-lg">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                            <div>
                              <p className="text-sm font-semibold text-destructive">
                                ⛔️ ОПАСНО: Превышен предел регулятора!
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Расчётный ток {maxCalculatedAmps.toFixed(1)}А превышает предел {selectedThermostat.max_amps}А. 
                                Необходимо установить контактор или выбрать Шкаф Управления.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </div>
                
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Монтажная лента Fixtape (10м):</span>
                    <span className="font-medium">{fixtapeRollsCount} шт × {fmtNum(FIXTAPE_PRICE_PER_ROLL)} ₽</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Крепёж ленты (дюбель-гвозди):</span>
                    <span className="font-medium">{fastenersCount} шт</span>
                  </div>
                  <p className="text-xs text-muted-foreground pl-0">
                    Лента — шаг крепления 40 см. Дюбель-гвозди — 5 шт на 1 м ленты.
                  </p>
                </div>
                <Separator />
                <div className="flex justify-between pt-2">
                  <span className="font-semibold text-lg">Итого:</span>
                  <span className="font-bold text-lg text-primary">{fmtNum(totalPrice)} ₽</span>
                </div>
                <p className="text-xs text-muted-foreground pt-2">
                  * Стоимость монтажных работ рассчитывается индивидуально
                </p>
              </CardContent>
            </Card>

            {/* Кнопка оформить заказ - sticky на мобильных с анимацией */}
            <div 
              className={`lg:relative fixed left-0 right-0 lg:bottom-auto lg:left-auto lg:right-auto p-4 lg:p-0 bg-background lg:bg-transparent border-t lg:border-0 shadow-[0_-4px_12px_rgba(0,0,0,0.1)] lg:shadow-none z-40 transition-all duration-300 ease-out ${
                showOrderButton 
                  ? 'bottom-16 opacity-100 translate-y-0' 
                  : 'bottom-16 opacity-0 translate-y-full lg:opacity-100 lg:translate-y-0'
              }`}
            >
              <button
                onClick={handleOrderClick}
                className="w-full bg-[#0088cc] hover:bg-[#0077b5] text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-3 transition-colors text-lg shadow-lg hover:shadow-xl"
              >
                <Send className="h-5 w-5" />
                Оформить заказ
              </button>
            </div>
          </div>
        </div>
      </div>
      {/* Добавляем отступ снизу для sticky кнопки и нижнего меню на мобильных */}
      <div className="h-40 lg:h-0" />

      {/* Диалог выбора формата КП */}
      <Dialog open={orderDialogOpen} onOpenChange={setOrderDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Оформление заказа
            </DialogTitle>
            <DialogDescription>
              Выберите формат коммерческого предложения — оно откроется в окне предпросмотра, где можно скачать PDF или отправить на печать.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 mt-2">
            <button
              onClick={() => handleQuoteVariantSelect('full')}
              className="w-full text-left p-4 rounded-lg border-2 border-border hover:border-primary hover:bg-primary/5 transition-colors group"
            >
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-sm group-hover:text-primary">Полная спецификация</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Реквизиты, параметры объекта, таблица оборудования с артикулами и ценами, итог, контакты
                  </p>
                </div>
              </div>
            </button>

            <button
              onClick={() => handleQuoteVariantSelect('short')}
              className="w-full text-left p-4 rounded-lg border-2 border-border hover:border-primary hover:bg-primary/5 transition-colors group"
            >
              <div className="flex items-start gap-3">
                <Printer className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-sm group-hover:text-primary">Краткая смета</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Только таблица позиций с ценами и итоговая сумма
                  </p>
                </div>
              </div>
            </button>

            <button
              onClick={() => handleQuoteVariantSelect('full_with_scheme')}
              className="w-full text-left p-4 rounded-lg border-2 border-border hover:border-primary hover:bg-primary/5 transition-colors group"
            >
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-sm group-hover:text-primary">Спецификация + параметры укладки</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Полная спецификация плюс блок с параметрами укладки (шаг, нити, ток, питание)
                  </p>
                </div>
              </div>
            </button>
          </div>

          <Button variant="ghost" onClick={() => setOrderDialogOpen(false)} className="mt-2">
            Отмена
          </Button>
        </DialogContent>
      </Dialog>

      {/* Предпросмотр КП с кнопками «Скачать PDF» и «Печать» */}
      <QuotePreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        quote={previewData}
      />
    </div>
  );
};

export default Calculator;

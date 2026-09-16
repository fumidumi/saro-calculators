import { RESERVE_FACTOR, SARO_ROOFTOP, SARO_RESISTIVE, SARO_CABINET, VOLTAGE, round1, round2 } from "./constants";
import type { ZonesStep, ZoneResult, ObjectStep, FastenerItem } from "./types";

const FORBIDDEN_FASTENER_SUBSTRINGS = [
  "монтажная лента",
  "монтажной ленты",
  "монтажную ленту",
  "монтажная полоса",
  "монтажной полосы",
  "монтажную полосу",
  "полоса для фиксации",
  "полосы для фиксации",
];

export function isForbiddenFastener(item: FastenerItem): boolean {
  const hay = `${item.item} ${item.zone}`.toLowerCase();
  return FORBIDDEN_FASTENER_SUBSTRINGS.some((s) => hay.includes(s));
}

export function sanitizeFasteners(items: FastenerItem[] | undefined): FastenerItem[] {
  if (!items) return [];
  return items.filter((f) => !isForbiddenFastener(f));
}


const FASTENER_RESERVE = 1.1;
const ceilInt = (n: number) => Math.ceil(n);
const ceil1 = (n: number) => Math.ceil(n * 10) / 10;

export function calculateFasteners(zones: ZonesStep): FastenerItem[] {
  const out: FastenerItem[] = [];
  const note = "Предварительный расчет с запасом 10%";

  if (zones.gutter.enabled && zones.gutter.length > 0) {
    const L = zones.gutter.length;
    const holders = ceilInt(L * 6 * FASTENER_RESERVE);
    out.push({ zone: "Кровельный желоб", item: "Держатели / клипсы кабеля", quantity: holders, unit: "шт", note });
    out.push({ zone: "Кровельный желоб", item: "Метизы для крепления", quantity: holders, unit: "шт", note });
    if (zones.gutter.topExtraLine) {
      const topHolders = ceilInt(L * 2 * FASTENER_RESERVE);
      out.push({ zone: "Кровельный желоб - верхняя нитка", item: "Держатели верхней нитки", quantity: topHolders, unit: "шт", note });
      out.push({ zone: "Кровельный желоб - верхняя нитка", item: "Метизы верхней нитки", quantity: topHolders, unit: "шт", note });
    }
  }

  if (zones.hangingTray.enabled && zones.hangingTray.length > 0) {
    const L = zones.hangingTray.length;
    const factor = zones.hangingTray.widthCm >= 15 ? 6 : 4;
    const holders = ceilInt(L * factor * FASTENER_RESERVE);
    out.push({ zone: "Подвесной лоток", item: "Держатели / клипсы кабеля", quantity: holders, unit: "шт", note });
    out.push({ zone: "Подвесной лоток", item: "Метизы для крепления", quantity: holders, unit: "шт", note });
  }

  if (zones.downpipes.enabled && zones.downpipes.quantity > 0 && zones.downpipes.height > 0) {
    const q = zones.downpipes.quantity;
    const h = zones.downpipes.height;
    out.push({ zone: "Водосточные трубы", item: "Трос для подвеса кабеля", quantity: ceil1(q * h * FASTENER_RESERVE), unit: "м", note });
    out.push({ zone: "Водосточные трубы", item: "Комплект подвеса кабеля в трубе", quantity: ceilInt(q), unit: "компл", note });
    out.push({ zone: "Водосточные трубы", item: "Защита входа кабеля в трубу / кожух", quantity: ceilInt(q), unit: "шт", note });
    out.push({ zone: "Водосточные трубы", item: "Держатели / ограничители кабеля", quantity: ceilInt(q * 3), unit: "шт", note });
    if (zones.downpipes.hasFunnel) {
      out.push({ zone: "Водосточные трубы - воронка", item: "Крепёж кабеля в зоне воронки", quantity: ceilInt(q), unit: "компл", note });
    }
  }

  if (zones.valleys.enabled && zones.valleys.length > 0) {
    const heated = zones.valleys.length * 0.5;
    const holders = ceilInt(heated * 4 * FASTENER_RESERVE);
    out.push({ zone: "Ендовы", item: "Трос / направляющая для ендовы", quantity: ceil1(heated * FASTENER_RESERVE), unit: "м", note });
    out.push({ zone: "Ендовы", item: "Держатели кабеля для ендовы", quantity: holders, unit: "шт", note });
    out.push({ zone: "Ендовы", item: "Метизы для крепления", quantity: holders, unit: "шт", note });
  }

  if (zones.dripEdge.enabled && zones.dripEdge.length > 0) {
    const holders = ceilInt(zones.dripEdge.length * 2 * FASTENER_RESERVE);
    out.push({ zone: "Капельник", item: "Держатели кабеля для капельника", quantity: holders, unit: "шт", note });
    out.push({ zone: "Капельник", item: "Метизы для крепления", quantity: holders, unit: "шт", note });
  }

  if (zones.slopeEdge.enabled && zones.slopeEdge.length > 0 && zones.slopeEdge.widthCm > 0) {
    const widthM = zones.slopeEdge.widthCm / 100;
    const area = zones.slopeEdge.length * widthM;
    const clips = ceilInt(area * 15 * FASTENER_RESERVE);
    out.push({ zone: "Край ската змейкой", item: "Специальный крепёж для укладки змейкой", quantity: clips, unit: "шт", note });
    out.push({ zone: "Край ската змейкой", item: "Метизы для крепления", quantity: clips, unit: "шт", note });
  }

  return out;
}

export function calculateActualSnakeStep(edgeLengthM: number, widthCm: number, sectionLengthM: number): number {
  if (!edgeLengthM || !widthCm || !sectionLengthM) return 0;
  const widthM = widthCm / 100;
  const actualStepM = (edgeLengthM * widthM * 1.05) / sectionLengthM;
  return round1(actualStepM * 100);
}

export interface SnakeAlt {
  sectionLengthM: number;
  actualStepCm: number;
  direction: "lower" | "upper";
  warnings: string[];
}

export function getResistiveSnakeAlternatives(
  calculatedSnakeLengthM: number,
  edgeLengthM: number,
  widthCm: number,
): { lower: SnakeAlt | null; upper: SnakeAlt | null } {
  const avail = SARO_RESISTIVE.availableLengthsM;
  const lowerLen = [...avail].reverse().find((s) => s <= calculatedSnakeLengthM) ?? null;
  const upperLen = avail.find((s) => s >= calculatedSnakeLengthM) ?? null;
  const make = (len: number, direction: "lower" | "upper"): SnakeAlt => {
    const step = calculateActualSnakeStep(edgeLengthM, widthCm, len);
    const warnings: string[] = [];
    if (step >= 20) warnings.push("Шаг около 20 см или больше - сильно редкая укладка. Это экономичный вариант, применять только осознанно.");
    else if (step > 15) warnings.push("Шаг больше 15 см - редкая укладка. Применять только после проверки достаточности мощности для конкретной кровли.");
    if (step > 0 && step < 8) warnings.push("Шаг меньше 8 см - очень плотная укладка. Проверьте возможность крепления кабеля и допустимость такой схемы.");
    return { sectionLengthM: len, actualStepCm: step, direction, warnings };
  };
  return {
    lower: lowerLen ? make(lowerLen, "lower") : null,
    upper: upperLen ? make(upperLen, "upper") : null,
  };
}


export function calculateRoofGutter(length: number, topExtra: boolean): ZoneResult | null {
  if (!length || length <= 0) return null;
  const lines = topExtra ? 4 : 3;
  const L = length * RESERVE_FACTOR * lines;
  return {
    key: "gutter",
    name: "Кровельный желоб",
    inputs: `${length} м`,
    rule: topExtra ? "3 нитки внутри + 1 нитка по верху" : "3 нитки внутри",
    length: L,
    power: L * 30,
  };
}

export function calculateHangingGutter(length: number, widthCm: number): ZoneResult | null {
  if (!length || length <= 0) return null;
  const N = widthCm >= 15 ? 3 : 2;
  const L = length * RESERVE_FACTOR * N;
  return {
    key: "hanging",
    name: "Подвесной лоток",
    inputs: `${length} м, ширина ${widthCm} см`,
    rule: `${N} нитки`,
    length: L,
    power: L * 30,
  };
}

export function calculateDownpipes(quantity: number, height: number, hasFunnel: boolean): ZoneResult | null {
  if (!quantity || !height || quantity <= 0 || height <= 0) return null;
  const Lone = height * RESERVE_FACTOR + 1 + (hasFunnel ? 1.5 : 0);
  const L = quantity * Lone;
  return {
    key: "downpipes",
    name: "Водосточные трубы",
    inputs: `${quantity} шт × ${height} м${hasFunnel ? ", с воронкой" : ""}`,
    rule: hasFunnel ? "1 нитка + 1 м низ + 1,5 м воронка" : "1 нитка + 1 м низ",
    length: L,
    power: L * 30,
  };
}

export function calculateValleys(length: number): ZoneResult | null {
  if (!length || length <= 0) return null;
  const L = length * 0.5 * RESERVE_FACTOR * 2;
  return {
    key: "valleys",
    name: "Ендовы",
    inputs: `${length} м`,
    rule: "1/2 длины × 2 нитки",
    length: L,
    power: L * 30,
  };
}

export function calculateDripEdge(length: number): ZoneResult | null {
  if (!length || length <= 0) return null;
  const L = length * RESERVE_FACTOR;
  return {
    key: "drip",
    name: "Капельник",
    inputs: `${length} м`,
    rule: "1 нитка",
    length: L,
    power: L * 30,
  };
}

export function calculateRoofSlopeEdge(edgeLength: number, widthCm: number, stepCm: number): ZoneResult | null {
  if (!edgeLength || !widthCm || !stepCm) return null;
  const widthM = widthCm / 100;
  const stepM = stepCm / 100;
  const L = (edgeLength * widthM / stepM) * RESERVE_FACTOR;
  return {
    key: "slope",
    name: "Карнизная зона ската",
    inputs: `${edgeLength} м, полоса ${widthCm} см, шаг ${stepCm} см`,
    rule: "Змейка по нижней части ската",
    length: L,
    power: L * 30,
  };
}

export function calculateTotalLength(zones: ZonesStep): ZoneResult[] {
  const out: ZoneResult[] = [];
  if (zones.gutter.enabled) {
    const r = calculateRoofGutter(zones.gutter.length, zones.gutter.topExtraLine);
    if (r) out.push(r);
  }
  if (zones.hangingTray.enabled) {
    const r = calculateHangingGutter(zones.hangingTray.length, zones.hangingTray.widthCm);
    if (r) out.push(r);
  }
  if (zones.downpipes.enabled) {
    const r = calculateDownpipes(zones.downpipes.quantity, zones.downpipes.height, zones.downpipes.hasFunnel);
    if (r) out.push(r);
  }
  if (zones.valleys.enabled) {
    const r = calculateValleys(zones.valleys.length);
    if (r) out.push(r);
  }
  if (zones.dripEdge.enabled) {
    const r = calculateDripEdge(zones.dripEdge.length);
    if (r) out.push(r);
  }
  if (zones.slopeEdge.enabled) {
    const r = calculateRoofSlopeEdge(zones.slopeEdge.length, zones.slopeEdge.widthCm, zones.slopeEdge.stepCm);
    if (r) out.push(r);
  }
  return out;
}

export interface RooftopSection {
  index: number;
  length: number;
  power: number;
  workingCurrent: number;
  startupCurrent: number;
  breaker: string;
}

export function splitSaroRooftopSections(totalLength: number): RooftopSection[] {
  const sections: RooftopSection[] = [];
  let remaining = totalLength;
  let i = 1;
  const max = SARO_ROOFTOP.maxSectionLengthM;
  while (remaining > 0.05) {
    const len = Math.min(remaining, max);
    const power = len * SARO_ROOFTOP.powerWm;
    sections.push({
      index: i++,
      length: round1(len),
      power: round2(power / 1000) * 1000,
      workingCurrent: round1(power / VOLTAGE),
      startupCurrent: round1(len * SARO_ROOFTOP.startupCurrentPerMeterAtMinus15),
      breaker: len >= 100 ? "C25" : len >= 70 ? "C20" : len >= 40 ? "C16" : "C10",
    });
    remaining -= len;
  }
  return sections;
}

export interface ResistiveSelection {
  sections: number[];
  totalLength: number;
  excess: number;
  details: { length: number; power: number; current: number }[];
}

export function selectResistiveSections(neededLength: number): ResistiveSelection {
  if (neededLength <= 0) {
    return { sections: [], totalLength: 0, excess: 0, details: [] };
  }
  const available = [...SARO_RESISTIVE.availableLengthsM].sort((a, b) => b - a);
  const maxSingle = available[0];

  // Greedy with refinement: try combinations up to 6 sections
  let best: { combo: number[]; total: number } | null = null;
  const tryCombo = (combo: number[], total: number) => {
    if (total < neededLength) return;
    if (!best) { best = { combo, total }; return; }
    const bestExcess = best.total - neededLength;
    const excess = total - neededLength;
    if (excess < bestExcess || (excess === bestExcess && combo.length < best.combo.length)) {
      best = { combo, total };
    }
  };

  // Single-section options
  for (const s of available) tryCombo([s], s);

  // Greedy multi-section
  let remaining = neededLength;
  const greedy: number[] = [];
  while (remaining > 0) {
    const fit = available.find((s) => s <= remaining) ?? available[available.length - 1];
    greedy.push(fit);
    remaining -= fit;
    if (greedy.length > 20) break;
  }
  const greedyTotal = greedy.reduce((a, b) => a + b, 0);
  if (greedyTotal >= neededLength) tryCombo(greedy, greedyTotal);
  // Bump last greedy section up if undershoot
  if (greedyTotal < neededLength) {
    const last = greedy.pop()!;
    const upgrade = available.slice().reverse().find((s) => s > last) ?? maxSingle;
    const combo = [...greedy, upgrade];
    tryCombo(combo, combo.reduce((a, b) => a + b, 0));
  }

  // Combos of small length 2 to fine-tune
  for (const a of SARO_RESISTIVE.availableLengthsM) {
    for (const b of SARO_RESISTIVE.availableLengthsM) {
      if (a + b >= neededLength) tryCombo([a, b], a + b);
    }
  }
  for (const a of SARO_RESISTIVE.availableLengthsM) {
    for (const b of SARO_RESISTIVE.availableLengthsM) {
      for (const c of SARO_RESISTIVE.availableLengthsM) {
        if (a + b + c >= neededLength && a + b + c < neededLength + 20) tryCombo([a, b, c], a + b + c);
      }
    }
  }

  if (!best) return { sections: [], totalLength: 0, excess: 0, details: [] };
  const chosen = best as { combo: number[]; total: number };
  const details = chosen.combo.map((len) => {
    const power = len * SARO_RESISTIVE.powerWm;
    return { length: len, power, current: round1(power / VOLTAGE) };
  });
  return {
    sections: chosen.combo.sort((a, b) => b - a),
    totalLength: chosen.total,
    excess: round1(chosen.total - neededLength),
    details,
  };
}

export interface ElectricalSummary {
  totalLength: number;
  totalPower: number;
  totalWorking: number;
  totalStartup?: number;
}

export function calculateSaroRooftopElectrical(totalLength: number): ElectricalSummary {
  const p = totalLength * SARO_ROOFTOP.powerWm;
  return {
    totalLength: round1(totalLength),
    totalPower: round2(p / 1000),
    totalWorking: round1(p / VOLTAGE),
    totalStartup: round1(totalLength * SARO_ROOFTOP.startupCurrentPerMeterAtMinus15),
  };
}

export function calculateResistiveElectrical(sel: ResistiveSelection): ElectricalSummary {
  const p = sel.totalLength * SARO_RESISTIVE.powerWm;
  return {
    totalLength: sel.totalLength,
    totalPower: round2(p / 1000),
    totalWorking: round1(p / VOLTAGE),
  };
}

export interface Group {
  index: number;
  phase: number;
  sections: { length: number; workingCurrent: number; startupCurrent?: number }[];
  workingCurrent: number;
  startupCurrent?: number;
}

export interface GroupingResult {
  phases: 1 | 3;
  groups: Group[];
  breakerCurve: string;
  withinCabinetLimits: boolean;
  notes: string[];
}

export function calculateGroups(
  sections: { length: number; workingCurrent: number; startupCurrent?: number }[],
  powerChoice: "auto" | "1ph" | "3ph",
  isRooftop: boolean,
): GroupingResult {
  const maxWork = SARO_CABINET.maxWorkingCurrentPerPhaseA;
  const maxStart = SARO_CABINET.maxStartupCurrentA;
  const notes: string[] = [];
  const totalWorking = sections.reduce((a, s) => a + s.workingCurrent, 0);

  // Determine phases
  let phases: 1 | 3 = 1;
  if (powerChoice === "3ph") phases = 3;
  else if (powerChoice === "1ph") phases = 1;
  else phases = totalWorking > maxWork ? 3 : 1;

  // Pack sections into groups per phase
  const phaseLoads: Group[][] = Array.from({ length: phases }, () => []);
  // Sort sections by working current desc
  const sorted = [...sections].sort((a, b) => b.workingCurrent - a.workingCurrent);
  let gIndex = 1;
  for (const sec of sorted) {
    // Find phase with the least load
    let bestPhase = 0;
    let bestLoad = Infinity;
    for (let p = 0; p < phases; p++) {
      const load = phaseLoads[p].reduce((a, g) => a + g.workingCurrent, 0);
      if (load < bestLoad) { bestLoad = load; bestPhase = p; }
    }
    // Try to add to last group on that phase if it fits
    const groups = phaseLoads[bestPhase];
    const last = groups[groups.length - 1];
    const fitsWork = last && last.workingCurrent + sec.workingCurrent <= maxWork;
    const fitsStart = !isRooftop || !last || (last.startupCurrent ?? 0) + (sec.startupCurrent ?? 0) <= maxStart;
    if (last && fitsWork && fitsStart) {
      last.sections.push(sec);
      last.workingCurrent = round1(last.workingCurrent + sec.workingCurrent);
      if (isRooftop) last.startupCurrent = round1((last.startupCurrent ?? 0) + (sec.startupCurrent ?? 0));
    } else {
      groups.push({
        index: gIndex++,
        phase: bestPhase + 1,
        sections: [sec],
        workingCurrent: round1(sec.workingCurrent),
        startupCurrent: isRooftop ? round1(sec.startupCurrent ?? 0) : undefined,
      });
    }
  }

  const allGroups = phaseLoads.flat();
  const within = allGroups.every(
    (g) => g.workingCurrent <= maxWork && (!isRooftop || (g.startupCurrent ?? 0) <= maxStart),
  );
  if (!within) notes.push("Часть групп превышает ограничения шкафа SARO - требуется индивидуальная проверка.");
  if (phases === 3) notes.push("Рекомендуется трехфазное питание и распределение групп по фазам.");

  return { phases, groups: allGroups, breakerCurve: "C", withinCabinetLimits: within, notes };
}

const SURFACE_LABEL: Record<string, string> = {
  metal_drain: "металлический водосток",
  plastic_drain: "пластиковый водосток",
  metal_tile: "металлочерепица / профлист",
  seam_roof: "фальцевая кровля",
  soft_roof: "мягкая кровля",
  unknown: "не указано / универсально",
};

export function buildSpecification(params: {
  obj: ObjectStep;
  zones: ZoneResult[];
  cable: "rooftop" | "resistive";
  surfaceType?: string;
  rooftopSections?: RooftopSection[];
  resistive?: ResistiveSelection;
  grouping?: GroupingResult;
  fasteners?: FastenerItem[];
  snakeChoice?: { sectionLengthM: number; actualStepCm: number } | null;
  snakeFallback?: { sectionLengthM: number; actualStepCm: number } | null;
}) {
  const { obj, zones, cable, surfaceType, rooftopSections, resistive, grouping, fasteners, snakeChoice, snakeFallback } = params;
  const totalLen = zones.reduce((a, z) => a + z.length, 0);
  const lines: string[] = [];
  lines.push("СПЕЦИФИКАЦИЯ SARO - предварительный подбор");
  lines.push("");
  lines.push("Кабель: " + (cable === "rooftop" ? "SAROROOFTOP (саморегулирующийся, 30 Вт/м)" : "Резистивные секции SARO 30 Вт/м"));
  lines.push("Расчетная длина: " + round1(totalLen) + " м");
  if (cable === "rooftop" && rooftopSections) {
    lines.push("Секции SAROROOFTOP:");
    rooftopSections.forEach((s) => lines.push(`  - Секция ${s.index}: ${s.length} м, ${round2(s.power / 1000)} кВт, авт. ${s.breaker}`));
  }
  if (cable === "resistive" && resistive) {
    lines.push("Подобранные секции: " + resistive.sections.join(" + ") + " м");
    lines.push("Итоговая длина: " + resistive.totalLength + " м (избыток " + resistive.excess + " м)");
  }
  lines.push("Мощность: " + round2(totalLen * 30 / 1000) + " кВт");
  if (grouping) {
    lines.push("Питание: " + (grouping.phases === 3 ? "3 фазы" : "1 фаза") + ", автоматы тип C");
    lines.push("Групп: " + grouping.groups.length);
  }
  lines.push("Место установки автоматики: " + (obj.automationPlace === "outdoor" ? "на улице" : "в помещении / электрощите"));
  if (surfaceType) lines.push("Поверхность / водосток: " + (SURFACE_LABEL[surfaceType] ?? surfaceType));

  if (cable === "resistive" && (snakeChoice || snakeFallback)) {
    lines.push("");
    lines.push("Край ската змейкой - резистивная секция:");
    if (snakeChoice) {
      lines.push(`  - Выбранная секция: ${snakeChoice.sectionLengthM} м`);
      lines.push(`  - Фактический шаг укладки: ${snakeChoice.actualStepCm} см`);
    } else if (snakeFallback) {
      lines.push(`  - Секция (по умолчанию, ближайшая большая): ${snakeFallback.sectionLengthM} м`);
      lines.push(`  - Фактический шаг укладки: ${snakeFallback.actualStepCm} см`);
      lines.push("  - Требуется проверка шага укладки.");
    }
  }

  const safeFasteners = sanitizeFasteners(fasteners);
  if (safeFasteners.length > 0) {
    lines.push("");
    lines.push("Крепёж и монтажные элементы SARO:");
    safeFasteners.forEach((f) => {
      lines.push(`  - [${f.zone}] ${f.item}: ${f.quantity} ${f.unit}`);
    });
  }

  lines.push("");
  lines.push("Предупреждения:");
  lines.push("- Расчет является предварительным подбором материалов SARO.");
  lines.push("- Калькулятор не рассчитывает монтаж.");
  lines.push("- Для точной спецификации нужна схема кровли или фото объекта.");
  lines.push("- Крепёж рассчитан предварительно. Конкретный тип крепежа зависит от материала кровли, водосточной системы и способа фиксации кабеля.");
  if (cable === "resistive") lines.push("- Резистивные секции SARO не режутся.");
  if (cable === "rooftop") lines.push("- SAROROOFTOP ограничен 105 м на одну секцию.");
  return lines.join("\n");
}


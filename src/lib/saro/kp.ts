import { round1, round2 } from "./constants";
import { sanitizeFasteners } from "./calculations";
import type { ObjectStep, ZoneResult, FastenerItem } from "./types";
import type { RooftopSection, ResistiveSelection, GroupingResult, ElectricalSummary } from "./calculations";

const SURFACE_LABEL: Record<string, string> = {
  metal_drain: "Металлический водосток",
  plastic_drain: "Пластиковый водосток",
  metal_tile: "Металлочерепица / профлист",
  seam_roof: "Фальцевая кровля",
  soft_roof: "Мягкая кровля",
  unknown: "Не указано / универсально",
};

const OBJECT_TYPE_LABEL: Record<string, string> = {
  private: "Частный дом",
  commercial: "Коммерческий объект",
  industrial: "Промышленный объект",
};
const ROOF_TYPE_LABEL: Record<string, string> = {
  pitched: "Скатная",
  flat: "Плоская",
  complex: "Сложная",
};
const DRAIN_LABEL: Record<string, string> = {
  external: "Наружный водосток",
  internal: "Внутренний водосток",
  none: "Без водостока",
};
const AUTOMATION_LABEL: Record<string, string> = {
  outdoor: "Уличный шкаф SARO",
  indoor: "В помещении / в электрощите",
};

export interface KpData {
  obj: ObjectStep;
  zones: ZoneResult[];
  cable: "rooftop" | "resistive" | "compare";
  surfaceType?: string;
  rooftopSections?: RooftopSection[];
  rooftopElec?: ElectricalSummary;
  resistive?: ResistiveSelection;
  resistiveElec?: ElectricalSummary;
  rooftopGrouping?: GroupingResult;
  resistiveGrouping?: GroupingResult;
  fasteners?: FastenerItem[];
  snakeChoice?: { sectionLengthM: number; actualStepCm: number } | null;
  snakeFallback?: { sectionLengthM: number; actualStepCm: number } | null;
  orientation?: "portrait" | "landscape";
}

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

function nowDate(): string {
  const d = new Date();
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" });
}

function kpNumber(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `SARO-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

export function buildKpHtml(data: KpData): string {
  const {
    obj, zones, cable, surfaceType,
    rooftopSections, rooftopElec, resistive, resistiveElec,
    rooftopGrouping, resistiveGrouping, fasteners,
    snakeChoice, snakeFallback,
    orientation = "portrait",
  } = data;
  const isLandscape = orientation === "landscape";
  const pageMaxWidth = isLandscape ? 1100 : 800;

  const totalLen = zones.reduce((a, z) => a + z.length, 0);
  const totalPower = totalLen * 30;
  const showRoof = cable === "rooftop" || cable === "compare";
  const showRes = cable === "resistive" || cable === "compare";
  const safeFasteners = sanitizeFasteners(fasteners);

  const zoneRows = zones.length === 0
    ? `<tr><td colspan="5" class="muted center">Зоны не выбраны</td></tr>`
    : zones.map((z) => `
      <tr>
        <td><strong>${esc(z.name)}</strong></td>
        <td class="muted">${esc(z.inputs)}</td>
        <td class="muted">${esc(z.rule)}</td>
        <td class="num">${round1(z.length)} м</td>
        <td class="num">${round2(z.power / 1000)} кВт</td>
      </tr>`).join("");

  const rooftopBlock = showRoof && rooftopSections && rooftopElec ? `
    <section class="block">
      <h2>Вариант SAROROOFTOP</h2>
      <p class="muted small">Саморегулирующийся 30 Вт/м, секция до 105 м.</p>
      <div class="stats3">
        <div class="stat"><div class="stat-l">Общая длина</div><div class="stat-v">${rooftopElec.totalLength} м</div></div>
        <div class="stat"><div class="stat-l">Мощность</div><div class="stat-v">${rooftopElec.totalPower} кВт</div></div>
        <div class="stat"><div class="stat-l">Пусковой ток (-15 °C)</div><div class="stat-v">${rooftopElec.totalStartup} А</div></div>
      </div>
      <table class="data">
        <thead><tr><th>Секция</th><th>Длина</th><th>Мощность</th><th>Раб. ток</th><th>Пуск. ток</th><th>Автомат</th></tr></thead>
        <tbody>
          ${rooftopSections.map((s) => `
            <tr>
              <td><strong>№${s.index}</strong></td>
              <td class="num">${s.length} м</td>
              <td class="num">${round2(s.power / 1000)} кВт</td>
              <td class="num">${s.workingCurrent} А</td>
              <td class="num">${s.startupCurrent} А</td>
              <td>${s.breaker}</td>
            </tr>`).join("")}
        </tbody>
      </table>
    </section>` : "";

  const resBlock = showRes && resistive && resistiveElec ? `
    <section class="block">
      <h2>Вариант резистивных секций SARO</h2>
      <p class="muted small">Готовые секции 30 Вт/м. Секции не режутся.</p>
      <div class="stats3">
        <div class="stat"><div class="stat-l">Расчетная потребность</div><div class="stat-v">${round1(totalLen)} м</div></div>
        <div class="stat"><div class="stat-l">Итоговая длина</div><div class="stat-v">${resistive.totalLength} м</div></div>
        <div class="stat"><div class="stat-l">Избыток</div><div class="stat-v">${resistive.excess} м</div></div>
      </div>
      ${resistive.details.length > 0 ? `
      <table class="data">
        <thead><tr><th>Секция</th><th>Длина</th><th>Мощность</th><th>Ток</th></tr></thead>
        <tbody>
          ${resistive.details.map((d, i) => `
            <tr>
              <td><strong>№${i + 1}</strong></td>
              <td class="num">${d.length} м</td>
              <td class="num">${round2(d.power / 1000)} кВт</td>
              <td class="num">${d.current} А</td>
            </tr>`).join("")}
        </tbody>
      </table>` : `<p class="muted small">Нет данных для подбора секций.</p>`}
    </section>` : "";

  const snakeBlock = showRes && (snakeChoice || snakeFallback) ? `
    <section class="block">
      <h2>Край ската змейкой — резистивная секция</h2>
      ${snakeChoice ? `
        <p>Выбранная секция: <strong>${snakeChoice.sectionLengthM} м</strong></p>
        <p>Фактический шаг укладки: <strong>${snakeChoice.actualStepCm} см</strong></p>
      ` : `
        <p>Секция (по умолчанию, ближайшая большая): <strong>${snakeFallback!.sectionLengthM} м</strong></p>
        <p>Фактический шаг укладки: <strong>${snakeFallback!.actualStepCm} см</strong></p>
        <p class="warn">Требуется проверка шага укладки.</p>
      `}
    </section>` : "";

  const groupingHtml = (g: GroupingResult, title: string) => `
    <div class="grouping">
      <div class="g-title">${esc(title)} — ${g.phases === 3 ? "3 фазы" : "1 фаза"}, автоматы тип ${esc(g.breakerCurve)}</div>
      <table class="data">
        <thead><tr><th>Группа</th><th>Фаза</th><th>Секций</th><th>Раб. ток</th>${g.groups.some(x => x.startupCurrent != null) ? "<th>Пуск. ток</th>" : ""}</tr></thead>
        <tbody>
          ${g.groups.map((gr) => `
            <tr>
              <td><strong>№${gr.index}</strong></td>
              <td>L${gr.phase}</td>
              <td class="num">${gr.sections.length}</td>
              <td class="num">${gr.workingCurrent} А</td>
              ${gr.startupCurrent != null ? `<td class="num">${gr.startupCurrent} А</td>` : ""}
            </tr>`).join("")}
        </tbody>
      </table>
      ${g.notes.length > 0 ? `<ul class="notes">${g.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}
    </div>`;

  const groupsBlock = `
    <section class="block">
      <h2>Питание и группы</h2>
      ${showRoof && rooftopGrouping && rooftopGrouping.groups.length > 0 ? groupingHtml(rooftopGrouping, "SAROROOFTOP") : ""}
      ${showRes && resistiveGrouping && resistiveGrouping.groups.length > 0 ? groupingHtml(resistiveGrouping, "Резистивные секции SARO") : ""}
    </section>`;

  const fastenersBlock = safeFasteners.length > 0 ? `
    <section class="block">
      <h2>Крепёж и монтажные элементы SARO</h2>
      <p class="muted small">Предварительный перечень. Запас 10%, количества округлены вверх.</p>
      <table class="data">
        <thead><tr><th>Зона</th><th>Позиция</th><th>Кол-во</th><th>Примечание</th></tr></thead>
        <tbody>
          ${safeFasteners.map((f) => `
            <tr>
              <td><strong>${esc(f.zone)}</strong></td>
              <td>${esc(f.item)}</td>
              <td class="num">${f.quantity} ${esc(f.unit)}</td>
              <td class="muted small">${esc(f.note)}</td>
            </tr>`).join("")}
        </tbody>
      </table>
    </section>` : "";

  const warnings = [
    "Расчет является предварительным подбором материалов SARO.",
    "Калькулятор не рассчитывает монтаж.",
    "Для точной спецификации нужна схема кровли или фото объекта.",
    "Крепёж рассчитан предварительно. Конкретный тип крепежа зависит от материала кровли, водосточной системы и способа фиксации кабеля.",
    cable === "resistive" || cable === "compare" ? "Резистивные секции SARO не режутся." : "",
    cable === "rooftop" || cable === "compare" ? "SAROROOFTOP ограничен 105 м на одну секцию." : "",
    "Электропитание, защиту и коммутацию должен проверять специалист.",
  ].filter(Boolean);

  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>Коммерческое предложение SARO — ${kpNumber()}</title>
<style>
  *,*::before,*::after{box-sizing:border-box}
  html,body{margin:0;padding:0;background:#f5f5f7;color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;font-size:13px;line-height:1.5}
  .page{max-width:${pageMaxWidth}px;margin:24px auto;background:#fff;padding:48px 56px;box-shadow:0 4px 24px rgba(0,0,0,.06);border-radius:8px}
  .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #0ea5e9;padding-bottom:20px;margin-bottom:28px;break-inside:avoid;page-break-inside:avoid;break-after:avoid;page-break-after:avoid}
  .brand{font-size:28px;font-weight:800;color:#0ea5e9;letter-spacing:-.02em}
  .brand-sub{font-size:11px;color:#64748b;margin-top:2px;text-transform:uppercase;letter-spacing:.08em}
  .doc-meta{text-align:right;font-size:12px;color:#475569}
  .doc-meta .num{font-weight:600;color:#0f172a}
  h1{font-size:22px;font-weight:700;margin:0 0 6px;color:#0f172a;break-after:avoid;page-break-after:avoid}
  h2{font-size:15px;font-weight:700;margin:0 0 12px;color:#0f172a;padding-bottom:6px;border-bottom:1px solid #e2e8f0;break-after:avoid;page-break-after:avoid}
  h3{font-size:13px;font-weight:700;margin:16px 0 8px;color:#334155;break-after:avoid;page-break-after:avoid}
  p{margin:0 0 8px;orphans:3;widows:3}
  .subtitle{color:#64748b;font-size:13px;margin-bottom:24px}
  .block{margin-bottom:28px;break-inside:avoid;page-break-inside:avoid}
  .block.flow{break-inside:auto;page-break-inside:auto}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px 24px}
  .kv{display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px dashed #e2e8f0;font-size:12px;break-inside:avoid;page-break-inside:avoid}
  .kv .k{color:#64748b}
  .kv .v{font-weight:600;color:#0f172a;text-align:right}
  .summary{background:linear-gradient(135deg,#0ea5e9 0%,#0284c7 100%);color:#fff;border-radius:8px;padding:20px 24px;margin-bottom:28px;break-inside:avoid;page-break-inside:avoid;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .summary h2{color:#fff;border:none;margin-bottom:12px;font-size:12px;text-transform:uppercase;letter-spacing:.1em;opacity:.85;font-weight:600}
  .summary-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
  .summary-stat .l{font-size:11px;opacity:.85;text-transform:uppercase;letter-spacing:.05em}
  .summary-stat .v{font-size:22px;font-weight:700;margin-top:2px}
  .stats3{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px}
  .stat{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px 12px;break-inside:avoid;page-break-inside:avoid}
  .stat-l{font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.04em}
  .stat-v{font-size:16px;font-weight:700;margin-top:2px}
  table.data{width:100%;border-collapse:collapse;font-size:12px;margin-top:4px}
  table.data thead{display:table-header-group}
  table.data tfoot{display:table-footer-group}
  table.data th{background:#f1f5f9;text-align:left;font-weight:600;color:#334155;padding:8px 10px;border-bottom:2px solid #cbd5e1;font-size:11px;text-transform:uppercase;letter-spacing:.04em;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  table.data td{padding:8px 10px;border-bottom:1px solid #e2e8f0;vertical-align:top}
  table.data tr{break-inside:avoid;page-break-inside:avoid}
  table.data tr:last-child td{border-bottom:none}
  .num{white-space:nowrap}
  .muted{color:#64748b}
  .small{font-size:11px}
  .center{text-align:center}
  .warn{color:#b45309;font-weight:600}
  .grouping{margin-bottom:14px;break-inside:avoid;page-break-inside:avoid}
  .g-title{font-size:12px;font-weight:600;color:#334155;margin-bottom:6px}
  .notes{margin:6px 0 0;padding-left:18px;color:#64748b;font-size:11px}
  .warnings{background:#fffbeb;border:1px solid #fcd34d;border-radius:6px;padding:14px 18px;break-inside:avoid;page-break-inside:avoid;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .warnings h2{color:#92400e;border:none;margin-bottom:8px;font-size:13px}
  .warnings ul{margin:0;padding-left:18px}
  .warnings li{font-size:11px;color:#78350f;margin-bottom:4px}
  .footer{margin-top:36px;padding-top:18px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center;line-height:1.6;break-inside:avoid;page-break-inside:avoid}
  .actions{position:fixed;top:16px;right:16px;display:flex;gap:8px;z-index:10;align-items:center;background:rgba(255,255,255,.95);padding:8px;border-radius:8px;box-shadow:0 4px 14px rgba(0,0,0,.08)}
  .actions .seg{display:inline-flex;border:1px solid #cbd5e1;border-radius:6px;overflow:hidden}
  .actions .seg button{background:#fff;color:#0f172a;border:none;border-radius:0;padding:8px 12px;font-size:12px;font-weight:600;cursor:pointer;box-shadow:none}
  .actions .seg button.active{background:#0ea5e9;color:#fff}
  .actions button{background:#0ea5e9;color:#fff;border:none;border-radius:6px;padding:10px 16px;font-size:13px;font-weight:600;cursor:pointer;box-shadow:0 4px 12px rgba(14,165,233,.3)}
  .actions button.sec{background:#fff;color:#0f172a;border:1px solid #cbd5e1;box-shadow:0 2px 6px rgba(0,0,0,.06)}
  @media print{
    html,body{background:#fff}
    .page{max-width:none;margin:0;padding:12mm 14mm;box-shadow:none;border-radius:0}
    .actions{display:none !important}
    .block,.summary,.warnings,.footer,.header,.grouping{break-inside:avoid;page-break-inside:avoid}
    h1,h2,h3{break-after:avoid;page-break-after:avoid}
    table.data{break-inside:auto;page-break-inside:auto}
    table.data thead{display:table-header-group}
    table.data tr{break-inside:avoid;page-break-inside:avoid;page-break-after:auto}
    p,li{orphans:3;widows:3}
  }
  @page{size:A4 ${orientation};margin:12mm}
  #orientation-style{}
</style>
</head>
<body>
  <div class="actions" id="kp-actions">
    <span class="seg" role="group" aria-label="Ориентация">
      <button id="btn-portrait" class="${isLandscape ? "" : "active"}" onclick="setOrientation('portrait')">Книжная</button>
      <button id="btn-landscape" class="${isLandscape ? "active" : ""}" onclick="setOrientation('landscape')">Альбомная</button>
    </span>
    <button onclick="window.print()">Печать / PDF</button>
    <button class="sec" onclick="window.close()">Закрыть</button>
  </div>
  <style id="page-orientation">@page{size:A4 ${orientation};margin:12mm}</style>
  <div class="page">
    <div class="header">
      <div>
        <div class="brand">SARO</div>
        <div class="brand-sub">Системы антиобледенения кровли</div>
      </div>
      <div class="doc-meta">
        <div>Коммерческое предложение</div>
        <div class="num">№ ${kpNumber()}</div>
        <div>${nowDate()}</div>
      </div>
    </div>

    <h1>Предварительный технический подбор</h1>
    <p class="subtitle">Антиобледенение кровли — материалы SARO. Без стоимости, без монтажа.</p>

    <div class="summary">
      <h2>Итог расчета</h2>
      <div class="summary-grid">
        <div class="summary-stat"><div class="l">Длина кабеля</div><div class="v">${round1(totalLen)} м</div></div>
        <div class="summary-stat"><div class="l">Мощность</div><div class="v">${round2(totalPower / 1000)} кВт</div></div>
        <div class="summary-stat"><div class="l">Рабочий ток</div><div class="v">${round1(totalPower / 230)} А</div></div>
        <div class="summary-stat"><div class="l">Кабель</div><div class="v" style="font-size:14px">${cable === "compare" ? "Сравнение" : cable === "rooftop" ? "SAROROOFTOP" : "Резистивный SARO"}</div></div>
      </div>
    </div>

    <section class="block">
      <h2>Параметры объекта</h2>
      <div class="grid2">
        <div class="kv"><span class="k">Тип объекта</span><span class="v">${esc(OBJECT_TYPE_LABEL[obj.objectType] ?? obj.objectType)}</span></div>
        <div class="kv"><span class="k">Тип кровли</span><span class="v">${esc(ROOF_TYPE_LABEL[obj.roofType] ?? obj.roofType)}</span></div>
        <div class="kv"><span class="k">Водосток</span><span class="v">${esc(DRAIN_LABEL[obj.drainType] ?? obj.drainType)}</span></div>
        <div class="kv"><span class="k">Поверхность / водосток</span><span class="v">${esc(SURFACE_LABEL[surfaceType ?? "unknown"] ?? "—")}</span></div>
        <div class="kv"><span class="k">Питание</span><span class="v">${obj.powerChoice === "auto" ? "Автоподбор" : obj.powerChoice === "1ph" ? "1 фаза" : "3 фазы"}</span></div>
        <div class="kv"><span class="k">Место автоматики</span><span class="v">${esc(AUTOMATION_LABEL[obj.automationPlace] ?? obj.automationPlace)}</span></div>
      </div>
    </section>

    <section class="block">
      <h2>Расчет по зонам кровли</h2>
      <table class="data">
        <thead><tr><th>Зона</th><th>Размеры</th><th>Правило</th><th>Длина</th><th>Мощность</th></tr></thead>
        <tbody>${zoneRows}</tbody>
      </table>
    </section>

    ${rooftopBlock}
    ${resBlock}
    ${snakeBlock}
    ${groupsBlock}
    ${fastenersBlock}

    <section class="block warnings">
      <h2>Важные примечания</h2>
      <ul>${warnings.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>
    </section>

    <div class="footer">
      Документ сформирован калькулятором SARO. Предварительный технический подбор — не является публичной офертой.<br>
      Финальная спецификация уточняется по проекту, схеме кровли или фото объекта.
    </div>
  </div>
  <script>
    window.addEventListener('load', function(){ try{ window.focus(); }catch(e){} });
    function setOrientation(o){
      var s = document.getElementById('page-orientation');
      if (s) s.textContent = '@page{size:A4 ' + o + ';margin:12mm}';
      var pMax = (o === 'landscape') ? 1100 : 800;
      var page = document.querySelector('.page');
      if (page) page.style.maxWidth = pMax + 'px';
      var bp = document.getElementById('btn-portrait');
      var bl = document.getElementById('btn-landscape');
      if (bp && bl){ bp.className = (o === 'portrait') ? 'active' : ''; bl.className = (o === 'landscape') ? 'active' : ''; }
    }
  </script>
</body>
</html>`;
}

export function openKpWindow(html: string, autoPrint = false) {
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) {
    alert("Не удалось открыть окно. Разрешите всплывающие окна для этого сайта.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  if (autoPrint) {
    const trigger = () => { try { w.focus(); w.print(); } catch {} };
    if (w.document.readyState === "complete") setTimeout(trigger, 300);
    else w.addEventListener("load", () => setTimeout(trigger, 300));
  }
}

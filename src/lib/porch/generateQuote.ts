// Утилита генерации коммерческого предложения
// Возвращает HTML-разметку для предпросмотра в модальном окне
// и предоставляет методы скачивания PDF и печати

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export type QuoteVariant = 'full' | 'short' | 'full_with_scheme';

export interface QuoteSection {
  name: string;
  article: string;
  qty: string;
  price: number;
}

export interface QuoteData {
  variant: QuoteVariant;
  // Параметры объекта
  stepLength: number;
  stepCount: number;
  platformLength: number;
  platformWidth: number;
  heatRiser: boolean;
  // Расчёт
  totalCableLength: number;
  totalPower: number;
  maxAmps: number;
  platformSpacingCm: number;
  threadsPerStep: number;
  // Позиции
  sections: QuoteSection[];
  controlSystem: { name: string; price: number };
  fixtape: { rolls: number; price: number };
  cablePrice: number;
  totalPrice: number;
}

const fmt = (n: number) => n.toLocaleString('ru-RU');

/** Строит HTML-разметку тела КП (без <html>/<head>) — для вставки в превью */
export const buildQuoteBodyHTML = (q: QuoteData): string => {
  const date = new Date().toLocaleDateString('ru-RU');
  const showFullSpecs = q.variant !== 'short';
  const showScheme = q.variant === 'full_with_scheme';

  const rows = [
    ...q.sections.map(
      (s, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${s.name}</td>
        <td>${s.article}</td>
        <td>${s.qty}</td>
        <td class="r">${fmt(s.price)} ₽</td>
      </tr>`,
    ),
    `<tr>
      <td>${q.sections.length + 1}</td>
      <td>${q.controlSystem.name}</td>
      <td>—</td>
      <td>1 шт</td>
      <td class="r">${fmt(q.controlSystem.price)} ₽</td>
    </tr>`,
    `<tr>
      <td>${q.sections.length + 2}</td>
      <td>Монтажная лента Fixtape (10 м)</td>
      <td>FIXTAPE-10</td>
      <td>${q.fixtape.rolls} рул.</td>
      <td class="r">${fmt(q.fixtape.price)} ₽</td>
    </tr>`,
  ].join('');

  return `
  <div class="header">
    <div>
      <div class="brand">SARO<small>Системы снеготаяния</small></div>
    </div>
    <div class="meta">
      <div><strong>Коммерческое предложение</strong></div>
      <div>Дата: ${date}</div>
      <div>Менеджер: @oshort</div>
    </div>
  </div>

  <h1>Система обогрева ступеней и площадки</h1>

  ${
    showFullSpecs
      ? `<h2>Параметры объекта</h2>
  <div class="params">
    <div><strong>Ширина пролёта:</strong> ${q.stepLength} м</div>
    <div><strong>Количество ступеней:</strong> ${q.stepCount} шт</div>
    <div><strong>Площадка:</strong> ${q.platformLength} × ${q.platformWidth} м</div>
    <div><strong>Прогрев подступенка:</strong> ${q.heatRiser ? 'Да' : 'Нет'}</div>
    <div><strong>Общая длина кабеля:</strong> ${q.totalCableLength} м</div>
    <div><strong>Общая мощность:</strong> ${Math.round(q.totalPower)} Вт</div>
  </div>`
      : ''
  }

  <h2>Спецификация оборудования</h2>
  <table>
    <thead>
      <tr><th style="width:32px">№</th><th>Наименование</th><th style="width:110px">Артикул</th><th style="width:80px">Кол-во</th><th class="r" style="width:110px">Стоимость</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totals">
    <table>
      <tr><td>Кабель:</td><td class="r">${fmt(q.cablePrice)} ₽</td></tr>
      <tr><td>Управление:</td><td class="r">${fmt(q.controlSystem.price)} ₽</td></tr>
      <tr><td>Монтажная лента:</td><td class="r">${fmt(q.fixtape.price)} ₽</td></tr>
      <tr><td class="grand">ИТОГО:</td><td class="r grand">${fmt(q.totalPrice)} ₽</td></tr>
    </table>
  </div>

  ${
    showScheme
      ? `<h2>Параметры укладки</h2>
  <div class="scheme">
    <div><strong>Ниток на ступень:</strong> ${q.threadsPerStep} ${q.heatRiser ? '(включая подступенок)' : ''}</div>
    <div><strong>Шаг укладки на площадке:</strong> ${q.platformSpacingCm} см</div>
    <div><strong>Расчётный ток:</strong> ${q.maxAmps.toFixed(1)} А (с запасом 25%)</div>
    <div><strong>Питание:</strong> 220 В, однофазное</div>
    <div class="note">Раскладка кабеля: горизонтальные нити вдоль ступеней (зигзаг), на площадке — змейка с указанным шагом.</div>
  </div>`
      : ''
  }

  <div class="footer">
    <p>* Стоимость монтажных работ рассчитывается индивидуально. Цены действительны 14 дней с даты оформления КП.</p>
    <p>Для оформления заказа свяжитесь с менеджером в Telegram: <strong>@oshort</strong></p>
  </div>
  `;
};

/** CSS для КП — используется и в превью, и в окне печати */
export const QUOTE_STYLES = `
  .quote-doc { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #1a1a1a; font-size: 13px; line-height: 1.5; background: #fff; padding: 24px; }
  .quote-doc * { box-sizing: border-box; }
  .quote-doc .header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom: 3px solid #FF6B35; padding-bottom: 12px; margin-bottom: 18px; }
  .quote-doc .brand { font-size: 24px; font-weight: 800; color: #FF6B35; letter-spacing: 1px; }
  .quote-doc .brand small { display:block; font-size:11px; font-weight:500; color:#666; letter-spacing:0; margin-top:4px; }
  .quote-doc .meta { text-align:right; font-size:12px; color:#555; }
  .quote-doc h1 { font-size: 18px; margin: 0 0 4px; }
  .quote-doc h2 { font-size: 14px; margin: 18px 0 8px; color:#FF6B35; border-bottom: 1px solid #eee; padding-bottom: 4px; }
  .quote-doc table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  .quote-doc th, .quote-doc td { border: 1px solid #ddd; padding: 8px 10px; text-align: left; vertical-align: top; }
  .quote-doc th { background: #FFF4EE; font-weight: 600; font-size: 12px; }
  .quote-doc td.r, .quote-doc th.r { text-align: right; }
  .quote-doc .totals { margin-top: 14px; display:flex; justify-content:flex-end; }
  .quote-doc .totals table { width: 320px; }
  .quote-doc .totals td { padding: 6px 10px; }
  .quote-doc .totals .grand { font-size: 16px; font-weight: 800; color:#FF6B35; }
  .quote-doc .params { display:grid; grid-template-columns: 1fr 1fr; gap: 6px 18px; background:#fafafa; padding:12px 14px; border-radius:6px; border:1px solid #eee; }
  .quote-doc .params div { font-size: 12px; }
  .quote-doc .params strong { color:#333; }
  .quote-doc .footer { margin-top: 28px; padding-top: 12px; border-top: 1px solid #eee; font-size: 11px; color: #666; }
  .quote-doc .scheme { margin-top: 8px; background:#fafafa; padding:12px; border-radius:6px; border:1px solid #eee; font-size:12px; }
  .quote-doc .scheme div { margin: 3px 0; }
  .quote-doc .note { font-size: 11px; color:#777; margin-top: 6px; }
`;

/** Печать КП через скрытое окно (использует системный диалог печати) */
export const printQuote = (q: QuoteData): void => {
  const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"/><title>КП SARO — ${new Date().toLocaleDateString('ru-RU')}</title>
<style>@page { size: A4; margin: 18mm 14mm; } body { margin: 0; } ${QUOTE_STYLES} .quote-doc { padding: 0; }</style>
</head><body><div class="quote-doc">${buildQuoteBodyHTML(q)}</div>
<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),300));</script>
</body></html>`;
  const win = window.open('', '_blank', 'width=900,height=1100');
  if (!win) {
    alert('Не удалось открыть окно печати. Разрешите всплывающие окна для этого сайта.');
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
};

/**
 * Скачивание КП как PDF без системного диалога печати.
 * Рендерит переданный DOM-элемент через html2canvas и сохраняет multi-page A4 PDF.
 */
export const downloadQuotePDF = async (element: HTMLElement, filename = 'KP-SARO.pdf'): Promise<void> => {
  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
  });

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10; // mm
  const imgWidth = pageWidth - margin * 2;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  const imgData = canvas.toDataURL('image/jpeg', 0.95);

  if (imgHeight <= pageHeight - margin * 2) {
    pdf.addImage(imgData, 'JPEG', margin, margin, imgWidth, imgHeight);
  } else {
    // Многостраничный PDF: режем canvas по высоте страницы
    const pxPerMm = canvas.width / imgWidth;
    const pageHeightPx = (pageHeight - margin * 2) * pxPerMm;
    let renderedPx = 0;
    let pageIndex = 0;

    while (renderedPx < canvas.height) {
      const sliceHeightPx = Math.min(pageHeightPx, canvas.height - renderedPx);
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHeightPx;
      const ctx = pageCanvas.getContext('2d');
      if (!ctx) break;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      ctx.drawImage(canvas, 0, renderedPx, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx);
      const sliceData = pageCanvas.toDataURL('image/jpeg', 0.95);
      const sliceMm = sliceHeightPx / pxPerMm;
      if (pageIndex > 0) pdf.addPage();
      pdf.addImage(sliceData, 'JPEG', margin, margin, imgWidth, sliceMm);
      renderedPx += sliceHeightPx;
      pageIndex += 1;
    }
  }

  pdf.save(filename);
};

// Обратная совместимость со старым API (если где-то ещё вызывается)
export const generateQuotePDF = printQuote;

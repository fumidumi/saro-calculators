const { app, BrowserWindow } = require("electron");
const path = require("path");

const TIMEOUT_MS = 30000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForCalculator(win) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < TIMEOUT_MS) {
    const result = await win.webContents.executeJavaScript(`(() => {
      const checkbox = Array.from(document.querySelectorAll('input[type="checkbox"]'))
        .find((node) => node.parentElement?.textContent?.includes('Площадки нет'));
      if (!checkbox) return null;
      const rect = checkbox.getBoundingClientRect();
      const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return {
        checked: checkbox.checked,
        x: Math.round(rect.left + rect.width / 2),
        y: Math.round(rect.top + rect.height / 2),
        bodyPointerEvents: getComputedStyle(document.body).pointerEvents,
        rootPointerEvents: getComputedStyle(document.getElementById('root')).pointerEvents,
        bodyInert: document.body.inert,
        rootInert: document.getElementById('root').inert,
        topTag: top?.tagName || null,
        topType: top?.getAttribute?.('type') || null,
      };
    })()`);
    if (result) return result;
    await sleep(250);
  }

  throw new Error("Калькулятор крыльца не появился за 30 секунд");
}

async function run() {
  const indexHtml = path.join(__dirname, "..", "electron-output", "public", "index.html");
  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });

  const errors = [];
  win.webContents.on("console-message", (_event, level, message) => {
    if (level >= 2) errors.push(message);
  });
  win.webContents.on("render-process-gone", (_event, details) => {
    errors.push(`renderer stopped: ${details.reason}`);
  });

  await win.loadFile(indexHtml, { hash: "/porch" });
  const before = await waitForCalculator(win);

  // Короткий тест сразу после отрисовки мог не заметить последующее зависание.
  // Выдерживаем приложение и проверяем взаимодействие уже в устойчивом состоянии.
  await sleep(20000);
  const stable = await waitForCalculator(win);

  if (stable.bodyPointerEvents === "none" || stable.rootPointerEvents === "none") {
    throw new Error(`Интерфейс блокирует мышь: ${JSON.stringify(stable)}`);
  }
  if (stable.bodyInert || stable.rootInert) {
    throw new Error(`Интерфейс помечен inert: ${JSON.stringify(stable)}`);
  }
  if (stable.topTag !== "INPUT" || stable.topType !== "checkbox") {
    throw new Error(`Флажок перекрыт другим элементом: ${JSON.stringify(stable)}`);
  }

  win.webContents.sendInputEvent({ type: "mouseMove", x: stable.x, y: stable.y });
  win.webContents.sendInputEvent({ type: "mouseDown", x: stable.x, y: stable.y, button: "left", clickCount: 1 });
  win.webContents.sendInputEvent({ type: "mouseUp", x: stable.x, y: stable.y, button: "left", clickCount: 1 });
  await sleep(400);

  const after = await waitForCalculator(win);
  if (after.checked === stable.checked) {
    throw new Error(`Настоящий клик мышью не изменил флажок: ${JSON.stringify({ before, stable, after, errors })}`);
  }

  win.webContents.sendInputEvent({ type: "keyDown", keyCode: "TAB" });
  win.webContents.sendInputEvent({ type: "keyUp", keyCode: "TAB" });
  await sleep(100);
  const activeTag = await win.webContents.executeJavaScript("document.activeElement?.tagName || null");

  console.log("SARO_ELECTRON_SMOKE_OK", JSON.stringify({ before, stable, after, activeTag, errors }));
  win.destroy();
  app.exit(0);
}

const watchdog = setTimeout(() => {
  console.error("SARO_ELECTRON_SMOKE_TIMEOUT");
  app.exit(1);
}, TIMEOUT_MS + 10000);

app.whenReady().then(run).catch((error) => {
  console.error("SARO_ELECTRON_SMOKE_FAILED", error);
  clearTimeout(watchdog);
  app.exit(1);
});

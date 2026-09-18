const { app } = require("electron");

const TIMEOUT_MS = 60000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function inspectCheckbox(win) {
  return win.webContents.executeJavaScript(`(() => {
    const checkbox = Array.from(document.querySelectorAll('input[type="checkbox"]'))
      .find((node) => node.parentElement?.textContent?.includes('Площадки нет'));
    if (!checkbox) return null;
    const rect = checkbox.getBoundingClientRect();
    const x = Math.round(rect.left + rect.width / 2);
    const y = Math.round(rect.top + rect.height / 2);
    const top = document.elementFromPoint(x, y);
    return {
      checked: checkbox.checked,
      x,
      y,
      bodyPointerEvents: getComputedStyle(document.body).pointerEvents,
      rootPointerEvents: getComputedStyle(document.getElementById('root')).pointerEvents,
      bodyInert: document.body.inert,
      rootInert: document.getElementById('root').inert,
      topTag: top?.tagName || null,
      topType: top?.getAttribute?.('type') || null,
    };
  })()`);
}

async function waitForCheckbox(win) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < TIMEOUT_MS) {
    const result = await inspectCheckbox(win);
    if (result) return result;
    await sleep(250);
  }
  throw new Error("Калькулятор крыльца не появился");
}

async function runPackagedSmoke(win) {
  const watchdog = setTimeout(() => {
    console.error("SARO_PACKAGED_SMOKE_TIMEOUT");
    app.exit(1);
  }, TIMEOUT_MS + 30000);

  try {
    await win.webContents.executeJavaScript("location.hash = '/porch'");
    const before = await waitForCheckbox(win);

    // Проверяем уже собранное приложение после выдержки, когда у пользователя
    // прежде проявлялось полное зависание интерфейса.
    await sleep(20000);
    const stable = await waitForCheckbox(win);

    if (
      stable.bodyPointerEvents === "none" ||
      stable.rootPointerEvents === "none" ||
      stable.bodyInert ||
      stable.rootInert ||
      stable.topTag !== "INPUT" ||
      stable.topType !== "checkbox"
    ) {
      throw new Error(`Интерфейс заблокирован: ${JSON.stringify(stable)}`);
    }

    win.webContents.sendInputEvent({ type: "mouseMove", x: stable.x, y: stable.y });
    win.webContents.sendInputEvent({ type: "mouseDown", x: stable.x, y: stable.y, button: "left", clickCount: 1 });
    win.webContents.sendInputEvent({ type: "mouseUp", x: stable.x, y: stable.y, button: "left", clickCount: 1 });
    await sleep(500);

    const after = await waitForCheckbox(win);
    if (after.checked === stable.checked) {
      throw new Error(`Клик не изменил флажок: ${JSON.stringify({ before, stable, after })}`);
    }

    win.webContents.sendInputEvent({ type: "keyDown", keyCode: "TAB" });
    win.webContents.sendInputEvent({ type: "keyUp", keyCode: "TAB" });
    await sleep(150);
    const activeTag = await win.webContents.executeJavaScript("document.activeElement?.tagName || null");

    console.log("SARO_PACKAGED_SMOKE_OK", JSON.stringify({ version: app.getVersion(), before, stable, after, activeTag }));
    clearTimeout(watchdog);
    app.exit(0);
  } catch (error) {
    console.error("SARO_PACKAGED_SMOKE_FAILED", error);
    clearTimeout(watchdog);
    app.exit(1);
  }
}

module.exports = { runPackagedSmoke };

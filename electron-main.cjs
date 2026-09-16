const { app, BrowserWindow, Menu, dialog, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');

const APP_NAME = 'SARO системы обогрева';
const RELEASE_DATE = '16.09.2026';
const UPDATE_CHANNEL = 'latest-roof';

let mainWindow = null;

function pathExists(filePath) {
  try {
    return Boolean(filePath) && fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function getIndexCandidates() {
  const roots = [
    path.join(process.resourcesPath || '', 'electron-output'),
    path.join(__dirname, 'electron-output'),
    path.join(__dirname, 'dist-desktop'),
    path.join(__dirname, 'dist'),
  ];

  const relatives = [
    path.join('public', 'index.html'),
    path.join('public', 'client', 'index.html'),
    'index.html',
  ];

  const candidates = [];
  for (const root of roots) {
    for (const relative of relatives) {
      candidates.push(path.join(root, relative));
    }
  }

  return candidates;
}

function findIndexHtml() {
  return getIndexCandidates().find(pathExists) || null;
}

function showStartupError(win, message) {
  const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8">
  <style>body{font-family:Segoe UI,Arial,sans-serif;background:#f8fafc;color:#0f172a;padding:40px;line-height:1.6}
  pre{background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;white-space:pre-wrap;font-size:12px}</style>
  </head><body><h2>Не удалось открыть калькулятор</h2><pre>${message.replace(/</g, '&lt;')}</pre>
  <p>Пожалуйста, переустановите программу или сообщите этот текст разработчику.</p></body></html>`;

  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
}

function createMenu(win) {
  const version = app.getVersion();

  const menu = Menu.buildFromTemplate([
    {
      label: 'О программе',
      submenu: [
        { label: `Версия: ${version}`, enabled: false },
        { label: `Дата релиза: ${RELEASE_DATE}`, enabled: false },
        { type: 'separator' },
        {
          label: 'Информация',
          click: () => {
            dialog.showMessageBox(win, {
              type: 'info',
              title: 'О программе',
              message: APP_NAME,
              detail: `Версия: ${version}\nДата релиза: ${RELEASE_DATE}\nКанал обновлений: ${UPDATE_CHANNEL}\n\nКалькулятор систем обогрева SARO.`,
            });
          },
        },
        {
          label: 'Проверить обновления',
          click: () => {
            autoUpdater.checkForUpdates().catch(() => {
              dialog.showMessageBox(win, {
                type: 'info',
                title: 'Обновления',
                message: 'Сервер обновлений недоступен.',
                detail: 'Программа продолжит работать в текущей версии.',
              });
            });
          },
        },
        { type: 'separator' },
        { label: 'Выход', role: 'quit' },
      ],
    },
    {
      label: 'Правка',
      submenu: [
        { label: 'Отменить', role: 'undo' },
        { label: 'Повторить', role: 'redo' },
        { type: 'separator' },
        { label: 'Вырезать', role: 'cut' },
        { label: 'Копировать', role: 'copy' },
        { label: 'Вставить', role: 'paste' },
        { label: 'Выделить всё', role: 'selectAll' },
      ],
    },
    {
      label: 'Вид',
      submenu: [
        { label: 'Обновить', role: 'reload' },
        { label: 'Полный экран', role: 'togglefullscreen' },
        { type: 'separator' },
        { label: 'Масштаб +', role: 'zoomIn' },
        { label: 'Масштаб -', role: 'zoomOut' },
        { label: 'Сбросить масштаб', role: 'resetZoom' },
        { type: 'separator' },
        { label: 'Средства разработчика (F12)', role: 'toggleDevTools' },
      ],
    },
  ]);

  Menu.setApplicationMenu(menu);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 1100,
    minHeight: 760,
    show: false,
    title: `${APP_NAME} v${app.getVersion()}`,
    backgroundColor: '#f8fafc',
    autoHideMenuBar: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: true,
      backgroundThrottling: false,
    },
  });

  mainWindow = win;
  createMenu(win);

  win.once('ready-to-show', () => {
    win.show();
    win.focus();
  });

  // Внешние ссылки открываем в браузере, чтобы окно программы не зависало.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('before-input-event', (_event, input) => {
    if (input.type === 'keyDown' && input.key === 'F12') {
      win.webContents.toggleDevTools();
    }
  });

  win.webContents.on('render-process-gone', () => {
    win.reload();
  });

  const indexHtml = findIndexHtml();

  if (!indexHtml) {
    showStartupError(
      win,
      `Не найден файл интерфейса index.html.\n\nПроверенные пути:\n${getIndexCandidates().join('\n')}`,
    );
    return win;
  }

  win.loadFile(indexHtml).catch((error) => {
    showStartupError(win, error instanceof Error ? error.stack || error.message : String(error));
  });

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    if (validatedURL && validatedURL.startsWith('data:')) return;
    showStartupError(win, `Ошибка загрузки (${errorCode}): ${errorDescription}\n${validatedURL}`);
  });

  return win;
}

function setupAutoUpdates() {
  if (!app.isPackaged) return;

  autoUpdater.channel = UPDATE_CHANNEL;
  // Не запускаем фоновую проверку и загрузку автоматически. В Windows
  // системное окно electron-updater может оказаться за главным окном и
  // полностью перехватить мышь. Проверка остаётся доступна вручную в меню.
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('error', () => {
    // Ошибки обновления не должны мешать работе калькулятора.
  });

  autoUpdater.on('update-available', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    dialog
      .showMessageBox(mainWindow, {
        type: 'info',
        title: 'Доступно обновление',
        message: 'Доступна новая версия SARO системы обогрева.',
        detail: 'Загрузить обновление сейчас?',
        buttons: ['Загрузить', 'Позже'],
        defaultId: 1,
        cancelId: 1,
        noLink: true,
      })
      .then((result) => {
        if (result.response === 0) {
          return autoUpdater.downloadUpdate();
        }
        return undefined;
      })
      .catch(() => {});
  });

  autoUpdater.on('update-downloaded', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    dialog
      .showMessageBox(mainWindow, {
        type: 'info',
        title: 'Обновление готово',
        message: 'Обновление загружено.',
        detail: 'Установить его сейчас?',
        buttons: ['Установить сейчас', 'Позже'],
        defaultId: 1,
        cancelId: 1,
        noLink: true,
      })
      .then((result) => {
        if (result.response === 0) autoUpdater.quitAndInstall();
      })
      .catch(() => {});
  });
}

app.whenReady().then(() => {
  createWindow();
  setupAutoUpdates();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

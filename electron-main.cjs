const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const https = require('https');
const crypto = require('crypto');

const APP_NAME = 'SARO системы обогрева';
const RELEASE_DATE = '18.09.2026';
const UPDATE_CHANNEL = 'latest-roof';

// Калькулятору не требуется WebGL. На части компьютеров GPU-процесс Chromium
// зависал после запуска установленного приложения и блокировал весь ввод.
// Используем стабильный программный рендеринг; 2D-схемы и расчёты сохраняются.
app.disableHardwareAcceleration();

// Автообновление напрямую из релизов GitHub: части установщика скачиваются
// и склеиваются автоматически, пользователю не нужно ничего собирать вручную.
const GITHUB_OWNER = 'fumidumi';
const GITHUB_REPO = 'saro-calculators';

let mainWindow = null;
let githubUpdateBusy = false;
let localStaticServer = null;
let localStaticBaseUrl = null;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showAppMessage(parent, options) {
  return new Promise((resolve) => {
    const buttons = options.buttons && options.buttons.length ? options.buttons : ['OK'];
    const cancelId = Number.isInteger(options.cancelId) ? options.cancelId : buttons.length - 1;
    const messageWindow = new BrowserWindow({
      width: 520,
      height: 300,
      minWidth: 440,
      minHeight: 240,
      show: false,
      parent: parent && !parent.isDestroyed() ? parent : undefined,
      modal: false,
      minimizable: false,
      maximizable: false,
      resizable: false,
      title: options.title || APP_NAME,
      backgroundColor: '#f8fafc',
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    let settled = false;
    const finish = (response) => {
      if (settled) return;
      settled = true;
      resolve({ response });
      if (!messageWindow.isDestroyed()) messageWindow.close();
    };

    const buttonHtml = buttons
      .map(
        (label, index) =>
          `<a class="button${index === options.defaultId ? ' primary' : ''}" href="saro-dialog://choice/${index}">${escapeHtml(label)}</a>`,
      )
      .join('');
    const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <style>
        *{box-sizing:border-box}body{margin:0;font-family:Segoe UI,Arial,sans-serif;background:#f8fafc;color:#172033;padding:28px;line-height:1.45}
        h1{font-size:20px;margin:0 0 14px}p{font-size:14px;margin:0 0 10px;white-space:pre-wrap}.detail{color:#526071}
        .actions{display:flex;justify-content:flex-end;gap:10px;margin-top:26px}.button{display:inline-flex;align-items:center;justify-content:center;min-height:38px;padding:8px 16px;border:1px solid #b9c2ce;border-radius:6px;color:#172033;text-decoration:none;background:#fff;font-weight:600}.button.primary{background:#c92f32;border-color:#c92f32;color:#fff}
      </style></head><body><h1>${escapeHtml(options.message || options.title || APP_NAME)}</h1>
      ${options.detail ? `<p class="detail">${escapeHtml(options.detail)}</p>` : ''}<div class="actions">${buttonHtml}</div></body></html>`;

    messageWindow.webContents.on('will-navigate', (event, url) => {
      if (!url.startsWith('saro-dialog://choice/')) return;
      event.preventDefault();
      const response = Number.parseInt(url.slice('saro-dialog://choice/'.length), 10);
      finish(Number.isInteger(response) ? response : cancelId);
    });
    messageWindow.on('closed', () => finish(cancelId));
    messageWindow.once('ready-to-show', () => {
      messageWindow.show();
      messageWindow.focus();
    });
    messageWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  });
}

function httpsGet(url, options = {}) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: {
          'User-Agent': 'SARO-Updater',
          Accept: options.accept || 'application/vnd.github+json',
        },
      },
      (response) => {
        const status = response.statusCode || 0;
        if (status >= 300 && status < 400 && response.headers.location) {
          response.resume();
          resolve(httpsGet(response.headers.location, options));
          return;
        }
        if (status !== 200) {
          response.resume();
          reject(new Error(`Сервер вернул код ${status} для ${url}`));
          return;
        }
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => resolve(Buffer.concat(chunks)));
        response.on('error', reject);
      },
    );
    request.on('error', reject);
    request.setTimeout(120000, () => request.destroy(new Error('Превышено время ожидания сервера')));
  });
}

function compareVersions(a, b) {
  const pa = String(a).replace(/^v/, '').split('.').map((x) => parseInt(x, 10) || 0);
  const pb = String(b).replace(/^v/, '').split('.').map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

async function updateFromGithub(win) {
  if (githubUpdateBusy) return;
  githubUpdateBusy = true;

  try {
    const releasesRaw = await httpsGet(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases?per_page=20`,
    );
    const releases = JSON.parse(releasesRaw.toString('utf8'));

    let found = null;
    for (const release of releases) {
      if (release.draft) continue;
      const assets = release.assets || [];
      const manifest = assets.find((a) => /\.parts\.json$/i.test(a.name));
      const parts = assets
        .filter((a) => /\.part\d+$/i.test(a.name))
        .sort((x, y) => x.name.localeCompare(y.name));
      if (manifest && parts.length) {
        found = { release, manifest, parts };
        break;
      }
    }

    if (!found) {
      await showAppMessage(win, {
        type: 'info',
        title: 'Обновление с GitHub',
        message: 'Готовых сборок не найдено.',
        detail: 'Попробуйте позже — новая версия ещё собирается.',
      });
      return;
    }

    const manifestJson = JSON.parse((await httpsGet(found.manifest.browser_download_url, { accept: '*/*' })).toString('utf8'));
    const versionMatch = /(\d+\.\d+\.\d+)/.exec(manifestJson.file || '');
    const remoteVersion = versionMatch ? versionMatch[1] : null;
    const currentVersion = app.getVersion();

    if (remoteVersion && compareVersions(remoteVersion, currentVersion) <= 0) {
      const same = await showAppMessage(win, {
        type: 'info',
        title: 'Обновление с GitHub',
        message: `У вас уже установлена версия ${currentVersion}.`,
        detail: `На GitHub доступна версия ${remoteVersion}. Скачать и переустановить всё равно?`,
        buttons: ['Скачать', 'Отмена'],
        defaultId: 1,
        cancelId: 1,
        noLink: true,
      });
      if (same.response !== 0) return;
    } else {
      const confirm = await showAppMessage(win, {
        type: 'info',
        title: 'Доступна новая версия',
        message: `Доступна версия ${remoteVersion || 'новее текущей'}.`,
        detail: `Текущая версия: ${currentVersion}.\nСкачать ${found.parts.length} частей (${Math.round((manifestJson.totalBytes || 0) / 1048576)} МБ) и запустить установку?`,
        buttons: ['Скачать и установить', 'Отмена'],
        defaultId: 0,
        cancelId: 1,
        noLink: true,
      });
      if (confirm.response !== 0) return;
    }

    const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'saro-update-'));
    const installerPath = path.join(targetDir, manifestJson.file || 'SARO-Setup.exe');
    const output = fs.createWriteStream(installerPath);
    const hash = crypto.createHash('sha256');

    for (let i = 0; i < found.parts.length; i += 1) {
      const part = found.parts[i];
      if (win && !win.isDestroyed()) {
        win.setProgressBar((i + 1) / found.parts.length);
        win.setTitle(`${APP_NAME} — загрузка обновления ${i + 1}/${found.parts.length}`);
      }
      const data = await httpsGet(part.browser_download_url, { accept: '*/*' });
      hash.update(data);
      output.write(data);
    }

    await new Promise((resolve, reject) => {
      output.end(resolve);
      output.on('error', reject);
    });

    if (win && !win.isDestroyed()) {
      win.setProgressBar(-1);
      win.setTitle(`${APP_NAME} v${app.getVersion()}`);
    }

    const checksum = hash.digest('hex');
    if (manifestJson.sha256 && checksum !== manifestJson.sha256) {
      await showAppMessage(win, {
        type: 'error',
        title: 'Обновление с GitHub',
        message: 'Файл обновления повреждён при загрузке.',
        detail: 'Контрольная сумма не совпала. Попробуйте обновиться ещё раз.',
      });
      return;
    }

    const ready = await showAppMessage(win, {
      type: 'info',
      title: 'Обновление загружено',
      message: 'Установщик готов.',
      detail: 'Программа закроется и запустится установка новой версии.',
      buttons: ['Установить сейчас', 'Показать файл'],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    });

    if (ready.response === 0) {
      await shell.openPath(installerPath);
      setTimeout(() => app.quit(), 1500);
    } else {
      shell.showItemInFolder(installerPath);
    }
  } catch (error) {
    if (win && !win.isDestroyed()) {
      win.setProgressBar(-1);
      win.setTitle(`${APP_NAME} v${app.getVersion()}`);
    }
    await showAppMessage(win, {
      type: 'error',
      title: 'Обновление с GitHub',
      message: 'Не удалось загрузить обновление.',
      detail: error instanceof Error ? error.message : String(error),
    });
  } finally {
    githubUpdateBusy = false;
  }
}

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

const STATIC_MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

// Статический интерфейс отдаём через закрытый localhost вместо file://.
// Так настольная версия работает в том же браузерном режиме, что и рабочая
// веб-демоверсия, но остаётся полностью автономной и не использует интернет.
function startLocalStaticServer(indexHtml) {
  if (localStaticBaseUrl) return Promise.resolve(localStaticBaseUrl);

  const webRoot = path.dirname(indexHtml);
  const rootPrefix = `${path.resolve(webRoot)}${path.sep}`;

  return new Promise((resolve, reject) => {
    const server = http.createServer((request, response) => {
      try {
        const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');
        let relativePath = decodeURIComponent(requestUrl.pathname).replace(/^\/+/, '');
        if (!relativePath) relativePath = 'index.html';

        const requestedPath = path.resolve(webRoot, relativePath);
        if (requestedPath !== path.resolve(indexHtml) && !requestedPath.startsWith(rootPrefix)) {
          response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
          response.end('Forbidden');
          return;
        }

        fs.readFile(requestedPath, (error, data) => {
          if (error) {
            response.writeHead(error.code === 'ENOENT' ? 404 : 500, {
              'Content-Type': 'text/plain; charset=utf-8',
            });
            response.end(error.code === 'ENOENT' ? 'Not found' : 'Read error');
            return;
          }

          const contentType = STATIC_MIME_TYPES[path.extname(requestedPath).toLowerCase()] || 'application/octet-stream';
          response.writeHead(200, {
            'Content-Type': contentType,
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
          });
          response.end(data);
        });
      } catch (error) {
        response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end(error instanceof Error ? error.message : 'Bad request');
      }
    });

    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Не удалось определить локальный адрес интерфейса'));
        return;
      }
      localStaticServer = server;
      localStaticBaseUrl = `http://127.0.0.1:${address.port}`;
      resolve(localStaticBaseUrl);
    });
  });
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
            showAppMessage(win, {
              type: 'info',
              title: 'О программе',
              message: APP_NAME,
              detail: `Версия: ${version}\nДата релиза: ${RELEASE_DATE}\nКанал обновлений: ${UPDATE_CHANNEL}\n\nКалькулятор систем обогрева SARO.`,
            });
          },
        },
        {
          label: 'Обновить с GitHub',
          click: () => {
            updateFromGithub(win);
          },
        },
        {
          label: 'Открыть страницу релизов',
          click: () => {
            shell.openExternal(`https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases`);
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

  // Не даём HTML-странице скрыть номер установленной версии в заголовке окна.
  // Это также позволяет сразу отличить новую копию приложения от старой.
  win.webContents.on('page-title-updated', (event) => {
    event.preventDefault();
    win.setTitle(`${APP_NAME} v${app.getVersion()}`);
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

  const loadPromise = startLocalStaticServer(indexHtml).then((baseUrl) => win.loadURL(`${baseUrl}/index.html`));

  if (process.env.SARO_PACKAGED_SMOKE === '1') {
    loadPromise
      .then(() => require('./scripts/packaged-smoke.cjs').runPackagedSmoke(win))
      .catch((error) => {
        console.error('SARO_PACKAGED_SMOKE_FAILED', error);
        app.exit(1);
      });
  }

  loadPromise.catch((error) => {
    showStartupError(win, error instanceof Error ? error.stack || error.message : String(error));
  });

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    if (validatedURL && validatedURL.startsWith('data:')) return;
    showStartupError(win, `Ошибка загрузки (${errorCode}): ${errorDescription}\n${validatedURL}`);
  });

  return win;
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
}

app.whenReady().then(() => {
  if (!hasSingleInstanceLock) return;
  createWindow();

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

app.on('before-quit', () => {
  if (localStaticServer) {
    localStaticServer.close();
    localStaticServer = null;
    localStaticBaseUrl = null;
  }
});

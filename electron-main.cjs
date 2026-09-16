const { app, BrowserWindow, Menu, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { URL } = require('url');

const APP_NAME = 'SARO системы обогрева';
const RELEASE_DATE = '16.05.2026';
const UPDATE_CHANNEL = 'latest-roof';
const MAX_SCAN_FILES = 10000;

let localServer;

function pathExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function getResourceCandidates(...parts) {
  return [
    path.join(process.resourcesPath || '', ...parts),
    path.join(__dirname, ...parts),
    path.join(process.resourcesPath || '', 'app.asar', ...parts),
  ];
}

function walkFiles(rootDir, limit = MAX_SCAN_FILES) {
  const result = [];
  const stack = [rootDir];

  while (stack.length && result.length < limit) {
    const current = stack.pop();
    if (!current || !pathExists(current)) continue;

    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile()) {
        result.push(fullPath);
        if (result.length >= limit) break;
      }
    }
  }

  return result;
}

function findByRecursiveNames(rootDirs, names) {
  for (const rootDir of rootDirs) {
    if (!pathExists(rootDir)) continue;
    const files = walkFiles(rootDir);
    const found = files.find((filePath) => names.includes(path.basename(filePath).toLowerCase()));
    if (found) return found;
  }

  return null;
}

function findOutputServerEntry() {
  const exactCandidates = [
    ...getResourceCandidates('electron-output', 'public', 'server', 'index.js'),
    ...getResourceCandidates('electron-output', 'public', 'server', 'index.mjs'),
    ...getResourceCandidates('electron-output', 'server', 'index.mjs'),
    ...getResourceCandidates('electron-output', 'server', 'index.js'),
    ...getResourceCandidates('electron-output', 'index.mjs'),
    ...getResourceCandidates('electron-output', 'index.js'),
    ...getResourceCandidates('.output', 'public', 'server', 'index.js'),
    ...getResourceCandidates('.output', 'server', 'index.mjs'),
    ...getResourceCandidates('.output', 'server', 'index.js'),
  ];

  const exact = exactCandidates.find(pathExists);
  if (exact) return exact;

  const roots = getResourceCandidates('electron-output').concat(getResourceCandidates('.output'));
  return findByRecursiveNames(roots, [
    'index.mjs',
    'index.js',
    'server.mjs',
    'server.js',
    'worker.mjs',
    'worker.js',
  ]);
}

function findStaticIndexHtml() {
  const exactCandidates = [
    ...getResourceCandidates('electron-output', 'public', 'index.html'),
    ...getResourceCandidates('electron-output', 'public', 'client', 'index.html'),
    ...getResourceCandidates('electron-output', 'index.html'),
    ...getResourceCandidates('dist', 'index.html'),
    ...getResourceCandidates('.output', 'public', 'index.html'),
    ...getResourceCandidates('.output', 'public', 'client', 'index.html'),
  ];

  const exact = exactCandidates.find(pathExists);
  if (exact) return exact;

  const roots = getResourceCandidates('electron-output').concat(getResourceCandidates('dist'), getResourceCandidates('.output'));
  return findByRecursiveNames(roots, ['index.html']);
}

function findElectronOutputRoot() {
  return getResourceCandidates('electron-output').find(pathExists) || null;
}

function findElectronOutputRootFromIndex(indexHtmlPath) {
  const existing = findElectronOutputRoot();
  if (existing) return existing;

  let current = path.dirname(indexHtmlPath);
  while (current && current !== path.dirname(current)) {
    if (path.basename(current) === 'electron-output') return current;
    current = path.dirname(current);
  }

  return path.dirname(indexHtmlPath);
}

function getDiagnosticPaths() {
  const roots = getResourceCandidates('electron-output');
  const lines = [];

  for (const root of roots) {
    lines.push(`${pathExists(root) ? 'OK ' : 'NO '} ${root}`);
    if (pathExists(root)) {
      const files = walkFiles(root, 120);
      for (const file of files) {
        lines.push(`   - ${file}`);
      }
    }
  }

  return lines.join('\n');
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.map': 'application/json; charset=utf-8',
  };

  return types[ext] || 'application/octet-stream';
}

function tryResolveUnderRoot(rootDir, requestPath) {
  const decodedPath = decodeURIComponent(requestPath.split('?')[0]);
  const normalizedPath = decodedPath === '/' ? '/index.html' : decodedPath;
  const candidate = path.normalize(path.join(rootDir, normalizedPath));

  if (!candidate.startsWith(rootDir)) return null;
  if (pathExists(candidate) && fs.statSync(candidate).isFile()) return candidate;
  return null;
}

function findAssetBySuffix(rootDir, requestPath) {
  const decodedPath = decodeURIComponent(requestPath.split('?')[0]);
  const cleanRequest = decodedPath.replace(/^\/+/, '').replace(/\\/g, '/');
  const requestBaseName = path.basename(cleanRequest).toLowerCase();

  if (!requestBaseName || requestBaseName === '/' || requestBaseName === 'index.html') return null;

  const files = walkFiles(rootDir);
  const bySuffix = files.find((filePath) => filePath.replace(/\\/g, '/').endsWith(cleanRequest));
  if (bySuffix) return bySuffix;

  const byBaseName = files.find((filePath) => path.basename(filePath).toLowerCase() === requestBaseName);
  if (byBaseName) return byBaseName;

  return null;
}

function resolveStaticAssetFromOutput(requestPath) {
  const outputRoot = findElectronOutputRoot();
  if (!outputRoot) return null;

  const roots = [
    path.join(outputRoot, 'public', 'client'),
    path.join(outputRoot, 'public'),
    outputRoot,
  ];

  for (const root of roots) {
    if (!pathExists(root)) continue;
    const direct = tryResolveUnderRoot(root, requestPath);
    if (direct) return direct;
  }

  return findAssetBySuffix(outputRoot, requestPath);
}

function resolveStaticFile(indexHtmlPath, requestPath) {
  const staticRoot = path.dirname(indexHtmlPath);
  const outputRoot = findElectronOutputRootFromIndex(indexHtmlPath);

  return (
    tryResolveUnderRoot(staticRoot, requestPath) ||
    tryResolveUnderRoot(outputRoot, requestPath) ||
    findAssetBySuffix(outputRoot, requestPath)
  );
}

function requestLooksLikeAsset(requestPath) {
  return Boolean(path.extname(requestPath.split('?')[0] || ''));
}

function serveFile(filePath, res) {
  res.statusCode = 200;
  res.setHeader('content-type', getMimeType(filePath));
  fs.createReadStream(filePath).pipe(res);
}

async function startStaticServer(indexHtmlPath) {
  localServer = http.createServer((req, res) => {
    try {
      const parsedUrl = new URL(req.url || '/', 'http://127.0.0.1');
      const filePath = resolveStaticFile(indexHtmlPath, parsedUrl.pathname);

      if (!filePath && requestLooksLikeAsset(parsedUrl.pathname)) {
        res.statusCode = 404;
        res.setHeader('content-type', 'text/plain; charset=utf-8');
        res.end(`Not found: ${parsedUrl.pathname}\n\n${getDiagnosticPaths()}`);
        return;
      }

      serveFile(filePath || indexHtmlPath, res);
    } catch (error) {
      console.error(error);
      res.statusCode = 500;
      res.setHeader('content-type', 'text/plain; charset=utf-8');
      res.end(error instanceof Error ? error.stack || error.message : String(error));
    }
  });

  await new Promise((resolve, reject) => {
    localServer.once('error', reject);
    localServer.listen(0, '127.0.0.1', resolve);
  });

  const address = localServer.address();
  const port = typeof address === 'object' && address ? address.port : 0;

  if (!port) {
    throw new Error('Не удалось запустить локальный статический сервер приложения.');
  }

  return `http://127.0.0.1:${port}/`;
}

function nodeRequestToWebRequest(req, port) {
  const requestUrl = `http://127.0.0.1:${port}${req.url || '/'}`;
  const headers = new Headers();

  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      value.forEach((item) => headers.append(key, item));
    } else if (value !== undefined) {
      headers.set(key, String(value));
    }
  }

  const method = req.method || 'GET';
  const hasBody = !['GET', 'HEAD'].includes(method.toUpperCase());

  return new Request(requestUrl, {
    method,
    headers,
    body: hasBody ? req : undefined,
    duplex: hasBody ? 'half' : undefined,
  });
}

async function writeWebResponseToNode(response, res) {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });

  if (!response.body) {
    res.end();
    return;
  }

  const arrayBuffer = await response.arrayBuffer();
  res.end(Buffer.from(arrayBuffer));
}

async function startTanStackServer() {
  const serverEntryPath = findOutputServerEntry();

  if (!serverEntryPath) {
    return null;
  }

  const serverModule = await import(`file://${serverEntryPath.replace(/\\/g, '/')}`);
  const handler = serverModule.default || serverModule;

  if (!handler || typeof handler.fetch !== 'function') {
    return null;
  }

  localServer = http.createServer(async (req, res) => {
    try {
      const parsedUrl = new URL(req.url || '/', 'http://127.0.0.1');

      if (requestLooksLikeAsset(parsedUrl.pathname)) {
        const assetPath = resolveStaticAssetFromOutput(parsedUrl.pathname);
        if (assetPath) {
          serveFile(assetPath, res);
          return;
        }
      }

      const address = localServer.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      const webRequest = nodeRequestToWebRequest(req, port);
      const webResponse = await handler.fetch(webRequest, {}, {});
      await writeWebResponseToNode(webResponse, res);
    } catch (error) {
      console.error(error);
      res.statusCode = 500;
      res.setHeader('content-type', 'text/plain; charset=utf-8');
      res.end(error instanceof Error ? error.stack || error.message : String(error));
    }
  });

  await new Promise((resolve, reject) => {
    localServer.once('error', reject);
    localServer.listen(0, '127.0.0.1', resolve);
  });

  const address = localServer.address();
  const port = typeof address === 'object' && address ? address.port : 0;

  if (!port) {
    throw new Error('Не удалось запустить локальный сервер приложения.');
  }

  return `http://127.0.0.1:${port}/`;
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
        { type: 'separator' },
        { label: 'Выход', role: 'quit' },
      ],
    },
    {
      label: 'Вид',
      submenu: [
        { label: 'Обновить', role: 'reload' },
        { label: 'Полный экран', role: 'togglefullscreen' },
        { type: 'separator' },
        { label: 'Масштаб +', role: 'zoomin' },
        { label: 'Масштаб -', role: 'zoomout' },
        { label: 'Сбросить масштаб', role: 'resetzoom' },
      ],
    },
  ]);

  Menu.setApplicationMenu(menu);
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 1100,
    minHeight: 760,
    title: `${APP_NAME} v${app.getVersion()}`,
    backgroundColor: '#f8fafc',
    autoHideMenuBar: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  createMenu(win);

  try {
    const localUrl = await startTanStackServer();

    if (localUrl) {
      await win.loadURL(localUrl);
      return win;
    }

    const indexHtml = findStaticIndexHtml();
    if (!indexHtml) {
      throw new Error(`Не найден входной файл приложения.\n\nПроверенные папки и файлы:\n${getDiagnosticPaths()}`);
    }

    const staticUrl = await startStaticServer(indexHtml);
    await win.loadURL(staticUrl);
  } catch (error) {
    dialog.showErrorBox('Ошибка запуска', error instanceof Error ? error.message : String(error));
  }

  if (!app.isPackaged) {
    win.webContents.openDevTools({ mode: 'detach' });
  }

  return win;
}

function setupAutoUpdates() {
  if (!app.isPackaged) return;

  autoUpdater.channel = UPDATE_CHANNEL;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('error', () => {
    // Ошибки обновления не должны мешать работе калькулятора.
  });

  autoUpdater.on('update-downloaded', () => {
    dialog
      .showMessageBox({
        type: 'info',
        title: 'Обновление готово',
        message: 'Загружена новая версия SARO системы обогрева.',
        detail: 'Перезапустить приложение и установить обновление сейчас?',
        buttons: ['Установить сейчас', 'Позже'],
        defaultId: 0,
        cancelId: 1,
      })
      .then((result) => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall();
        }
      });
  });

  autoUpdater.checkForUpdates().catch(() => {
    // Тихий режим: если сервер обновлений недоступен, приложение просто работает дальше.
  });
}

app.whenReady().then(async () => {
  await createWindow();
  setupAutoUpdates();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (localServer) {
      localServer.close();
    }
    app.quit();
  }
});

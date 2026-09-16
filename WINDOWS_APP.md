# Windows-приложение SARO системы обогрева

Эта ветка добавляет Electron-обвязку для сборки калькулятора в установщик Windows.

## Что добавлено

- `electron-main.cjs` - главный процесс Electron.
- `package.json` - добавлены `electron`, `electron-builder`, `electron-updater` и команды сборки.
- `vite.config.ts` - добавлен `base: "./"`, чтобы ассеты открывались из `file://` внутри Windows-приложения.
- Автообновления настроены через generic provider:
  `https://saromat.ru/saro-updates/`
- Для этого приложения используется отдельный канал обновлений:
  `latest-roof`
- Updater будет смотреть на файл:
  `https://saromat.ru/saro-updates/latest-roof.yml`

## Локальный запуск на Windows

В папке проекта:

```bash
npm install
npm run electron
```

Команда сначала соберёт веб-приложение, потом откроет его в Electron.

## Сборка установщика Windows

```bash
npm run dist:win
```

После сборки файлы появятся в папке:

```text
release/
```

Обычно нужны файлы:

```text
SARO-Roof-1.0.0-Setup.exe
SARO-Roof-1.0.0-Setup.exe.blockmap
latest-roof.yml
```

## Публикация обновления на VPS

Загрузи в папку обновлений на сервере:

```text
/var/www/saromat/saro-updates/
```

или в ту фактическую папку, которая отдаётся по адресу:

```text
https://saromat.ru/saro-updates/
```

Нужно загрузить минимум:

```text
latest-roof.yml
SARO-Roof-1.0.0-Setup.exe
SARO-Roof-1.0.0-Setup.exe.blockmap
```

Важно: `latest.yml` оставляем для другого приложения. Для этого калькулятора используем только `latest-roof.yml`.

## Как выпустить новую версию

1. Увеличить версию в `package.json`, например:

```json
"version": "1.0.1"
```

2. При необходимости изменить дату релиза в `electron-main.cjs`:

```js
const RELEASE_DATE = '16.05.2026';
```

3. Собрать установщик:

```bash
npm run dist:win
```

4. Загрузить новые файлы из `release/` на сервер обновлений.

## Важный момент по TanStack Start

Проект Lovable собран на TanStack Start, поэтому Electron ищет `index.html` в нескольких местах:

- `dist/index.html`
- `.output/public/index.html`

Если после сборки приложение показывает ошибку, сначала проверь, где реально появился `index.html` после `npm run build`.

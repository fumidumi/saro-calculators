# Windows-установщик по частям

Объединённая программа (калькулятор кровли + калькулятор крыльца) собирается в один установщик Windows,
а затем автоматически режется на небольшие части, которые удобно скачивать и хранить в GitHub.

## Как получить части

1. Загрузите проект в GitHub (в Lovable: меню «+» → GitHub → Connect project).
2. В репозитории откройте вкладку **Actions** → workflow **Build Windows installer (parts)**.
3. Нажмите **Run workflow**. При желании укажите размер части в МБ (по умолчанию 45).
4. После сборки внизу страницы запуска скачайте артефакт **saro-windows-installer-parts**.

Внутри будут файлы:

```text
SARO-Roof-1.0.7-Setup.exe.part001
SARO-Roof-1.0.7-Setup.exe.part002
...
SARO-Roof-1.0.7-Setup.exe.parts.json
join-parts.bat
latest-roof.yml
```

## Как собрать части в один установщик

На Windows:

1. Положите все файлы `*.partNNN` и `join-parts.bat` в одну папку.
2. Запустите `join-parts.bat` двойным кликом.
3. Получится файл `SARO-Roof-1.0.7-Setup.exe`.
4. Скрипт покажет SHA256 — сверьте его со значением `sha256` в файле `*.parts.json`.

Вручную то же самое делается командой в этой папке:

```bat
copy /b SARO-Roof-1.0.7-Setup.exe.part* SARO-Roof-1.0.7-Setup.exe
```

## Как нарезать части локально

```bash
npm run build
npm run prepare:electron-output
npm run dist:win
node scripts/split-file.cjs release/SARO-Roof-1.0.7-Setup.exe release-parts 45
```

## Примечания

- Части нумеруются по порядку, склейка обязательна строго по возрастанию номеров.
- Обновления по-прежнему идут через канал `latest-roof` (см. `WINDOWS_APP.md`).
- Загрузка кода в GitHub выполняется из интерфейса Lovable; автоматическая сборка запустится сама после пуша в `main`.

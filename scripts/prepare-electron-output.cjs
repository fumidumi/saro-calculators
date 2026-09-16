const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const sourceDir = path.join(rootDir, '.output');
const targetDir = path.join(rootDir, 'electron-output');

if (!fs.existsSync(sourceDir)) {
  console.error('Не найдена папка .output после vite build. Нечего паковать в Electron.');
  process.exit(1);
}

fs.rmSync(targetDir, { recursive: true, force: true });
fs.cpSync(sourceDir, targetDir, { recursive: true });

const expectedServerEntry = path.join(targetDir, 'server', 'index.mjs');
const expectedPublicDir = path.join(targetDir, 'public');

console.log(`Copied ${sourceDir} -> ${targetDir}`);
console.log(`Server entry exists: ${fs.existsSync(expectedServerEntry)}`);
console.log(`Public dir exists: ${fs.existsSync(expectedPublicDir)}`);

if (!fs.existsSync(expectedServerEntry)) {
  console.warn('Внимание: electron-output/server/index.mjs не найден. Electron попробует статический fallback.');
}

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const targetDir = path.join(rootDir, 'electron-output');

const desktopDir = path.join(rootDir, 'dist-desktop');
const distDir = path.join(rootDir, 'dist');
const legacyDir = path.join(rootDir, '.output');

fs.rmSync(targetDir, { recursive: true, force: true });
fs.mkdirSync(targetDir, { recursive: true });

if (fs.existsSync(path.join(desktopDir, 'index.desktop.html')) || fs.existsSync(path.join(desktopDir, 'index.html'))) {
  // Настольная сборка: статический SPA.
  fs.cpSync(desktopDir, path.join(targetDir, 'public'), { recursive: true });

  const desktopIndex = path.join(targetDir, 'public', 'index.desktop.html');
  const finalIndex = path.join(targetDir, 'public', 'index.html');
  if (fs.existsSync(desktopIndex)) {
    fs.renameSync(desktopIndex, finalIndex);
  }

  console.log(`Copied ${desktopDir} -> ${targetDir}/public`);
  console.log(`Index exists: ${fs.existsSync(finalIndex)}`);
  process.exit(0);
}

if (fs.existsSync(path.join(distDir, 'server'))) {
  fs.cpSync(path.join(distDir, 'server'), path.join(targetDir, 'server'), { recursive: true });
  if (fs.existsSync(path.join(distDir, 'client'))) {
    fs.cpSync(path.join(distDir, 'client'), path.join(targetDir, 'public'), { recursive: true });
  }
  console.log(`Copied ${distDir} -> ${targetDir}`);
} else if (fs.existsSync(legacyDir)) {
  fs.cpSync(legacyDir, targetDir, { recursive: true });
  console.log(`Copied ${legacyDir} -> ${targetDir}`);
} else {
  console.error('Не найдена папка dist-desktop, dist или .output после сборки. Нечего паковать в Electron.');
  process.exit(1);
}

const serverEntry = path.join(targetDir, 'server', 'index.mjs');
console.log(`Server entry exists: ${fs.existsSync(serverEntry)}`);
console.log(`Public dir exists: ${fs.existsSync(path.join(targetDir, 'public'))}`);

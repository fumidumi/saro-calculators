// Разрезает большой файл на части фиксированного размера.
// Использование: node scripts/split-file.cjs <файл> <папка-назначения> [размерMB]

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const [, , sourceArg, targetArg, sizeArg] = process.argv;

if (!sourceArg || !targetArg) {
  console.error('Использование: node scripts/split-file.cjs <файл> <папка> [размерMB]');
  process.exit(1);
}

const sourcePath = path.resolve(sourceArg);
const targetDir = path.resolve(targetArg);
const chunkSize = Math.max(1, Number(sizeArg) || 45) * 1024 * 1024;

if (!fs.existsSync(sourcePath)) {
  console.error(`Файл не найден: ${sourcePath}`);
  process.exit(1);
}

fs.mkdirSync(targetDir, { recursive: true });

const baseName = path.basename(sourcePath);
const total = fs.statSync(sourcePath).size;
const partCount = Math.max(1, Math.ceil(total / chunkSize));
const fd = fs.openSync(sourcePath, 'r');
const buffer = Buffer.alloc(chunkSize);
const hash = crypto.createHash('sha256');
const parts = [];

for (let index = 0; index < partCount; index += 1) {
  const bytesRead = fs.readSync(fd, buffer, 0, chunkSize, index * chunkSize);
  const slice = buffer.subarray(0, bytesRead);
  const partName = `${baseName}.part${String(index + 1).padStart(3, '0')}`;

  fs.writeFileSync(path.join(targetDir, partName), slice);
  hash.update(slice);
  parts.push({ name: partName, bytes: bytesRead });
  console.log(`Создана часть ${partName} (${bytesRead} байт)`);
}

fs.closeSync(fd);

const manifest = {
  file: baseName,
  totalBytes: total,
  partCount,
  chunkBytes: chunkSize,
  sha256: hash.digest('hex'),
  parts,
};

fs.writeFileSync(path.join(targetDir, `${baseName}.parts.json`), JSON.stringify(manifest, null, 2), 'utf8');
console.log(`Готово: ${partCount} частей, sha256 = ${manifest.sha256}`);

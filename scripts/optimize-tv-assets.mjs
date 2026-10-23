import { execFileSync, spawnSync } from 'node:child_process';
import { readdir, rename, stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const dist = join(root, 'dist');
const assets = join(dist, 'assets');
const logo = join(root, 'assets', 'logo.jpg');
const temporarySuffix = '.tv-optimized.jpg';

const hasMagick = spawnSync('magick', ['-version'], { stdio: 'ignore' }).status === 0;
const hasConvert = spawnSync('convert', ['-version'], { stdio: 'ignore' }).status === 0;
const imageMagick = hasMagick ? 'magick' : hasConvert ? 'convert' : null;

if (!imageMagick) {
  console.warn('[TV assets] ImageMagick is missing. Install it to generate icon.png and optimize TV wallpapers.');
  process.exit(0);
}

async function optimizeImage(file) {
  const temporary = file + temporarySuffix;
  try {
    execFileSync(imageMagick, [
      file, '-auto-orient', '-resize', '1920x1080>', '-strip',
      '-sampling-factor', '4:2:0', '-quality', '82', temporary,
    ], { stdio: 'ignore' });
    const [original, optimized] = await Promise.all([stat(file), stat(temporary)]);
    if (optimized.size > 0 && optimized.size < original.size) {
      await rename(temporary, file);
      return original.size - optimized.size;
    }
    await unlink(temporary).catch(() => undefined);
  } catch {
    await unlink(temporary).catch(() => undefined);
  }
  return 0;
}

let savedBytes = 0;
let optimizedCount = 0;
for (const name of await readdir(assets)) {
  if (!/\.(jpe?g)$/i.test(name)) continue;
  const saved = await optimizeImage(join(assets, name));
  if (saved > 0) { optimizedCount += 1; savedBytes += saved; }
}

try {
  execFileSync(imageMagick, [
    logo, '-auto-orient', '-resize', '117x117^', '-gravity', 'center',
    '-extent', '117x117', '-strip', 'PNG32:' + join(dist, 'icon.png'),
  ], { stdio: 'ignore' });
  console.log('[TV assets] Generated dist/icon.png.');
} catch {
  console.warn('[TV assets] Could not generate dist/icon.png.');
}
console.log(`[TV assets] Optimized ${optimizedCount} JPEG(s), saved ${(savedBytes / 1024 / 1024).toFixed(2)} MiB.`);

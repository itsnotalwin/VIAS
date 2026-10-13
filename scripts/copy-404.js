import fs from 'node:fs';
import path from 'node:path';

const distIndex = path.resolve('dist/index.html');
const dist404 = path.resolve('dist/404.html');

if (fs.existsSync(distIndex)) {
  fs.copyFileSync(distIndex, dist404);
  console.log('✓ Copied dist/index.html to dist/404.html for GitHub Pages SPA routing');
}

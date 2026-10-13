import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve('dist');
const docsDir = path.resolve('docs');
const distIndex = path.join(distDir, 'index.html');
const dist404 = path.join(distDir, '404.html');

if (fs.existsSync(distIndex)) {
  // 1. Ensure dist/404.html exists for GitHub Pages client-side routing
  fs.copyFileSync(distIndex, dist404);
  console.log('✓ Copied dist/index.html to dist/404.html for GitHub Pages SPA routing');

  // 2. Ensure .nojekyll in dist
  const nojekyllPath = path.join(distDir, '.nojekyll');
  if (!fs.existsSync(nojekyllPath)) {
    fs.writeFileSync(nojekyllPath, '');
    console.log('✓ Created dist/.nojekyll');
  }

  // 3. Mirror production bundle to docs/ folder so GitHub Pages "Deploy from branch (/docs)" works seamlessly
  if (fs.existsSync(docsDir)) {
    fs.rmSync(docsDir, { recursive: true, force: true });
  }
  fs.cpSync(distDir, docsDir, { recursive: true });

  // Remove server.cjs from docs if present since docs is client-only static hosting
  const docsServer = path.join(docsDir, 'server.cjs');
  if (fs.existsSync(docsServer)) {
    fs.rmSync(docsServer, { force: true });
  }

  console.log('✓ Synchronized production static build to docs/ folder for branch-based GitHub Pages');
}

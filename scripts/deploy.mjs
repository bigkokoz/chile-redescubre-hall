// Publica el Hall en GitHub Pages con un solo comando:  npm run deploy
// Compila, y sube la carpeta dist a la rama gh-pages del repo (el sitio queda en https://bigkokoz.github.io/chile-redescubre-hall/).
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const REMOTE = 'https://github.com/bigkokoz/chile-redescubre-hall.git';
const run = (cmd, opts = {}) => execSync(cmd, { stdio: 'inherit', ...opts });

process.env.NO_SSL = '1';
run('npx vite build');
const dist = path.resolve('dist');
fs.rmSync(path.join(dist, '.git'), { recursive: true, force: true });
run('git init -q -b gh-pages', { cwd: dist });
run('git add -A', { cwd: dist });
run(`git commit -q -m "deploy ${new Date().toISOString().slice(0, 16)}"`, { cwd: dist });
run(`git push -q -f ${REMOTE} gh-pages`, { cwd: dist });
console.log('\nListo: https://bigkokoz.github.io/chile-redescubre-hall/ (Pages tarda 1-2 min en refrescar)');

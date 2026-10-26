import { readdir, readFile, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { GALLERY } from '../js/data/missions.js';
import { CREW } from '../js/data/crew.js';
const root = process.cwd();
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    if (['.git', '.openai', 'node_modules', '__pycache__'].includes(entry.name)) continue;
    const file = path.join(dir, entry.name); if (entry.isDirectory()) result.push(...await walk(file)); else result.push(file);
  } return result;
}
const files = await walk(root);
for (const file of files.filter(f => /\.(js|mjs)$/.test(f))) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) throw Error(result.stderr);
  const source = await readFile(file, 'utf8');
  for (const match of source.matchAll(/from ['"]([.][^'"]+)['"]/g)) await access(path.resolve(path.dirname(file), match[1].split('?')[0]));
}
const assets = [...new Set(['assets/rapscallion-command.webp', 'assets/academy-mark.svg', ...CREW.map(c => c.portrait), ...GALLERY.map(g => g.file)])];
for (const file of assets) await access(path.join(root, file));
const index = await readFile('index.html', 'utf8');
for (const match of index.matchAll(/(?:src|href)="((?:js|css|assets)\/[^"#]+)"/g)) await access(path.join(root, match[1].split('?')[0]));
process.stdout.write(`Syntax, module imports and ${assets.length} required art assets checked.\n`);

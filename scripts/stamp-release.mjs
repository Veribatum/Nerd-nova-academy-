// Keep buildless GitHub Pages module graphs consistent across cached releases.
import { readdir, readFile, writeFile } from 'node:fs/promises';
const version = JSON.parse(await readFile('package.json', 'utf8')).version;
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = `${directory}/${entry.name}`;
    if (entry.isDirectory()) await walk(file);
    else if (entry.name.endsWith('.js')) {
      const source = await readFile(file, 'utf8');
      const stamped = source.replace(/(from\s*['"])(\.{1,2}\/[^'"?]+)(?:\?v=[^'"]*)?(['"])/g, `$1$2?v=${version}$3`);
      if (source !== stamped) await writeFile(file, stamped);
    }
  }
}
await walk('js');
let index = await readFile('index.html', 'utf8');
index = index.replace(/(js\/app\.js|css\/academy\.css)(?:\?v=[^"']*)?/g, `$1?v=${version}`);
index = index.replace(/training\. v[0-9.]+/, `training. v${version}`);
await writeFile('index.html', index);
process.stdout.write(`Stamped complete module graph for release ${version}.\n`);

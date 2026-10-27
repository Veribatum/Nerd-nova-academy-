import { runCommand } from '../js/sim/engine.js';
import { editConfig } from '../js/sim/config.js';
export function saveRepair(s) {
  const path=s.config.path;
  s=runCommand(s, `sudo cp ${path} ${path}.bak`);
  s=runCommand(s, `sudo vim ${path}`);
  s=editConfig(s,'insert');
  s=editConfig(s,'input',s.config.editor.buffer.replace(s.id==='config-profile'?'192.0.2.11/30':'192.0.2.99',s.id==='config-profile'?'192.0.2.10/30':'192.0.2.42'));
  s=editConfig(s,'normal'); return editConfig(s,'ex',':wq');
}
export function solveConfig(s) {
  s=saveRepair(s); const p=s.config.path;
  s=runCommand(s,`sudo diff -u ${p}.bak ${p}`);
  if (s.id==='config-profile') { s=runCommand(s,'sudo nmcli connection reload'); s=runCommand(s,'sudo nmcli connection up "Academy Link"'); }
  if (s.id==='config-endpoint') s=runCommand(s,'sudo systemctl restart relay-watch');
  return s;
}

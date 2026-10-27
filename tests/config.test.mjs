import test from 'node:test';
import assert from 'node:assert/strict';
import { createSimulation, runCommand, verifySimulation, restoreSimulation } from '../js/sim/engine.js';
import { editConfig } from '../js/sim/config.js';
import { saveRepair, solveConfig } from './config-fixtures.mjs';
import { configEditor } from '../js/ui/config-editor.js';
test('Vim mode, readonly failure, E37 and discard preserve disk while a partial buffer survives reload',()=>{
  let s=createSimulation('config-hosts'); const original=s.config.disk;
  s=runCommand(s,'vim /etc/hosts'); s=editConfig(s,'input','unwanted'); assert.equal(s.config.editor.buffer,original);
  s=editConfig(s,'insert'); s=editConfig(s,'input','unsaved buffer');
  s=restoreSimulation(JSON.parse(JSON.stringify(s))); assert.equal(s.config.editor.mode,'insert'); assert.equal(s.config.editor.buffer,'unsaved buffer');
  s=editConfig(s,'normal'); s=editConfig(s,'ex',':q'); assert.match(s.config.editor.message,/E37/);
  s=editConfig(s,'ex',':wq'); assert.match(s.config.editor.message,/E45/); assert.equal(s.config.disk,original);
  s=editConfig(s,'ex',':q!'); assert.equal(s.config.editor,null); assert.equal(s.config.disk,original);
});
test('Vim write persists independently of quit and later discard; undo works on an Insert session',()=>{
  let s=runCommand(createSimulation('config-hosts'),'sudo vim /etc/hosts');
  s=editConfig(s,'insert'); s=editConfig(s,'input','first'); s=editConfig(s,'normal'); s=editConfig(s,'undo'); assert.match(s.config.editor.buffer,/127.0.0.1/);
  s=editConfig(s,'undo'); assert.equal(s.config.editor.buffer,'first'); s=editConfig(s,'ex',':w'); assert.equal(s.config.disk,'first');
  s=editConfig(s,'insert'); s=editConfig(s,'input','second'); s=editConfig(s,'normal'); s=editConfig(s,'ex',':q!'); assert.equal(s.config.disk,'first');
});
test('a corrected hosts entry still fails without an original backup, diff or preserved localhost',()=>{
  let s=saveRepair(createSimulation('config-hosts')); assert.equal(verifySimulation(s).passed,false);
  s=runCommand(s,'sudo diff -u /etc/hosts.bak /etc/hosts'); assert.equal(verifySimulation(s).passed,true);
  s=runCommand(s,'sudo cp /etc/hosts /etc/hosts.bak'); assert.equal(verifySimulation(s).passed,false);
  s=solveConfig(createSimulation('config-hosts')); s=runCommand(s,'sudo vim /etc/hosts'); s=editConfig(s,'insert');
  s=editConfig(s,'input','192.0.2.42 relay.rapscallion.test relay\n'); s=editConfig(s,'normal'); s=editConfig(s,'ex',':wq');
  s=runCommand(s,'sudo diff -u /etc/hosts.bak /etc/hosts'); assert.equal(verifySimulation(s).passed,false);
});
test('NetworkManager edit, reload and activation are three separate states and order matters',()=>{
  let s=saveRepair(createSimulation('config-profile')); const path=s.config.path;
  s=runCommand(s,`sudo diff -u ${path}.bak ${path}`);
  assert.equal(verifySimulation(s).passed,false);
  s=runCommand(s,'sudo nmcli connection up "Academy Link"'); assert.equal(verifySimulation(s).passed,false);
  s=runCommand(s,'sudo nmcli connection reload'); assert.equal(verifySimulation(s).passed,false);
  s=runCommand(s,'sudo nmcli connection up "Academy Link"'); assert.equal(verifySimulation(s).passed,true);
  assert.match(runCommand(s,'ip -br address').log.at(-1).output,/10.0.2.15\/24/);
});
test('malformed or management-bound keyfiles are rejected without changing active configuration',()=>{
  let s=createSimulation('config-profile'); const active=s.config.applied;
  s=runCommand(s,`sudo vim ${s.config.path}`); s=editConfig(s,'insert');
  s=editConfig(s,'input',s.config.editor.buffer.replace('interface-name=lab0','interface-name=enp0s3'));
  s=editConfig(s,'normal'); s=editConfig(s,'ex',':wq'); s=runCommand(s,'sudo nmcli connection reload');
  assert.match(s.log.at(-1).output,/invalid/); assert.equal(s.config.applied,active); assert.equal(s.config.loaded,active);
});
test('application endpoint requires restart and application health, not merely a running process',()=>{
  let s=runCommand(createSimulation('config-endpoint'),'sudo systemctl restart relay-watch');
  assert.equal(s.config.running,true); assert.equal(verifySimulation(s).passed,false);
  s=saveRepair(s); s=runCommand(s,'sudo diff -u /etc/rapscallion/relay.conf.bak /etc/rapscallion/relay.conf');
  assert.equal(verifySimulation(s).passed,false); s=runCommand(s,'sudo systemctl restart relay-watch'); assert.equal(verifySimulation(s).passed,true);
  s=runCommand(s,'sudo cp /etc/rapscallion/relay.conf.bak /etc/rapscallion/relay.conf'); assert.equal(verifySimulation(s).passed,false);
});
test('editor escapes file contents and arbitrary paths/shell commands never reach a real filesystem',()=>{
  let s=createSimulation('config-hosts'); s=runCommand(s,'sudo vim /etc/shadow'); assert.equal(s.config.editor,null);
  s=runCommand(s,'sudo vim /etc/hosts; anything'); assert.equal(s.config.editor,null);
  s=runCommand(s,'sudo vim /etc/hosts'); s=editConfig(s,'insert'); s=editConfig(s,'input','</textarea><script>alert(1)</script>');
  assert.ok(!configEditor(s).includes('<script>')); assert.match(configEditor(s),/&lt;script&gt;/);
});

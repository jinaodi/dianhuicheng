// Electron 探测：在 main.js 最早期就写日志，定位崩溃点
const fs = require('fs');
const path = require('path');
const LOG = path.join(__dirname, 'boot.log');
const log = (s) => fs.appendFileSync(LOG, new Date().toISOString() + ' ' + s + '\n');
log('boot start pid=' + process.pid + ' runAsNode=' + process.env.ELECTRON_RUN_AS_NODE);
try {
  const el = require('electron');
  log('electron module type=' + typeof el);
  log('has app=' + !!(el && el.app) + ' has BrowserWindow=' + !!(el && el.BrowserWindow));
} catch (e) {
  log('require electron failed: ' + e.message);
}
process.on('uncaughtException', (e) => { log('uncaught ' + e.stack); });
try { log('versions=' + JSON.stringify(process.versions)); } catch (e) { log('versions fail'); }
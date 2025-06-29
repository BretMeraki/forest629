#!/usr/bin/env node
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

process.env.FOREST_LOG_DIR = logDir;

async function main() {
  const serverModuleUrl = pathToFileURL(path.join(projectRoot, 'forest-server', 'server-modular.js')).href;
  const { CleanForestServer } = await import(serverModuleUrl);
  const server = new CleanForestServer();
  await server.initialize();
  const result = await server.toolRouter.dispatchTool('get_next_task', {
    context_from_memory: '',
    energy_level: 3,
    time_available: '30 minutes'
  });
  fs.writeFileSync(path.join(logDir, 'get_next_task.json'), JSON.stringify(result, null, 2));
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); }); 
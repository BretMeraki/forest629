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
  const result = await server.toolRouter.dispatchTool('create_project', {
    project_id: 'demo_project',
    goal: 'Demo goal',
    life_structure_preferences: { wake_time: '7:00 AM', sleep_time: '11:00 PM' }
  });
  fs.writeFileSync(path.join(logDir, 'create_project.json'), JSON.stringify(result, null, 2));
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); }); 
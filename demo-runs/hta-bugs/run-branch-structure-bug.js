#!/usr/bin/env node
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '../..');
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

const demoProjectDir = path.join(projectRoot, '.forest-data', 'projects', 'hta_bug_demo');
if (!fs.existsSync(demoProjectDir)) fs.mkdirSync(demoProjectDir, { recursive: true });

const htaPath = path.join(demoProjectDir, 'hta.json');
const htaData = {
  pathName: 'demo',
  goal: 'Test branch-task mapping',
  strategicBranches: [
    { id: 'branch_1', title: 'Foundation' },
    { id: 'branch_2', title: 'Application' }
  ],
  frontierNodes: [
    { id: 'task_1', title: 'Learn basics', branch: 'Foundation', completed: false },
    { id: 'task_2', title: 'Apply basics', branch: 'Application', completed: false }
  ],
  hierarchyMetadata: { total_tasks: 2, total_branches: 2, completed_tasks: 0 }
};
fs.writeFileSync(htaPath, JSON.stringify(htaData, null, 2));

process.env.FOREST_LOG_DIR = logDir;

async function main() {
  const serverModuleUrl = pathToFileURL(path.join(projectRoot, 'forest-server', 'server-modular.js')).href;
  const { CleanForestServer } = await import(serverModuleUrl);
  const server = new CleanForestServer();
  await server.initialize();
  // Simulate a status report or progress calculation
  const status = await server.toolRouter.dispatchTool('get_hta_status', { path_name: 'demo' });
  const logPath = path.join(logDir, 'branch-structure-bug.json');
  fs.writeFileSync(logPath, JSON.stringify(status, null, 2));
  console.log('\n[Branch Structure Bug Demo]');
  if (status && status.branches && status.branches.every(b => b.totalTasks === 0)) {
    console.log('BUG PRESENT: All branches show 0/0 tasks despite tasks existing.');
  } else {
    console.log('BUG FIXED: Branches correctly show task counts.');
  }
  console.log('See log:', logPath);
}
main(); 
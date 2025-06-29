#!/usr/bin/env node
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '../..');
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

const demoProjectDir = path.join(projectRoot, '.forest-data', 'projects', 'hta_bug_orphan_demo');
if (!fs.existsSync(demoProjectDir)) fs.mkdirSync(demoProjectDir, { recursive: true });

const htaPath = path.join(demoProjectDir, 'hta.json');
const htaData = {
  pathName: 'demo',
  goal: 'Test orphaned tasks',
  strategicBranches: [
    { id: 'branch_1', title: 'Foundation' },
    { id: 'branch_2', title: 'Application' }
  ],
  frontierNodes: [
    { id: 'task_1', title: 'Learn basics', branch: 'Foundation', completed: false },
    { id: 'task_2', title: 'Orphan task (bad branch)', branch: 'Nonexistent', completed: false },
    { id: 'task_3', title: 'Orphan task (no branch)', completed: false }
  ],
  hierarchyMetadata: { total_tasks: 3, total_branches: 2, completed_tasks: 0 }
};
fs.writeFileSync(htaPath, JSON.stringify(htaData, null, 2));

process.env.FOREST_LOG_DIR = logDir;

async function main() {
  const serverModuleUrl = pathToFileURL(path.join(projectRoot, 'forest-server', 'server-modular.js')).href;
  const { CleanForestServer } = await import(serverModuleUrl);
  const server = new CleanForestServer();
  await server.initialize();
  // Call get_hta_status directly
  const result = await server.toolRouter.dispatchTool('get_hta_status', { path_name: 'demo' });
  // Find orphaned tasks
  const branches = htaData.strategicBranches.map(b => b.title);
  const orphaned = (htaData.frontierNodes || []).filter(
    t => !t.branch || !branches.includes(t.branch)
  );
  const logPath = path.join(logDir, 'task-branch-disconnect-bug.json');
  const summary = {
    hta_status: result,
    orphaned_tasks: orphaned,
    bug_present: orphaned.length > 0
  };
  fs.writeFileSync(logPath, JSON.stringify(summary, null, 2));

  console.log('\n[Task-Branch Disconnection Bug Demo]');
  if (orphaned.length > 0) {
    console.log('BUG PRESENT: Orphaned tasks detected:', orphaned.map(t => t.title));
  } else {
    console.log('BUG FIXED: All tasks are mapped to branches.');
  }
  console.log('See log:', logPath);
}
main(); 
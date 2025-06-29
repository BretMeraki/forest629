#!/usr/bin/env node
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '../..');
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

// Use a unique log file for this run
const runId = `contextguard-selfheal-${Date.now()}`;
const logFile = path.join(logDir, `${runId}.log`);
process.env.FOREST_LOG_FILE = logFile;
process.env.FOREST_LOG_DIR = logDir;

async function main() {
  const serverModuleUrl = pathToFileURL(path.join(projectRoot, 'forest-server', 'server-modular.js')).href;
  const { CleanForestServer } = await import(serverModuleUrl);
  const server = new CleanForestServer();
  await server.initialize();
  // Call get_hta_status directly
  const result = await server.toolRouter.dispatchTool('get_hta_status', {});
  // Wait a moment to ensure logs are flushed
  await new Promise(r => setTimeout(r, 200));
  // Read the unique log file
  let logContent = '';
  if (fs.existsSync(logFile)) {
    logContent = fs.readFileSync(logFile, 'utf-8');
  }
  // Check for warnings in log and result
  const contextguard_warning = logContent.includes('ContextGuard mismatch');
  const selfheal_warning = logContent.includes('SelfHealManager');
  const health_field = result && result.health ? result.health : null;
  const bug_present = contextguard_warning || selfheal_warning || (health_field && health_field !== 'healthy');
  const summary = {
    hta_status: result,
    contextguard_warning,
    selfheal_warning,
    health_field,
    log_excerpt: logContent.slice(-2000)
  };
  const logPath = path.join(logDir, 'contextguard-selfheal-bug.json');
  fs.writeFileSync(logPath, JSON.stringify(summary, null, 2));

  console.log('\n[ContextGuard/SelfHeal Bug Demo]');
  if (bug_present) {
    console.log('BUG PRESENT: ContextGuard or SelfHeal warnings detected, or health not healthy.');
  } else {
    console.log('BUG FIXED: No ContextGuard or SelfHeal warnings, and health is healthy.');
  }
  console.log('See log:', logPath);
}
main(); 
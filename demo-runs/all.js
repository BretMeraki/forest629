#!/usr/bin/env node
import { execSync } from 'child_process';
const scripts = [
  'run-build_hta_tree.js',
  'run-create_project.js',
  'run-get_next_task.js',
  'run-generate_daily_schedule.js'
];
for (const script of scripts) {
  console.log(`\n=== Running ${script} ===`);
  try {
    execSync(`node ${script}`, { stdio: 'inherit', cwd: __dirname });
  } catch (e) {
    console.error(`Error running ${script}:`, e.message);
  }
}
console.log('\nAll demo runs complete. Check demo-runs/logs/ for outputs.'); 
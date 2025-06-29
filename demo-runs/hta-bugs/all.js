#!/usr/bin/env node
import { execSync } from 'child_process';
const scripts = [
  'run-branch-structure-bug.js',
  'run-contextguard-selfheal-bug.js',
  'run-task-branch-disconnect.js'
  // Add more scripts here as you implement them
];
for (const script of scripts) {
  console.log(`\n=== Running ${script} ===`);
  try {
    execSync(`node ${script}`, { stdio: 'inherit', cwd: __dirname });
  } catch (e) {
    console.error(`Error running ${script}:`, e.message);
  }
}
console.log('\nAll HTA bug demo runs complete. Check demo-runs/hta-bugs/logs/ for outputs.'); 
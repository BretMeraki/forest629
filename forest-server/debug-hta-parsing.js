#!/usr/bin/env node
// Simple CLI utility to test the enhanced _parseTasksFromLLMResponse method
// Usage: node debug-hta-parsing.js <path to sample.txt>

import fs from 'fs';
import { CleanForestServer } from './server-modular.js';

async function main() {
  const [,, samplePath] = process.argv;
  if (!samplePath) {
    console.error('Usage: node debug-hta-parsing.js <sample-file>');
    process.exit(1);
  }

  if (!fs.existsSync(samplePath)) {
    console.error(`File not found: ${samplePath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(samplePath, 'utf8');
  const server = new CleanForestServer();
  // @ts-ignore access internal method
  const tasks = server['_parseTasksFromLLMResponse']({ content: [{ text: raw }] });
  if (tasks) {
    console.info(`✅ Parsed ${tasks.length} branch task objects`);
    console.info(JSON.stringify(tasks.slice(0, 2), null, 2));
  } else {
    console.error('❌ Failed to parse tasks from sample');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
}); 
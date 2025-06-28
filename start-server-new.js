#!/usr/bin/env node

/**
 * Forest MCP Server Entry Point
 *
 * This script starts the main Forest.os MCP server located in the forest-server directory.
 * All core functionality has been consolidated into the forest-server structure.
 */

console.error('DEBUG: start-server.js starting...');
console.error('DEBUG: Current working directory:', process.cwd());
console.error('DEBUG: Script location:', import.meta.url);

// Change to the forest-server directory to ensure relative paths work correctly
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const forestServerDir = join(__dirname, 'forest-server');

console.error('DEBUG: Changing to forest-server directory:', forestServerDir);
process.chdir(forestServerDir);
console.error('DEBUG: New working directory:', process.cwd());

import('./server-modular.js').then(module => {
  console.error('DEBUG: Module imported successfully');
  console.error('DEBUG: Available exports:', Object.keys(module));
  console.error('DEBUG: main function exists:', typeof module.main);
  
  // Explicitly call the main function since we're importing it
  console.error('Starting Forest MCP server via start-server.js...');
  if (module.main) {
    console.error('DEBUG: Calling main function...');
    return module.main();
  } else {
    throw new Error('Main function not found in server-modular.js');
  }
}).catch(error => {
  console.error('FATAL ERROR in start-server.js:', error.message);
  console.error('Stack:', error.stack);
  console.error('Process will exit with code 1');
  process.exit(1);
});

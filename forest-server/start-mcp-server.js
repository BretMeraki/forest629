#!/usr/bin/env node

/**
 * MCP Server Wrapper
 * 
 * This wrapper ensures the main() function is always called when starting the MCP server.
 * It bypasses the module detection logic that might fail in different environments.
 */

console.error('Starting Forest MCP server wrapper...');

// Import and immediately call the main function
import('./server-modular.js').then(module => {
  console.error('Server module imported, calling main()...');
  if (module.main) {
    return module.main();
  } else {
    throw new Error('Main function not found in server-modular.js');
  }
}).catch(error => {
  console.error('FATAL ERROR in MCP server wrapper:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
});

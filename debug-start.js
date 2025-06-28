#!/usr/bin/env node

console.error('=== DEBUG START ===');
console.error('Current working directory:', process.cwd());
console.error('Script arguments:', process.argv);
console.error('Node version:', process.version);

try {
  console.error('Attempting to import forest-server/server-modular.js...');
  
  import('./forest-server/server-modular.js').then(module => {
    console.error('SUCCESS: Module imported');
    console.error('Available exports:', Object.keys(module));
    console.error('main function type:', typeof module.main);
    
    if (module.main) {
      console.error('Calling main function...');
      module.main().then(() => {
        console.error('Main function completed successfully');
      }).catch(err => {
        console.error('Main function failed:', err.message);
        console.error('Stack:', err.stack);
      });
    } else {
      console.error('ERROR: No main function found');
    }
  }).catch(importError => {
    console.error('IMPORT FAILED:', importError.message);
    console.error('Stack:', importError.stack);
  });
  
} catch (error) {
  console.error('FATAL ERROR:', error.message);
  console.error('Stack:', error.stack);
}

console.error('=== DEBUG END ===');

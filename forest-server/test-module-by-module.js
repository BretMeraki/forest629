#!/usr/bin/env node
/**
 * Test Module by Module - Find which module is causing hanging
 */

console.log('🔍 TESTING MODULES ONE BY ONE\n');

const coreModules = [
  'modules/core-infrastructure.js',
  'modules/data-persistence.js',
  'modules/memory-sync.js',
  'modules/project-management.js',
  'modules/hta-tree-builder.js',
  'modules/task-completion.js',
  'modules/winston-logger.js',
  'modules/cache-cleaner.js'
];

async function testModuleImport(modulePath) {
  return new Promise(async (resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Module ${modulePath} import timed out`));
    }, 5000);
    
    try {
      console.log(`   Testing ${modulePath}...`);
      const module = await import(`./${modulePath}`);
      clearTimeout(timeout);
      console.log(`   ✅ ${modulePath} imported successfully`);
      resolve(module);
    } catch (error) {
      clearTimeout(timeout);
      console.log(`   ❌ ${modulePath} failed: ${error.message}`);
      reject(error);
    }
  });
}

async function testAllModules() {
  for (const modulePath of coreModules) {
    try {
      await testModuleImport(modulePath);
    } catch (error) {
      console.error(`\n🔴 HANGING MODULE FOUND: ${modulePath}`);
      console.error(`Error: ${error.message}`);
      
      if (error.message.includes('timeout')) {
        console.error('🔴 This module is causing the hanging issue');
      } else if (error.message.includes('fs is not defined')) {
        console.error('🔴 This module has fs import issues');
      }
      
      return false;
    }
  }
  
  console.log('\n✅ All core modules import successfully');
  return true;
}

testAllModules().then((success) => {
  if (success) {
    console.log('\n🎉 No hanging modules found - issue may be in server initialization');
  } else {
    console.log('\n💥 Found problematic module');
  }
  process.exit(success ? 0 : 1);
}).catch((error) => {
  console.error('\n💥 Test framework error:', error.message);
  process.exit(1);
});
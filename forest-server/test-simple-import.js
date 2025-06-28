#!/usr/bin/env node
/**
 * Test Simple Import - Test if basic imports work without hanging
 */

console.log('🔧 TESTING SIMPLE IMPORTS\n');

async function testBasicImports() {
  try {
    console.log('1️⃣ Testing task-completion import...');
    
    const timeout = setTimeout(() => {
      console.error('🔴 CRITICAL: Import still hangs');
      process.exit(1);
    }, 10000);
    
    const { TaskCompletion } = await import('./modules/task-completion.js');
    console.log('✅ TaskCompletion imported successfully');
    
    clearTimeout(timeout);
    
    console.log('\n🎉 BASIC IMPORTS SUCCESSFUL!');
    return true;
    
  } catch (error) {
    console.error('\n❌ IMPORT FAILED');
    console.error(`Error: ${error.message}`);
    console.error(`Stack: ${error.stack}`);
    return false;
  }
}

testBasicImports().then((success) => {
  if (success) {
    console.log('\n🚀 Imports are working!');
    process.exit(0);
  } else {
    console.log('\n💥 Imports still failing');
    process.exit(1);
  }
}).catch((error) => {
  console.error('\n💥 Test framework error:', error.message);
  process.exit(1);
});
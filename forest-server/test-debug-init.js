#!/usr/bin/env node
/**
 * Test Debug Init - Add debug logging to see exactly where hanging occurs
 */

console.log('🔧 TESTING DEBUG INITIALIZATION\n');

async function testDebugInit() {
  try {
    console.log('1️⃣ Testing CleanForestServer import...');
    
    const timeout = setTimeout(() => {
      console.error('🔴 CRITICAL: Hanging detected');
      process.exit(1);
    }, 15000);
    
    const { CleanForestServer } = await import('./server-modular.js');
    console.log('✅ CleanForestServer imported successfully');
    
    console.log('2️⃣ Testing CleanForestServer constructor...');
    const server = new CleanForestServer();
    console.log('✅ CleanForestServer constructor completed');
    
    console.log('3️⃣ Testing CleanForestServer initialization...');
    console.log('   Calling server.initialize()...');
    
    // Add timeout specifically for initialization
    const initTimeout = setTimeout(() => {
      console.error('🔴 CRITICAL: Initialization hanging');
      process.exit(1);
    }, 10000);
    
    await server.initialize();
    clearTimeout(initTimeout);
    
    console.log('✅ CleanForestServer initialization completed');
    
    clearTimeout(timeout);
    
    console.log('\n🎉 DEBUG INIT SUCCESSFUL!');
    return true;
    
  } catch (error) {
    console.error('\n❌ DEBUG INIT FAILED');
    console.error(`Error: ${error.message}`);
    console.error(`Stack: ${error.stack}`);
    return false;
  }
}

testDebugInit().then((success) => {
  if (success) {
    console.log('\n🚀 Debug init working!');
    process.exit(0);
  } else {
    console.log('\n💥 Debug init failed');
    process.exit(1);
  }
}).catch((error) => {
  console.error('\n💥 Test framework error:', error.message);
  process.exit(1);
});
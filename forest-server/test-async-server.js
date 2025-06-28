#!/usr/bin/env node
/**
 * Test Async Server - Test if CleanForestServer works with async initialization
 */

console.log('🔧 TESTING ASYNC SERVER INITIALIZATION\n');

async function testAsyncServer() {
  try {
    console.log('1️⃣ Testing CleanForestServer import...');
    
    const timeout = setTimeout(() => {
      console.error('🔴 CRITICAL: Server import still hangs');
      process.exit(1);
    }, 10000);
    
    const { CleanForestServer } = await import('./server-modular.js');
    console.log('✅ CleanForestServer imported successfully');
    
    console.log('2️⃣ Testing CleanForestServer creation...');
    const server = new CleanForestServer();
    console.log('✅ CleanForestServer created successfully');
    
    console.log('3️⃣ Testing CleanForestServer initialization...');
    await server.initialize();
    console.log('✅ CleanForestServer initialized successfully');
    
    clearTimeout(timeout);
    
    console.log('\n🎉 ASYNC SERVER SUCCESSFUL!');
    return true;
    
  } catch (error) {
    console.error('\n❌ ASYNC SERVER FAILED');
    console.error(`Error: ${error.message}`);
    console.error(`Stack: ${error.stack}`);
    return false;
  }
}

testAsyncServer().then((success) => {
  if (success) {
    console.log('\n🚀 Async server is working!');
    process.exit(0);
  } else {
    console.log('\n💥 Async server still failing');
    process.exit(1);
  }
}).catch((error) => {
  console.error('\n💥 Test framework error:', error.message);
  process.exit(1);
});
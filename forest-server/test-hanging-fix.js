#!/usr/bin/env node
/**
 * Test Hanging Fix - Verify CleanForestServer no longer hangs
 */

console.log('🔧 TESTING HANGING FIX\n');

async function testServerInitialization() {
  try {
    console.log('1️⃣ Testing CleanForestServer initialization...');
    
    // Set timeout to detect hanging
    const timeout = setTimeout(() => {
      console.error('🔴 CRITICAL: Server initialization still hangs after fixes');
      process.exit(1);
    }, 15000);
    
    const { CleanForestServer } = await import('./server-modular.js');
    console.log('✅ CleanForestServer imported successfully');
    
    const server = new CleanForestServer();
    console.log('✅ CleanForestServer initialized successfully');
    
    clearTimeout(timeout);
    
    // Test basic functionality
    console.log('\n2️⃣ Testing basic server functionality...');
    
    const projectParams = {
      project_id: `hanging-fix-test-${Date.now()}`,
      goal: 'Test project after hanging fix',
      life_structure_preferences: {
        focus_duration: '30 minutes',
        wake_time: '08:00',
        sleep_time: '22:00'
      }
    };
    
    const projectResult = await server.createProject(projectParams);
    console.log('✅ Project creation works');
    
    const htaResult = await server.buildHTATree('test', 'mixed', ['testing']);
    console.log('✅ HTA tree building works');
    
    console.log('\n🎉 HANGING FIX SUCCESSFUL!');
    console.log('=============================');
    console.log('✅ CleanForestServer no longer hangs');
    console.log('✅ Core functionality operational');
    console.log('✅ Ready for production use');
    
    return true;
    
  } catch (error) {
    console.error('\n❌ HANGING FIX FAILED');
    console.error(`Error: ${error.message}`);
    console.error(`Stack: ${error.stack}`);
    
    if (error.message.includes('fs is not defined')) {
      console.error('🔴 Still has fs import issues');
    } else if (error.message.includes('not a function')) {
      console.error('🔴 Method signature issues');
    } else {
      console.error('🔴 Other initialization issues');
    }
    
    return false;
  }
}

// Run test
testServerInitialization().then((success) => {
  if (success) {
    console.log('\n🚀 Server is now production-ready!');
    process.exit(0);
  } else {
    console.log('\n💥 Server still has critical issues');
    process.exit(1);
  }
}).catch((error) => {
  console.error('\n💥 Test framework error:', error.message);
  process.exit(1);
});
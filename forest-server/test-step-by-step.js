#!/usr/bin/env node
/**
 * Test Step by Step - Find exactly where the hanging occurs
 */

console.log('🔧 TESTING STEP BY STEP\n');

async function testStepByStep() {
  try {
    console.log('1️⃣ Testing CleanForestServer import...');
    
    const timeout = setTimeout(() => {
      console.error('🔴 CRITICAL: Import hangs');
      process.exit(1);
    }, 15000);
    
    const { CleanForestServer } = await import('./server-modular.js');
    console.log('✅ CleanForestServer imported successfully');
    
    console.log('2️⃣ Testing CleanForestServer constructor...');
    const server = new CleanForestServer();
    console.log('✅ CleanForestServer constructor completed');
    
    console.log('3️⃣ Testing CleanForestServer initialization...');
    await server.initialize();
    console.log('✅ CleanForestServer initialization completed');
    
    console.log('4️⃣ Testing basic functionality...');
    
    // Test if we can call a simple method
    const projectParams = {
      project_id: `step-test-${Date.now()}`,
      goal: 'Test step by step',
      life_structure_preferences: {
        focus_duration: '30 minutes',
        wake_time: '08:00',
        sleep_time: '22:00'
      }
    };
    
    console.log('   Creating project...');
    const projectResult = await server.createProject(projectParams);
    console.log('✅ Project creation completed');
    
    clearTimeout(timeout);
    
    console.log('\n🎉 ALL STEPS SUCCESSFUL!');
    return true;
    
  } catch (error) {
    console.error('\n❌ STEP FAILED');
    console.error(`Error: ${error.message}`);
    console.error(`Stack: ${error.stack}`);
    return false;
  }
}

testStepByStep().then((success) => {
  if (success) {
    console.log('\n🚀 All steps working!');
    process.exit(0);
  } else {
    console.log('\n💥 Step failed');
    process.exit(1);
  }
}).catch((error) => {
  console.error('\n💥 Test framework error:', error.message);
  process.exit(1);
});
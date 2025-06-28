#!/usr/bin/env node
/**
 * SIMPLE WORKFLOW ROBUSTNESS TEST
 */

console.log('🔧 SIMPLE WORKFLOW ROBUSTNESS TEST\n');

async function testSimpleRobustness() {
  try {
    console.log('1️⃣ Testing server import...');
    const { CleanForestServer } = await import('./server-modular.js');
    console.log('✅ Server imported successfully');
    
    console.log('2️⃣ Testing server initialization...');
    const server = new CleanForestServer();
    await server.initialize();
    console.log('✅ Server initialized successfully');
    
    console.log('3️⃣ Testing concurrent project creation...');
    const projects = Array.from({ length: 3 }, (_, i) => ({
      project_id: `robustness-test-${i}-${Date.now()}`,
      goal: `Robustness test project ${i}`,
      life_structure_preferences: {
        focus_duration: '30 minutes',
        wake_time: '08:00',
        sleep_time: '22:00'
      }
    }));
    
    const startTime = Date.now();
    const results = await Promise.allSettled(
      projects.map(params => server.createProject(params))
    );
    const duration = Date.now() - startTime;
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    console.log(`✅ Concurrent Creation: ${successful}/${projects.length} succeeded in ${duration}ms`);
    
    console.log('4️⃣ Testing invalid input handling...');
    const invalidInputs = [
      { project_id: null, goal: 'test' },
      { project_id: '', goal: 'test' },
      { project_id: 'test<>:|?', goal: 'test' }
    ];
    
    let rejectedCount = 0;
    for (const params of invalidInputs) {
      try {
        await server.createProject(params);
        console.log(`❌ Should have rejected: ${JSON.stringify(params)}`);
      } catch (error) {
        rejectedCount++;
        console.log(`✅ Properly rejected invalid input`);
      }
    }
    
    console.log('\n📊 ROBUSTNESS SUMMARY:');
    console.log(`✅ Concurrent operations: ${successful}/${projects.length} successful`);
    console.log(`✅ Input validation: ${rejectedCount}/${invalidInputs.length} properly rejected`);
    
    if (successful === projects.length && rejectedCount === invalidInputs.length) {
      console.log('🏆 WORKFLOW ROBUSTNESS: EXCELLENT - All tests passed');
      return true;
    } else {
      console.log('⚠️ WORKFLOW ROBUSTNESS: NEEDS IMPROVEMENT - Some tests failed');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Robustness test failed:', error.message);
    console.error('Stack:', error.stack);
    return false;
  }
}

testSimpleRobustness().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('💥 Test framework error:', error.message);
  process.exit(1);
});
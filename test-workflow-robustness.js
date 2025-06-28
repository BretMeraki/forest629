#!/usr/bin/env node
/**
 * WORKFLOW ROBUSTNESS TEST
 * Test concurrent operations, invalid inputs, and edge cases
 */

import { CleanForestServer } from './server-modular.js';

console.log('🔧 WORKFLOW ROBUSTNESS TEST\n');

async function testWorkflowRobustness() {
  try {
    // Test 1: Concurrent project creation
    console.log('1️⃣ Testing concurrent project creation...');
    const server = new CleanForestServer();
    await server.initialize();

    const projects = Array.from({ length: 5 }, (_, i) => ({
      project_id: `stress-test-${i}-${Date.now()}`,
      goal: `Stress test project ${i}`,
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
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`✅ Concurrent Creation: ${successful}/${projects.length} succeeded in ${duration}ms`);

    // Test 2: Invalid input handling
    console.log('\n2️⃣ Testing invalid input handling...');

    const invalidInputs = [
      { project_id: null, goal: 'test' },
      { project_id: '', goal: 'test' },
      { project_id: 'test<>:|?', goal: 'test' },
      { project_id: '../../../etc/passwd', goal: 'test' }
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

    // Test 3: Memory stress test
    console.log('\n3️⃣ Testing memory stress...');
    const initialMemory = process.memoryUsage().heapUsed;

    // Create many projects rapidly
    const stressProjects = Array.from({ length: 20 }, (_, i) => ({
      project_id: `memory-stress-${i}-${Date.now()}`,
      goal: `Memory stress test ${i}`,
      life_structure_preferences: {
        focus_duration: '30 minutes',
        wake_time: '08:00',
        sleep_time: '22:00'
      }
    }));

    const stressResults = await Promise.allSettled(
      stressProjects.map(params => server.createProject(params))
    );

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = Math.round((finalMemory - initialMemory) / 1024 / 1024);
    const stressSuccessful = stressResults.filter(r => r.status === 'fulfilled').length;

    console.log(`✅ Memory Stress: ${stressSuccessful}/${stressProjects.length} succeeded, ${memoryIncrease}MB memory increase`);

    // Test 4: HTA tree building stress
    console.log('\n4️⃣ Testing HTA tree building stress...');

    const htaResults = await Promise.allSettled([
      server.buildHTATree('concurrent-1', 'mixed', ['testing', 'stress']),
      server.buildHTATree('concurrent-2', 'visual', ['performance']),
      server.buildHTATree('concurrent-3', 'analytical', ['robustness'])
    ]);

    const htaSuccessful = htaResults.filter(r => r.status === 'fulfilled').length;
    console.log(`✅ HTA Stress: ${htaSuccessful}/3 tree builds succeeded`);

    console.log('\n📊 ROBUSTNESS SUMMARY:');
    console.log(`✅ Concurrent operations: ${successful}/${projects.length} successful`);
    console.log(`✅ Input validation: ${rejectedCount}/${invalidInputs.length} properly rejected`);
    console.log(`✅ Memory stress: ${stressSuccessful}/${stressProjects.length} successful, ${memoryIncrease}MB increase`);
    console.log(`✅ HTA stress: ${htaSuccessful}/3 successful`);

    const overallSuccess = (successful === projects.length) &&
                          (rejectedCount === invalidInputs.length) &&
                          (stressSuccessful >= stressProjects.length * 0.9) &&
                          (htaSuccessful >= 2);

    if (overallSuccess) {
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

testWorkflowRobustness().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('💥 Test framework error:', error.message);
  process.exit(1);
});
#!/usr/bin/env node
/**
 * QUICK REAL STRESS TEST - Let's see what breaks
 */

console.log('🔥 QUICK STRESS TEST - No BS\n');

async function runQuickStressTest() {
  try {
    console.log('1️⃣ Testing server import and initialization...');
    const { CleanForestServer } = await import('./server-modular.js');
    const server = new CleanForestServer();
    await server.initialize();
    console.log('✅ Server initialized');

    console.log('\n2️⃣ Testing concurrent project creation (10 projects)...');
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;

    const projects = Array.from({ length: 10 }, (_, i) => ({
      project_id: `stress-${i}-${Date.now()}`,
      goal: `Stress test project ${i}`,
      life_structure_preferences: {
        focus_duration: '30 minutes',
        wake_time: '08:00',
        sleep_time: '22:00'
      }
    }));

    const results = await Promise.allSettled(
      projects.map(params => server.createProject(params))
    );

    const endTime = Date.now();
    const endMemory = process.memoryUsage().heapUsed;
    const duration = endTime - startTime;
    const memoryIncrease = Math.round((endMemory - startMemory) / 1024 / 1024);

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`Results: ${successful} succeeded, ${failed} failed in ${duration}ms`);
    console.log(`Memory increase: ${memoryIncrease}MB`);

    if (failed > 0) {
      console.log('Failed projects:');
      results.forEach((result, i) => {
        if (result.status === 'rejected') {
          console.log(`  Project ${i}: ${result.reason.message}`);
        }
      });
    }

    console.log('\n3️⃣ Testing security injection...');
    const injectionTests = [
      { name: 'Path Traversal', project_id: '../../../etc/passwd' },
      { name: 'Null Bytes', project_id: 'test\x00malicious' },
      { name: 'XSS', project_id: '<script>alert("xss")</script>' }
    ];

    let blocked = 0;
    for (const test of injectionTests) {
      try {
        await server.createProject({
          project_id: test.project_id,
          goal: 'hack attempt',
          life_structure_preferences: {
            focus_duration: '30 minutes',
            wake_time: '08:00',
            sleep_time: '22:00'
          }
        });
        console.log(`❌ ${test.name}: ALLOWED (security risk)`);
      } catch (error) {
        console.log(`✅ ${test.name}: BLOCKED`);
        blocked++;
      }
    }

    console.log('\n4️⃣ Testing data corruption...');
    const { FileSystem } = await import('./modules/utils/file-system.js');
    
    // Create a project
    const corruptionTestId = `corruption-${Date.now()}`;
    await server.createProject({
      project_id: corruptionTestId,
      goal: 'Corruption test',
      life_structure_preferences: {
        focus_duration: '30 minutes',
        wake_time: '08:00',
        sleep_time: '22:00'
      }
    });

    // Corrupt the data
    const configPath = `${server.core.getDataDir()}/projects/${corruptionTestId}/config.json`;
    await FileSystem.writeFile(configPath, 'CORRUPTED DATA');

    // Try to load corrupted data
    try {
      await server.dataPersistence.loadProjectData(corruptionTestId, 'config.json');
      console.log('❌ Corruption: NOT DETECTED (data integrity risk)');
    } catch (error) {
      console.log('✅ Corruption: DETECTED');
    }

    console.log('\n📊 STRESS TEST SUMMARY:');
    console.log(`✅ Concurrent projects: ${successful}/${projects.length} succeeded`);
    console.log(`✅ Security blocks: ${blocked}/${injectionTests.length} blocked`);
    console.log(`✅ Memory usage: ${memoryIncrease}MB increase`);
    console.log(`✅ Performance: ${duration}ms for ${projects.length} projects`);

    if (successful >= 8 && blocked >= 2 && memoryIncrease < 100 && duration < 10000) {
      console.log('\n🏆 STRESS TEST: PASSED - System is robust');
      return true;
    } else {
      console.log('\n⚠️ STRESS TEST: FAILED - Issues found');
      return false;
    }

  } catch (error) {
    console.error('\n💥 STRESS TEST CRASHED');
    console.error(`Error: ${error.message}`);
    console.error(`Stack: ${error.stack}`);
    return false;
  }
}

runQuickStressTest().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Test framework error:', error.message);
  process.exit(1);
});
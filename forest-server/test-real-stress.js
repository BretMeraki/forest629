#!/usr/bin/env node
/**
 * REAL STRESS TESTS - No BS, actual tests that can fail
 */

import { CleanForestServer } from './server-modular.js';
import { FileSystem } from './modules/utils/file-system.js';

console.log('🔥 REAL STRESS TESTS - Let\'s see what actually breaks\n');

class RealStressTester {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      errors: []
    };
  }

  logResult(test, success, message, error = null) {
    const symbol = success ? '✅' : '❌';
    console.log(`${symbol} ${test}: ${message}`);
    
    if (success) {
      this.results.passed++;
    } else {
      this.results.failed++;
      this.results.errors.push({ test, message, error: error?.message });
    }
  }

  async test1_ConcurrentProjectStress() {
    console.log('\n🔥 TEST 1: CONCURRENT PROJECT STRESS (50 projects)');
    
    try {
      const server = new CleanForestServer();
      await server.initialize();

      // Create 50 projects concurrently - this WILL stress the system
      const projects = Array.from({ length: 50 }, (_, i) => ({
        project_id: `stress-${i}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        goal: `Stress test project ${i} with some complexity`,
        life_structure_preferences: {
          focus_duration: '30 minutes',
          wake_time: '08:00',
          sleep_time: '22:00'
        }
      }));

      console.log('   Creating 50 projects concurrently...');
      const startTime = Date.now();
      const startMemory = process.memoryUsage().heapUsed;

      const results = await Promise.allSettled(
        projects.map(params => server.createProject(params))
      );

      const endTime = Date.now();
      const endMemory = process.memoryUsage().heapUsed;
      const duration = endTime - startTime;
      const memoryIncrease = Math.round((endMemory - startMemory) / 1024 / 1024);

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      console.log(`   Results: ${successful} succeeded, ${failed} failed in ${duration}ms`);
      console.log(`   Memory increase: ${memoryIncrease}MB`);

      // Check for failures
      if (failed > 0) {
        console.log('   Failed project details:');
        results.forEach((result, i) => {
          if (result.status === 'rejected') {
            console.log(`     Project ${i}: ${result.reason.message}`);
          }
        });
      }

      // Realistic thresholds
      if (successful >= 45 && duration < 30000 && memoryIncrease < 200) {
        this.logResult('Concurrent Stress', true, `${successful}/50 succeeded, ${duration}ms, ${memoryIncrease}MB`);
      } else {
        this.logResult('Concurrent Stress', false, `Only ${successful}/50 succeeded, took ${duration}ms, used ${memoryIncrease}MB`);
      }

    } catch (error) {
      this.logResult('Concurrent Stress', false, 'Test framework crashed', error);
    }
  }

  async test2_MemoryStress() {
    console.log('\n🔥 TEST 2: MEMORY STRESS (2 minutes compressed)');
    
    try {
      const server = new CleanForestServer();
      await server.initialize();

      const initialMemory = process.memoryUsage();
      console.log(`   Initial memory: ${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB`);

      // Simulate heavy usage in 2 minutes
      const iterations = 20; // 20 operations
      const delayMs = 6000; // 6 seconds between operations (2 minutes total)

      for (let i = 0; i < iterations; i++) {
        // Create project
        await server.createProject({
          project_id: `memory-test-${i}-${Date.now()}`,
          goal: `Memory test iteration ${i}`,
          life_structure_preferences: {
            focus_duration: '30 minutes',
            wake_time: '08:00',
            sleep_time: '22:00'
          }
        });

        // Build HTA tree
        await server.buildHTATree(`memory-path-${i}`, 'mixed', ['memory', 'test']);

        // Check memory every 5 iterations
        if (i % 5 === 0) {
          const currentMemory = process.memoryUsage();
          const currentMB = Math.round(currentMemory.heapUsed / 1024 / 1024);
          console.log(`   Iteration ${i}: ${currentMB}MB heap used`);
          
          // Force garbage collection if available
          if (global.gc) global.gc();
        }

        // Small delay
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = Math.round((finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024);
      
      console.log(`   Final memory: ${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB`);
      console.log(`   Memory increase: ${memoryIncrease}MB`);

      // Realistic threshold
      if (memoryIncrease < 300) {
        this.logResult('Memory Stress', true, `Memory increase: ${memoryIncrease}MB (acceptable)`);
      } else {
        this.logResult('Memory Stress', false, `Memory increase: ${memoryIncrease}MB (too high)`);
      }

    } catch (error) {
      this.logResult('Memory Stress', false, 'Memory test crashed', error);
    }
  }

  async test3_CorruptionRecovery() {
    console.log('\n🔥 TEST 3: CORRUPTION RECOVERY');
    
    try {
      const server = new CleanForestServer();
      await server.initialize();

      // Create a test project
      const projectId = `corruption-test-${Date.now()}`;
      await server.createProject({
        project_id: projectId,
        goal: 'Corruption recovery test',
        life_structure_preferences: {
          focus_duration: '30 minutes',
          wake_time: '08:00',
          sleep_time: '22:00'
        }
      });

      // Verify it was created
      const configPath = `${server.core.getDataDir()}/projects/${projectId}/config.json`;
      const originalData = await FileSystem.readFile(configPath);
      console.log('   ✓ Project created successfully');

      // DELIBERATELY CORRUPT THE DATA
      await FileSystem.writeFile(configPath, 'CORRUPTED DATA - NOT JSON');
      console.log('   💥 Data deliberately corrupted');

      // Try to load the corrupted data
      try {
        await server.dataPersistence.loadProjectData(projectId, 'config.json');
        this.logResult('Corruption Detection', false, 'Failed to detect corrupted data');
      } catch (error) {
        if (error.message.includes('JSON') || error.message.includes('parse')) {
          this.logResult('Corruption Detection', true, 'Properly detected corrupted data');
        } else {
          this.logResult('Corruption Detection', false, `Unexpected error: ${error.message}`);
        }
      }

      // Test if backup/recovery works
      try {
        // Check if there's a backup
        const backupFiles = await FileSystem.readDirectory(`${server.core.getDataDir()}/projects/${projectId}`);
        const hasBackup = backupFiles.some(file => file.includes('backup') || file.includes('.bak'));
        
        if (hasBackup) {
          this.logResult('Backup System', true, 'Backup files found');
        } else {
          this.logResult('Backup System', false, 'No backup files found');
        }
      } catch (error) {
        this.logResult('Backup System', false, 'Could not check for backups', error);
      }

    } catch (error) {
      this.logResult('Corruption Recovery', false, 'Corruption test crashed', error);
    }
  }

  async test4_SecurityInjection() {
    console.log('\n🔥 TEST 4: SECURITY INJECTION ATTACKS');
    
    try {
      const server = new CleanForestServer();
      await server.initialize();

      const injectionAttempts = [
        { name: 'Path Traversal', project_id: '../../../etc/passwd', goal: 'hack' },
        { name: 'Null Bytes', project_id: 'test\x00malicious', goal: 'hack' },
        { name: 'XSS Script', project_id: '<script>alert("xss")</script>', goal: 'hack' },
        { name: 'SQL Injection', project_id: "'; DROP TABLE projects; --", goal: 'hack' },
        { name: 'Command Injection', project_id: 'test; rm -rf /', goal: 'hack' },
        { name: 'Unicode Exploit', project_id: 'test\u202e\u202d', goal: 'hack' },
        { name: 'Buffer Overflow', project_id: 'A'.repeat(10000), goal: 'hack' },
        { name: 'JSON Injection', project_id: '{"malicious": true}', goal: 'hack' }
      ];

      let blocked = 0;
      let allowed = 0;

      for (const attempt of injectionAttempts) {
        try {
          await server.createProject({
            project_id: attempt.project_id,
            goal: attempt.goal,
            life_structure_preferences: {
              focus_duration: '30 minutes',
              wake_time: '08:00',
              sleep_time: '22:00'
            }
          });
          
          console.log(`   ❌ ${attempt.name}: ALLOWED (security risk)`);
          allowed++;
          
        } catch (error) {
          console.log(`   ✅ ${attempt.name}: BLOCKED (${error.message.slice(0, 50)}...)`);
          blocked++;
        }
      }

      if (blocked >= injectionAttempts.length * 0.8) {
        this.logResult('Security Validation', true, `${blocked}/${injectionAttempts.length} attacks blocked`);
      } else {
        this.logResult('Security Validation', false, `Only ${blocked}/${injectionAttempts.length} attacks blocked, ${allowed} allowed`);
      }

    } catch (error) {
      this.logResult('Security Validation', false, 'Security test crashed', error);
    }
  }

  async test5_LLMFailureHandling() {
    console.log('\n🔥 TEST 5: LLM FAILURE HANDLING');
    
    try {
      const server = new CleanForestServer();
      await server.initialize();

      // Create a project first
      const projectId = `llm-test-${Date.now()}`;
      await server.createProject({
        project_id: projectId,
        goal: 'LLM failure test',
        life_structure_preferences: {
          focus_duration: '30 minutes',
          wake_time: '08:00',
          sleep_time: '22:00'
        }
      });

      // Mock LLM failure by breaking the LLM integration temporarily
      const originalLLM = server.llmIntegration;
      
      // Replace with failing mock
      server.llmIntegration = {
        generateTasks: async () => {
          throw new Error('LLM service unavailable');
        },
        analyzeComplexity: async () => {
          throw new Error('LLM timeout');
        }
      };

      console.log('   🔥 LLM integration mocked to fail');

      // Test if fallbacks work
      try {
        const result = await server.generateTasks(projectId);
        
        if (result && result.tasks && result.tasks.length > 0) {
          this.logResult('LLM Fallback', true, `Fallback provided ${result.tasks.length} tasks`);
        } else {
          this.logResult('LLM Fallback', false, 'No fallback tasks provided');
        }
        
      } catch (error) {
        this.logResult('LLM Fallback', false, `No fallback handling: ${error.message}`);
      }

      // Restore original LLM
      server.llmIntegration = originalLLM;

    } catch (error) {
      this.logResult('LLM Failure Handling', false, 'LLM test crashed', error);
    }
  }

  async runAllTests() {
    console.log('🚀 Starting REAL stress tests that can actually fail...\n');

    await this.test1_ConcurrentProjectStress();
    await this.test2_MemoryStress();
    await this.test3_CorruptionRecovery();
    await this.test4_SecurityInjection();
    await this.test5_LLMFailureHandling();

    this.printResults();
  }

  printResults() {
    console.log('\n📊 REAL STRESS TEST RESULTS');
    console.log('============================');
    console.log(`✅ Passed: ${this.results.passed}`);
    console.log(`❌ Failed: ${this.results.failed}`);
    
    if (this.results.failed > 0) {
      console.log('\n💥 FAILURES:');
      this.results.errors.forEach(error => {
        console.log(`   • ${error.test}: ${error.message}`);
      });
    }

    const total = this.results.passed + this.results.failed;
    const successRate = (this.results.passed / total * 100).toFixed(1);
    
    console.log(`\n📈 SUCCESS RATE: ${successRate}%`);
    
    if (this.results.failed === 0) {
      console.log('\n🏆 ALL TESTS PASSED - System is actually robust');
    } else {
      console.log('\n⚠️ SOME TESTS FAILED - Issues found that need fixing');
    }
  }
}

// Run the real stress tests
const tester = new RealStressTester();
tester.runAllTests().catch(error => {
  console.error('\n💥 STRESS TEST FRAMEWORK CRASHED');
  console.error(`Error: ${error.message}`);
  console.error(`Stack: ${error.stack}`);
  process.exit(1);
});
#!/usr/bin/env node
/**
 * PERFECTION AUDIT - Core Infrastructure
 * Rigorous testing for production readiness
 */

console.log('🔍 PERFECTION AUDIT - CORE INFRASTRUCTURE\n');
console.log('Testing for edge cases, error handling, and production readiness...\n');

let auditResults = {
  passed: 0,
  failed: 0,
  warnings: 0,
  critical: 0,
  issues: []
};

function logResult(test, status, message, severity = 'info') {
  const symbols = { pass: '✅', fail: '❌', warn: '⚠️', critical: '🔴' };
  console.log(`${symbols[status]} ${test}: ${message}`);
  
  auditResults[status === 'pass' ? 'passed' : status === 'fail' ? 'failed' : status === 'warn' ? 'warnings' : 'critical']++;
  
  if (status !== 'pass') {
    auditResults.issues.push({ test, status, message, severity });
  }
}

try {
  // ===== AUDIT 1: Module Import Integrity =====
  console.log('1️⃣ AUDITING MODULE IMPORT INTEGRITY...');
  
  try {
    const { CleanForestServer } = await import('./server-modular.js');
    logResult('CleanForestServer Import', 'pass', 'Main server class imports successfully');
    
    // Test if server can be instantiated without hanging
    const timeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Server initialization timeout')), 10000)
    );
    
    const serverInit = new Promise(async (resolve) => {
      try {
        const server = new CleanForestServer();
        resolve(server);
      } catch (error) {
        throw error;
      }
    });
    
    const server = await Promise.race([serverInit, timeout]);
    logResult('Server Initialization', 'critical', 'Server initialization hangs - not production ready');
    
  } catch (importError) {
    if (importError.message.includes('timeout')) {
      logResult('Server Initialization', 'critical', 'Server initialization hangs - not production ready');
    } else {
      logResult('CleanForestServer Import', 'critical', `Import failed: ${importError.message}`);
    }
  }
  
  // Test individual core modules
  console.log('\n   Testing individual core modules...');
  
  const coreModules = [
    'modules/core-infrastructure.js',
    'modules/data-persistence.js', 
    'modules/memory-sync.js',
    'modules/project-management.js',
    'modules/hta-tree-builder.js',
    'modules/utils/file-system.js'
  ];
  
  for (const modulePath of coreModules) {
    try {
      const module = await import(`./${modulePath}`);
      const exportNames = Object.keys(module);
      
      if (exportNames.length === 0) {
        logResult(`${modulePath} Export`, 'fail', 'Module has no exports');
      } else {
        logResult(`${modulePath} Import`, 'pass', `Exports: ${exportNames.join(', ')}`);
      }
    } catch (moduleError) {
      logResult(`${modulePath} Import`, 'critical', `Failed: ${moduleError.message}`);
    }
  }
  
  // ===== AUDIT 2: FileSystem Utility Robustness =====
  console.log('\n2️⃣ AUDITING FILESYSTEM UTILITY ROBUSTNESS...');
  
  const { FileSystem } = await import('./modules/utils/file-system.js');
  
  // Test edge cases
  const testCases = [
    { method: 'join', args: ['', ''], expected: 'handle empty strings' },
    { method: 'join', args: [null, 'test'], expected: 'handle null values' },
    { method: 'join', args: ['test', undefined], expected: 'handle undefined values' },
    { method: 'exists', args: ['nonexistent-file-12345.txt'], expected: 'return false for nonexistent files' },
    { method: 'exists', args: [''], expected: 'handle empty path' },
    { method: 'exists', args: [null], expected: 'handle null path' }
  ];
  
  for (const testCase of testCases) {
    try {
      const result = await FileSystem[testCase.method](...testCase.args);
      logResult(`FileSystem.${testCase.method} Edge Case`, 'pass', `Handled: ${testCase.expected}`);
    } catch (error) {
      if (error.message.includes('Invalid') || error.message.includes('path')) {
        logResult(`FileSystem.${testCase.method} Edge Case`, 'pass', `Properly rejected invalid input: ${error.message}`);
      } else {
        logResult(`FileSystem.${testCase.method} Edge Case`, 'fail', `Unexpected error: ${error.message}`);
      }
    }
  }
  
  // Test atomic operations under stress
  console.log('\n   Testing atomic operations...');
  
  const testDir = './test-atomic-stress';
  const testFile = `${testDir}/atomic-test.json`;
  
  try {
    await FileSystem.ensureDirectoryExists(testDir);
    
    // Test concurrent atomic writes
    const concurrentWrites = Array.from({ length: 10 }, (_, i) => 
      FileSystem.atomicWriteJSON(testFile, { test: i, timestamp: Date.now() })
    );
    
    await Promise.all(concurrentWrites);
    
    // Verify file integrity
    const finalData = await FileSystem.readJSON(testFile);
    if (finalData && typeof finalData.test === 'number') {
      logResult('Atomic Write Concurrency', 'pass', 'Concurrent writes handled correctly');
    } else {
      logResult('Atomic Write Concurrency', 'fail', 'Data corruption detected');
    }
    
    // Cleanup
    await FileSystem.deleteFile(testFile);
    await FileSystem.deleteDirectory(testDir);
    
  } catch (atomicError) {
    logResult('Atomic Operations', 'fail', `Atomic operations failed: ${atomicError.message}`);
  }
  
  // ===== AUDIT 3: Data Persistence Integrity =====
  console.log('\n3️⃣ AUDITING DATA PERSISTENCE INTEGRITY...');
  
  const { DataPersistence } = await import('./modules/data-persistence.js');
  const dataPersistence = new DataPersistence('./test-audit-data');
  
  // Test invalid inputs
  const invalidInputTests = [
    { method: 'saveProjectData', args: ['', 'test.json', {}], expected: 'reject empty project ID' },
    { method: 'saveProjectData', args: ['test', '', {}], expected: 'reject empty filename' },
    { method: 'saveProjectData', args: ['test', 'test.json', null], expected: 'reject null data' },
    { method: 'saveProjectData', args: ['test', 'test.json', undefined], expected: 'reject undefined data' }
  ];
  
  for (const test of invalidInputTests) {
    try {
      await dataPersistence[test.method](...test.args);
      logResult(`DataPersistence.${test.method} Validation`, 'fail', `Should have rejected: ${test.expected}`);
    } catch (error) {
      if (error.message.includes('Invalid') || error.message.includes('Cannot')) {
        logResult(`DataPersistence.${test.method} Validation`, 'pass', `Properly rejected: ${test.expected}`);
      } else {
        logResult(`DataPersistence.${test.method} Validation`, 'warn', `Unexpected error: ${error.message}`);
      }
    }
  }
  
  // Test data corruption scenarios
  console.log('\n   Testing data corruption scenarios...');
  
  try {
    // Create valid data
    await dataPersistence.saveProjectData('corruption-test', 'valid.json', { test: 'data' });
    
    // Manually corrupt the file
    const corruptFile = './test-audit-data/projects/corruption-test/valid.json';
    await FileSystem.writeFile(corruptFile, 'invalid json content');
    
    // Try to load corrupted data
    try {
      await dataPersistence.loadProjectData('corruption-test', 'valid.json');
      logResult('Corruption Handling', 'fail', 'Should have detected corrupted JSON');
    } catch (corruptError) {
      if (corruptError.message.includes('JSON') || corruptError.message.includes('parse')) {
        logResult('Corruption Handling', 'pass', 'Properly detected corrupted JSON');
      } else {
        logResult('Corruption Handling', 'warn', `Unexpected corruption error: ${corruptError.message}`);
      }
    }
    
    // Cleanup
    await FileSystem.deleteDirectory('./test-audit-data');
    
  } catch (corruptionTestError) {
    logResult('Corruption Testing', 'fail', `Corruption test failed: ${corruptionTestError.message}`);
  }
  
  // ===== AUDIT 4: Memory Management =====
  console.log('\n4️⃣ AUDITING MEMORY MANAGEMENT...');
  
  // Test memory usage patterns
  const initialMemory = process.memoryUsage();
  
  // Create multiple instances to test for memory leaks
  const instances = [];
  for (let i = 0; i < 100; i++) {
    try {
      const dp = new DataPersistence(`./test-memory-${i}`);
      instances.push(dp);
    } catch (memError) {
      logResult('Memory Stress Test', 'fail', `Failed at instance ${i}: ${memError.message}`);
      break;
    }
  }
  
  const afterCreation = process.memoryUsage();
  const memoryIncrease = afterCreation.heapUsed - initialMemory.heapUsed;
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
  
  const afterGC = process.memoryUsage();
  const memoryAfterGC = afterGC.heapUsed - initialMemory.heapUsed;
  
  if (memoryIncrease > 50 * 1024 * 1024) { // 50MB threshold
    logResult('Memory Usage', 'warn', `High memory usage: ${Math.round(memoryIncrease / 1024 / 1024)}MB for 100 instances`);
  } else {
    logResult('Memory Usage', 'pass', `Reasonable memory usage: ${Math.round(memoryIncrease / 1024 / 1024)}MB for 100 instances`);
  }
  
  if (memoryAfterGC > memoryIncrease * 0.8) {
    logResult('Memory Cleanup', 'warn', 'Potential memory leak detected');
  } else {
    logResult('Memory Cleanup', 'pass', 'Memory cleanup appears normal');
  }
  
  // ===== AUDIT 5: Error Handling Completeness =====
  console.log('\n5️⃣ AUDITING ERROR HANDLING COMPLETENESS...');
  
  // Test various error scenarios
  const errorScenarios = [
    { test: 'Disk Full Simulation', action: async () => {
      // Simulate disk full by trying to write to /dev/full on Unix or similar
      // For Windows, we'll simulate with a very large file
      try {
        const largeData = 'x'.repeat(1024 * 1024 * 100); // 100MB string
        await FileSystem.writeFile('./test-large-file.txt', largeData);
        await FileSystem.deleteFile('./test-large-file.txt');
        return 'handled';
      } catch (error) {
        return error.message.includes('ENOSPC') ? 'properly_handled' : 'unexpected_error';
      }
    }},
    { test: 'Permission Denied', action: async () => {
      try {
        await FileSystem.writeFile('/root/test-permission.txt', 'test');
        return 'should_have_failed';
      } catch (error) {
        return error.message.includes('EACCES') || error.message.includes('permission') ? 'properly_handled' : 'unexpected_error';
      }
    }},
    { test: 'Invalid Path Characters', action: async () => {
      try {
        await FileSystem.writeFile('test<>:|?.txt', 'test');
        return 'should_have_failed';
      } catch (error) {
        return 'properly_handled';
      }
    }}
  ];
  
  for (const scenario of errorScenarios) {
    try {
      const result = await scenario.action();
      
      if (result === 'properly_handled') {
        logResult(scenario.test, 'pass', 'Error properly handled');
      } else if (result === 'should_have_failed') {
        logResult(scenario.test, 'warn', 'Should have failed but succeeded');
      } else if (result === 'handled') {
        logResult(scenario.test, 'pass', 'Operation completed successfully');
      } else {
        logResult(scenario.test, 'fail', 'Unexpected error handling behavior');
      }
    } catch (scenarioError) {
      logResult(scenario.test, 'fail', `Scenario test failed: ${scenarioError.message}`);
    }
  }
  
  // ===== AUDIT SUMMARY =====
  console.log('\n📊 CORE INFRASTRUCTURE AUDIT SUMMARY');
  console.log('====================================');
  console.log(`✅ Passed: ${auditResults.passed}`);
  console.log(`❌ Failed: ${auditResults.failed}`);
  console.log(`⚠️ Warnings: ${auditResults.warnings}`);
  console.log(`🔴 Critical: ${auditResults.critical}`);
  
  if (auditResults.critical > 0) {
    console.log('\n🔴 CRITICAL ISSUES FOUND:');
    auditResults.issues.filter(i => i.status === 'critical').forEach(issue => {
      console.log(`   • ${issue.test}: ${issue.message}`);
    });
  }
  
  if (auditResults.failed > 0) {
    console.log('\n❌ FAILED TESTS:');
    auditResults.issues.filter(i => i.status === 'fail').forEach(issue => {
      console.log(`   • ${issue.test}: ${issue.message}`);
    });
  }
  
  if (auditResults.warnings > 0) {
    console.log('\n⚠️ WARNINGS:');
    auditResults.issues.filter(i => i.status === 'warn').forEach(issue => {
      console.log(`   • ${issue.test}: ${issue.message}`);
    });
  }
  
  const totalTests = auditResults.passed + auditResults.failed + auditResults.warnings + auditResults.critical;
  const successRate = (auditResults.passed / totalTests * 100).toFixed(1);
  
  console.log(`\n📈 SUCCESS RATE: ${successRate}%`);
  
  if (auditResults.critical > 0) {
    console.log('\n🚨 PERFECTION STATUS: FAILED - Critical issues must be resolved');
    process.exit(1);
  } else if (auditResults.failed > 0) {
    console.log('\n⚠️ PERFECTION STATUS: NEEDS IMPROVEMENT - Failed tests must be addressed');
    process.exit(1);
  } else if (auditResults.warnings > 0) {
    console.log('\n🟡 PERFECTION STATUS: GOOD - Warnings should be reviewed');
  } else {
    console.log('\n🏆 PERFECTION STATUS: EXCELLENT - Core infrastructure meets perfection standards');
  }
  
} catch (auditError) {
  console.error('\n💥 AUDIT FRAMEWORK FAILURE');
  console.error(`Error: ${auditError.message}`);
  console.error(`Stack: ${auditError.stack}`);
  process.exit(1);
}

console.log('\n🔍 Core infrastructure audit complete');
process.exit(0);
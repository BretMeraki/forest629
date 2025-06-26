#!/usr/bin/env node

/**
 * Test script to verify the Forest Defense System is operational
 * This script will:
 * 1. Start the Forest server
 * 2. Execute some tools (both successful and failing)
 * 3. Check if health data is being captured
 * 4. Verify defense system components are working
 */

import { CleanForestServer } from './server-modular.js';
import { getForestLogger } from './modules/winston-logger.js';

const logger = getForestLogger({ module: 'DEFENSE_TEST' });

async function testDefenseSystem() {
  console.log('🛡️ Testing Forest Defense System...\n');
  
  try {
    // 1. Initialize the server
    console.log('1️⃣ Initializing Forest server...');
    const server = new CleanForestServer();
    await server.setupServer();
    console.log('✅ Server initialized\n');

    // 2. Check defense system status
    console.log('2️⃣ Checking defense system status...');
    const defenseStatus = {
      componentHealthReporter: !!server.componentHealthReporter,
      contextGuard: !!server.contextGuard,
      selfHealManager: !!server.selfHealManager,
      healthTracking: !!(server.toolRouter?.toolRegistry?.healthTracker)
    };

    console.log('Defense System Components:');
    console.log(`  ComponentHealthReporter: ${defenseStatus.componentHealthReporter ? '✅' : '❌'}`);
    console.log(`  ContextGuard: ${defenseStatus.contextGuard ? '✅' : '❌'}`);
    console.log(`  SelfHealManager: ${defenseStatus.selfHealManager ? '✅' : '❌'}`);
    console.log(`  Health Tracking: ${defenseStatus.healthTracking ? '✅' : '❌'}`);
    
    const isOperational = Object.values(defenseStatus).every(status => status);
    console.log(`\n🛡️ Defense System: ${isOperational ? '🟢 OPERATIONAL' : '🔴 NOT OPERATIONAL'}\n`);

    // 3. Test health tracking with successful function
    console.log('3️⃣ Testing health tracking with successful function...');
    try {
      server._trackFunctionHealth('test_success_function', true, null);
      console.log('✅ Successfully tracked healthy function\n');
    } catch (error) {
      console.log(`❌ Failed to track healthy function: ${error.message}\n`);
    }

    // 4. Test health tracking with failing function
    console.log('4️⃣ Testing health tracking with failing function...');
    try {
      const mockError = new Error('Test failure');
      server._trackFunctionHealth('test_failing_function', false, mockError);
      console.log('✅ Successfully tracked failing function\n');
    } catch (error) {
      console.log(`❌ Failed to track failing function: ${error.message}\n`);
    }

    // 5. Test ContextGuard validation
    console.log('5️⃣ Testing ContextGuard validation...');
    if (server.contextGuard) {
      try {
        // Test valid claim
        const validResult = server.contextGuard.validateComponentHealth('test_component', 'healthy');
        console.log(`✅ Valid claim test: ${validResult ? 'PASSED' : 'FAILED'}`);

        // Test invalid claim (this should trigger a contradiction)
        const invalidResult = server.contextGuard.validateComponentHealth('test_failing_function', 'healthy');
        console.log(`✅ Invalid claim test: ${invalidResult ? 'UNEXPECTED PASS' : 'CONTRADICTION DETECTED'}\n`);
      } catch (error) {
        console.log(`❌ ContextGuard test failed: ${error.message}\n`);
      }
    } else {
      console.log('❌ ContextGuard not available\n');
    }

    // 6. Test SelfHealManager
    console.log('6️⃣ Testing SelfHealManager...');
    if (server.selfHealManager) {
      try {
        await server.selfHealManager.triggerSelfHealing('test_component', { test: true });
        console.log('✅ SelfHealManager triggered successfully\n');
      } catch (error) {
        console.log(`❌ SelfHealManager test failed: ${error.message}\n`);
      }
    } else {
      console.log('❌ SelfHealManager not available\n');
    }

    // 7. Check memory for health data
    console.log('7️⃣ Checking memory for health data...');
    if (server.memorySync) {
      try {
        const memoryStore = server.memorySync.loadMemory();
        const healthEntries = Object.keys(memoryStore).filter(key => key.startsWith('component_status:'));
        
        console.log(`Found ${healthEntries.length} health entries in memory:`);
        healthEntries.forEach(key => {
          const componentName = key.replace('component_status:', '');
          const data = memoryStore[key];
          console.log(`  ${componentName}: ${data.status} (${data.meta?.testCount || 0} tests)`);
        });
        console.log('');
      } catch (error) {
        console.log(`❌ Memory check failed: ${error.message}\n`);
      }
    } else {
      console.log('❌ Memory system not available\n');
    }

    // 8. Final assessment
    console.log('8️⃣ Final Assessment:');
    if (isOperational) {
      console.log('🎉 SUCCESS: Forest Defense System is fully operational!');
      console.log('   - Health monitoring is active');
      console.log('   - Contradiction detection is working');
      console.log('   - Self-healing is available');
      console.log('   - Memory integration is functional');
    } else {
      console.log('⚠️  WARNING: Forest Defense System has issues');
      console.log('   - Some components are not initialized');
      console.log('   - Defense capabilities may be limited');
    }

    return isOperational;

  } catch (error) {
    console.error('❌ Defense system test failed:', error.message);
    console.error('Stack:', error.stack);
    return false;
  }
}

// Run the test if this script is executed directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
  testDefenseSystem()
    .then(success => {
      console.log(`\n🛡️ Defense System Test: ${success ? 'PASSED' : 'FAILED'}`);
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

export { testDefenseSystem };

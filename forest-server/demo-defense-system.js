#!/usr/bin/env node

/**
 * Demo script to show the Forest Defense System in action
 * This demonstrates real-time health monitoring and contradiction detection
 */

import { CleanForestServer } from './server-modular.js';
import { getForestLogger } from './modules/winston-logger.js';

const logger = getForestLogger({ module: 'DEFENSE_DEMO' });

async function demonstrateDefenseSystem() {
  console.log('🛡️ Forest Defense System Demonstration\n');
  
  try {
    // Initialize the server
    console.log('🚀 Initializing Forest server...');
    const server = new CleanForestServer();
    await server.setupServer();
    console.log('✅ Server ready\n');

    // Check defense system status
    console.log('📊 Defense System Status:');
    const status = {
      componentHealthReporter: !!server.componentHealthReporter,
      contextGuard: !!server.contextGuard,
      selfHealManager: !!server.selfHealManager,
      healthTracking: !!(server.toolRouter?.toolRegistry?.healthTracker)
    };

    Object.entries(status).forEach(([component, active]) => {
      console.log(`   ${component}: ${active ? '🟢 Active' : '🔴 Inactive'}`);
    });

    const isOperational = Object.values(status).every(s => s);
    console.log(`\n🛡️ Overall Status: ${isOperational ? '🟢 OPERATIONAL' : '🔴 NOT OPERATIONAL'}\n`);

    if (!isOperational) {
      console.log('❌ Defense system not fully operational. Exiting...');
      return false;
    }

    // Demonstrate health tracking
    console.log('🔍 Demonstrating Health Tracking:\n');

    // 1. Track a successful function
    console.log('1️⃣ Simulating successful function call...');
    server._trackFunctionHealth('user_login', true, null);
    console.log('   ✅ Tracked: user_login = SUCCESS\n');

    // 2. Track a failing function  
    console.log('2️⃣ Simulating failing function call...');
    const mockError = new Error('Database connection failed');
    server._trackFunctionHealth('database_query', false, mockError);
    console.log('   ❌ Tracked: database_query = FAILURE\n');

    // 3. Demonstrate contradiction detection
    console.log('3️⃣ Testing Contradiction Detection:\n');

    // Valid claim - should pass
    console.log('   Testing VALID claim (user_login = healthy):');
    const validResult = server.contextGuard.validateComponentHealth('user_login', 'healthy');
    console.log(`   Result: ${validResult ? '✅ VALID' : '❌ CONTRADICTION'}\n`);

    // Invalid claim - should trigger contradiction
    console.log('   Testing INVALID claim (database_query = healthy):');
    const invalidResult = server.contextGuard.validateComponentHealth('database_query', 'healthy');
    console.log(`   Result: ${invalidResult ? '✅ VALID' : '⚠️ CONTRADICTION DETECTED'}\n`);

    // 4. Show memory integration
    console.log('4️⃣ Checking Memory Integration:\n');
    
    if (server.memorySync) {
      const memoryStore = server.memorySync.loadMemory();
      const healthEntries = Object.keys(memoryStore).filter(key => key.startsWith('component_status:'));
      
      console.log(`   Found ${healthEntries.length} health entries in memory:`);
      healthEntries.forEach(key => {
        const componentName = key.replace('component_status:', '');
        const data = memoryStore[key];
        console.log(`   📋 ${componentName}: ${data.status} (${data.meta?.testCount || 0} tests, ${data.meta?.failures || 0} failures)`);
      });
    }

    console.log('\n🎉 Defense System Demonstration Complete!\n');

    // Summary
    console.log('📋 Summary of Defense System Capabilities:');
    console.log('   🔍 Real-time health monitoring of function calls');
    console.log('   ⚠️  Automatic contradiction detection');
    console.log('   🔧 Self-healing trigger system');
    console.log('   💾 Persistent health data storage');
    console.log('   🔗 Event-driven component communication');

    return true;

  } catch (error) {
    console.error('❌ Demo failed:', error.message);
    return false;
  }
}

// Run the demo
demonstrateDefenseSystem()
  .then(success => {
    console.log(`\n🛡️ Defense System Demo: ${success ? '✅ SUCCESS' : '❌ FAILED'}`);
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Demo execution failed:', error);
    process.exit(1);
  });

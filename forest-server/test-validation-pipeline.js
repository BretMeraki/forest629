#!/usr/bin/env node

// ------------------------------------------------------------
// ENVIRONMENT GUARD – avoid clashing with production instances
// ------------------------------------------------------------
if (process.env.NODE_ENV !== 'test' && !process.env.FORCE_TEST_RUN) {
  console.log('⏭️  Skipping validation pipeline – not running in test mode');
  console.log('     Set NODE_ENV=test or FORCE_TEST_RUN=true to execute.');
  process.exit(0);
}

/**
 * Validation Pipeline Test Script
 * Tests the new defensive programming and validation pipeline
 */

import { CleanForestServer } from './server-modular.js';

console.log('🧪 Starting Validation Pipeline Test Simulation...\n');

// Create server instance
const server = new CleanForestServer();

async function testValidationPipeline() {
  try {
    await server.setupServer();
    console.log('✅ Server initialized successfully\n');

    // Test 1: Invalid branchTasks input (the main issue we're fixing)
    console.log('📋 TEST 1: Invalid branchTasks input (not an array)');
    console.log('Testing the exact error that was failing before...\n');
    
    try {
      const result1 = await server.storeGeneratedTasks("invalid input");
      console.log('❌ Expected validation error, but got:', result1);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.log('✅ Caught validation error as expected:');
      console.log('   Error:', err.message.split('\n')[0]);
      console.log('   Enhanced guidance provided:', err.message.includes('Expected format'));
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // Test 2: Invalid branchTasks input (wrong object structure)
    console.log('📋 TEST 2: Invalid branchTasks structure');
    console.log('Testing validation of branch structure...\n');
    
    try {
      const result2 = await server.storeGeneratedTasks([
        { wrong_field: "test", no_tasks: [] }
      ]);
      console.log('❌ Expected validation error, but got:', result2);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.log('✅ Caught structure validation error:');
      console.log('   Error:', err.message.split('\n')[0]);
      console.log('   Specific field guidance:', err.message.includes('branch_name'));
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // Test 3: Valid input (should work)
    console.log('📋 TEST 3: Valid branchTasks input');
    console.log('Testing that valid input still works...\n');
    
    try {
      // First create a project since storeGeneratedTasks requires one
      await server.createProject({
        goal: "Test validation pipeline",
        life_structure_preferences: {
          wake_time: "07:00",
          sleep_time: "23:00"
        }
      });

      // Now build HTA tree so we have structure to store tasks in
      await server.buildHTATree("test", "mixed", [], "Test validation pipeline");

      const validInput = [
        {
          branch_name: "test_branch",
          tasks: [
            {
              title: "Test Task 1",
              description: "A test task to validate the pipeline",
              difficulty: 2,
              duration: 30
            }
          ]
        }
      ];

      const result3 = await server.storeGeneratedTasks(validInput);
      if (result3.content && result3.content[0].text.includes('✅')) {
        console.log('✅ Valid input processed successfully');
        console.log('   Response:', result3.content[0].text.split('\n')[0]);
      } else {
        console.log('⚠️  Valid input result:', result3);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.log('❌ Valid input failed unexpectedly:', err.message);
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // Test 4: Tool registry validation
    console.log('📋 TEST 4: Tool registry validation');
    console.log('Testing tool existence validation...\n');
    
    try {
      // Try to call a non-existent tool through the tool router
      const result4 = await server.toolRouter.dispatchTool('nonexistent_tool', {});
      console.log('❌ Expected tool not found error, but got:', result4);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.log('✅ Tool registry validation working:');
      console.log('   Error:', err.message.split('.')[0]);
      console.log('   Helpful suggestions:', err.message.includes('Available tools') || err.message.includes('Similar tools'));
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // Test 5: Project creation with auto-defaults
    console.log('📋 TEST 5: Project creation with auto-defaults');
    console.log('Testing the create_project schema fix...\n');
    
    try {
      // Test with minimal input - should auto-generate missing fields
      const result5 = await server.createProject({
        goal: "Test minimal project creation"
        // No life_structure_preferences - should auto-generate
        // No project_id - should auto-generate
      });
      
      if (result5.content && result5.content[0].text.includes('✅')) {
        console.log('✅ Auto-defaults working for create_project');
        console.log('   Auto-generated ID:', result5.content[0].text.includes('Auto-generated ID: Yes'));
        console.log('   Default schedule applied:', result5.content[0].text.includes('07:00 - 23:00'));
      } else {
        console.log('⚠️  Create project result:', result5);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.log('❌ Create project with auto-defaults failed:', err.message);
    }

    console.log('\n' + '🎯 VALIDATION PIPELINE TEST COMPLETE 🎯\n');
    
  } catch (setupError) {
    const err = setupError instanceof Error ? setupError : new Error(String(setupError));
    console.error('❌ Failed to setup server for testing:', err.message);
    console.error('Stack:', err.stack);
  }
}

// Run the test
testValidationPipeline().then(() => {
  console.log('✅ Test simulation completed. Check the results above!');
  process.exit(0);
}).catch((error) => {
  const err = error instanceof Error ? error : new Error(String(error));
  console.error('❌ Test simulation failed:', err.message);
  process.exit(1);
}); 
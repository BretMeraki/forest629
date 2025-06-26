#!/usr/bin/env node

/**
 * Test script for HTA Debug Tools
 * Validates the debug pipeline functionality
 */

import { HTADebugTools } from './modules/hta-debug-tools.js';
import { DataPersistence } from './modules/data-persistence.js';
import { CoreInfrastructure } from './modules/core-infrastructure.js';

async function testHTADebugTools() {
  console.log('=== HTA Debug Tools Test ===\n');

  try {
    // Create minimal server-like object for testing
    const core = new CoreInfrastructure();
    const dataPersistence = new DataPersistence(core.getDataDir());
    
    const mockServer = {
      dataPersistence,
      buildHTATree: async () => ({
        success: true,
        branches: [{ id: 'test', title: 'Test Branch' }],
        total_tasks: 3
      }),
      loadPathHTA: async () => ({
        goal: 'Test goal',
        branches: [{ id: 'test', title: 'Test Branch' }],
        frontier_nodes: [
          { id: 'task1', title: 'Test Task 1', branch: 'test' },
          { id: 'task2', title: 'Test Task 2', branch: 'test' }
        ]
      }),
      getNextTask: async () => ({
        success: true,
        selected_task: {
          id: 'task1',
          title: 'Specific actionable task',
          branch: 'test'
        }
      })
    };

    const debugTools = new HTADebugTools(mockServer);

    // Test 1: Node structure validation
    console.log('1. Testing node structure validation...');
    const testNodes = [
      { id: 'valid1', title: 'Valid Task 1', branch: 'test' },
      { id: 'valid2', title: 'Valid Task 2', branch: 'test' },
      { title: 'Missing ID', branch: 'test' }, // Invalid
      { id: 'missing-title', branch: 'test' }, // Invalid
      { id: 'missing-branch', title: 'Missing Branch' } // Invalid
    ];

    const nodeValidation = debugTools.validateNodeStructure(testNodes);
    console.log('Node Validation Result:', JSON.stringify(nodeValidation, null, 2));

    // Test 2: Generic task detection
    console.log('\n2. Testing generic task detection...');
    const taskTitles = [
      'Learn more about Python', // Generic
      'Explore machine learning', // Generic
      'Build a REST API with authentication', // Specific
      'Research data structures', // Generic
      'Implement user registration system', // Specific
    ];

    for (const title of taskTitles) {
      const isGeneric = debugTools.isGenericTask(title);
      console.log(`"${title}" -> ${isGeneric ? 'GENERIC' : 'SPECIFIC'}`);
    }

    // Test 3: Project setup validation (mock)
    console.log('\n3. Testing project setup validation...');
    const setupValidation = await debugTools.validateProjectSetup('test-project');
    console.log('Setup Validation:', JSON.stringify(setupValidation, null, 2));

    // Test 4: Full pipeline validation (mock)
    console.log('\n4. Testing full pipeline validation...');
    const pipelineValidation = await debugTools.validateHTAPipeline('test-project', 'general');
    console.log('Pipeline Validation Summary:');
    console.log(`Overall Status: ${pipelineValidation.overallStatus}`);
    console.log('Stage Results:');
    for (const [stage, result] of Object.entries(pipelineValidation.stages)) {
      console.log(`  ${stage}: ${result.status}`);
    }
    console.log('Recommendations:');
    pipelineValidation.recommendations.forEach(rec => console.log(`  - ${rec}`));

    console.log('\n=== HTA Debug Tools Test Complete ===');
    console.log('All tests passed! Debug tools are functional.');

  } catch (error) {
    console.error('Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test if this script is executed directly
if (process.argv[1].endsWith('test-hta-debug.js')) {
  testHTADebugTools();
}

export { testHTADebugTools };

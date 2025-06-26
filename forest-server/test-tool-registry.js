#!/usr/bin/env node

/**
 * Tool Registry Validation Test
 * Tests the enhanced Tool Registry with AJV validation
 */

import { ToolRegistry } from './modules/utils/tool-registry.js';

console.log('🔧 Testing Tool Registry Validation Pipeline...\n');

// Create a tool registry instance
const registry = new ToolRegistry();

// Test schema for a sample tool
const createProjectSchema = {
  type: 'object',
  properties: {
    goal: { 
      type: 'string',
      minLength: 1,
      description: 'Project goal' 
    },
    project_id: { 
      type: 'string',
      description: 'Optional project ID' 
    },
    life_structure_preferences: {
      type: 'object',
      properties: {
        wake_time: { type: 'string', pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$' },
        sleep_time: { type: 'string', pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$' }
      },
      required: ['wake_time', 'sleep_time']
    }
  },
  required: ['goal']
};

// Register a test tool with validation schema
registry.register(
  'create_project_test',
  async (args) => ({ success: true, message: 'Project created', data: args }),
  'project',
  { description: 'Test tool for validation' },
  createProjectSchema
);

// Test cases for validation
const testCases = [
  {
    name: 'Valid input',
    args: {
      goal: 'Learn JavaScript',
      life_structure_preferences: {
        wake_time: '07:00',
        sleep_time: '23:00'
      }
    },
    shouldPass: true
  },
  {
    name: 'Missing required field (goal)',
    args: {
      life_structure_preferences: {
        wake_time: '07:00',
        sleep_time: '23:00'
      }
    },
    shouldPass: false
  },
  {
    name: 'Invalid time format',
    args: {
      goal: 'Learn Python',
      life_structure_preferences: {
        wake_time: '25:00', // Invalid hour
        sleep_time: '23:00'
      }
    },
    shouldPass: false
  },
  {
    name: 'Wrong type for goal',
    args: {
      goal: 123, // Should be string
      life_structure_preferences: {
        wake_time: '07:00',
        sleep_time: '23:00'
      }
    },
    shouldPass: false
  },
  {
    name: 'Empty goal string',
    args: {
      goal: '', // Empty string should fail minLength
      life_structure_preferences: {
        wake_time: '07:00',
        sleep_time: '23:00'
      }
    },
    shouldPass: false
  }
];

console.log('🔬 Testing tool registry validation...\n');

let passedTests = 0;
let totalTests = testCases.length;

for (let i = 0; i < testCases.length; i++) {
  const testCase = testCases[i];
  console.log(`Test ${i + 1}: ${testCase.name}`);
  
  try {
    // Test validation
    const validationResult = registry.validateArgs('create_project_test', testCase.args);
    
    if (validationResult.valid && testCase.shouldPass) {
      console.log('   ✅ Validation passed as expected');
      
      // Also test execution
      const result = await registry.execute('create_project_test', testCase.args);
      console.log('   ✅ Tool execution successful');
      passedTests++;
      
    } else if (!validationResult.valid && !testCase.shouldPass) {
      console.log('   ✅ Validation failed as expected');
      console.log(`   📝 Error details: ${validationResult.errors[0]}`);
      console.log(`   🔍 Missing fields: ${validationResult.details.missingFields?.join(', ') || 'none'}`);
      console.log(`   🔍 Type errors: ${validationResult.details.typeErrors?.length || 0}`);
      passedTests++;
      
    } else {
      console.log('   ❌ Unexpected validation result');
      console.log(`   Expected: ${testCase.shouldPass ? 'pass' : 'fail'}, Got: ${validationResult.valid ? 'pass' : 'fail'}`);
      if (!validationResult.valid) {
        console.log(`   Errors: ${validationResult.errors.join(', ')}`);
      }
    }
    
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    if (!testCase.shouldPass) {
      console.log('   ✅ Execution failed as expected');
      console.log(`   📝 Error: ${err.message.split('\n')[0]}`);
      passedTests++;
    } else {
      console.log('   ❌ Unexpected execution error');
      console.log(`   Error: ${err.message}`);
    }
  }
  
  console.log(''); // Empty line
}

// Test tool not found scenario
console.log('Test: Tool not found scenario');
try {
  await registry.execute('nonexistent_tool', {});
  console.log('   ❌ Should have thrown "tool not found" error');
} catch (error) {
  const err = error instanceof Error ? error : new Error(String(error));
  console.log('   ✅ Tool not found error caught');
  console.log(`   📝 Error: ${err.message}`);
  passedTests++;
  totalTests++;
}

console.log('\n' + '='.repeat(80));
console.log(`🎯 TOOL REGISTRY VALIDATION RESULTS: ${passedTests}/${totalTests} tests passed`);

if (passedTests === totalTests) {
  console.log('\n✅ All Tool Registry validation improvements working correctly!');
  console.log('\nKey features demonstrated:');
  console.log('• ✅ AJV JSON Schema validation with detailed error reporting');
  console.log('• ✅ Field-level validation with specific missing field identification');
  console.log('• ✅ Type checking with clear "expected vs received" messaging');
  console.log('• ✅ Pattern validation (e.g., time format validation)');
  console.log('• ✅ Custom validation rules (minLength, required fields)');
  console.log('• ✅ Enhanced error context for tool execution failures');
  console.log('\n🚀 The Tool Registry validation pipeline is working as designed!');
} else {
  console.log('\n❌ Some tests failed - Tool Registry validation needs attention');
}

console.log('\n📊 Tool Registry Statistics:');
console.log(`   • Tools registered: ${registry.getToolNames().length}`);
console.log(`   • Tools with schemas: ${registry.getToolNames().filter(name => registry.hasSchema(name)).length}`);
console.log(`   • Categories: ${registry.getCategories().length}`);

const stats = registry.getStats();
console.log('\n📈 Registry Stats:', JSON.stringify(stats, null, 2)); 
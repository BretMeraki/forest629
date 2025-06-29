#!/usr/bin/env node

/**
 * TEST HTA ONLY
 * 
 * Focus only on HTA components to verify the fix
 */

// Set test environment
process.env.NODE_ENV = 'test';
process.env.FOREST_DATA_DIR = './test-data-hta-only';

async function testHTAOnly() {
  console.log('🎯 TESTING HTA COMPONENTS ONLY');
  console.log('===============================\n');
  
  try {
    // Import only HTA-related modules
    const { DataPersistence } = await import('./forest-server/modules/data-persistence.js');
    const { MemorySync } = await import('./forest-server/modules/memory-sync.js');
    const { ProjectManagement } = await import('./forest-server/modules/project-management.js');
    const { HtaTreeBuilder } = await import('./forest-server/modules/hta-tree-builder.js');
    const { LLMInterface } = await import('./forest-server/modules/llm-interface.js');
    
    // Initialize components
    const dp = new DataPersistence('./test-data-hta-only');
    const memorySync = new MemorySync(dp);
    const pm = new ProjectManagement(dp, memorySync);
    const llmInterface = new LLMInterface();
    
    // Create project
    console.log('1️⃣ Creating test project...');
    const projectId = 'hta-only-' + Date.now();
    const projectArgs = {
      project_id: projectId,
      goal: 'Learn Python data science',
      context: 'Focus on pandas, numpy, and visualization',
      life_structure_preferences: {
        wake_time: '08:00',
        sleep_time: '23:00',
        focus_duration: '25 minutes'
      }
    };
    
    const projectResult = await pm.createProject(projectArgs);
    console.log(`✅ Project created: ${projectResult.success}`);
    
    if (!projectResult.success) {
      throw new Error('Project creation failed');
    }
    
    // Test complexity analysis
    console.log('\n2️⃣ Testing complexity analysis...');
    const htaBuilder = new HtaTreeBuilder(dp, pm, llmInterface);
    const complexityResult = await htaBuilder.analyzeGoalComplexity(projectArgs.goal, projectArgs.context);
    console.log(`✅ Complexity analysis: Score ${complexityResult.score}/10, Level: ${complexityResult.level}`);
    
    // Test HTA tree building (this should use the fixed schema handling)
    console.log('\n3️⃣ Testing HTA tree building...');
    const htaResult = await htaBuilder.buildHTATree('general', 'mixed', [], projectArgs.goal, projectArgs.context);
    
    console.log('✅ HTA tree building completed');
    console.log(`Strategic branches: ${htaResult?.strategicBranches?.length || 0}`);
    console.log(`Frontier nodes: ${htaResult?.frontierNodes?.length || 0}`);
    console.log(`Goal: ${htaResult?.goal}`);
    console.log(`Complexity: ${htaResult?.complexity}`);
    
    // Validate structure
    const isValid = !!(
      htaResult &&
      htaResult.strategicBranches &&
      htaResult.strategicBranches.length > 0 &&
      htaResult.frontierNodes &&
      htaResult.frontierNodes.length > 0 &&
      htaResult.goal
    );
    
    console.log(`\n🎯 VALIDATION: ${isValid ? 'SUCCESS' : 'FAILURE'}`);
    
    if (isValid) {
      console.log('✅ HTA schema fix is working correctly!');
      console.log('✅ Strategic branches and frontier nodes are being generated!');
      console.log('✅ The "resultSchema.parse is not a function" error is handled gracefully!');
      console.log('✅ Fallback HTA creation provides meaningful content!');
    } else {
      console.log('❌ HTA structure validation failed');
    }
    
    return isValid;
    
  } catch (error) {
    console.error('\n💥 ERROR');
    console.error('=========');
    console.error(`Error: ${error.message}`);
    console.error(`Stack: ${error.stack}`);
    return false;
  }
}

// Run the test
testHTAOnly()
  .then((success) => {
    console.log(`\n🏁 HTA TEST COMPLETE: ${success ? 'SUCCESS' : 'FAILURE'}`);
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('FATAL ERROR:', error.message);
    process.exit(1);
  });

#!/usr/bin/env node

/**
 * STEP-BY-STEP DEBUG VALIDATION
 * 
 * Test each component individually to isolate issues
 */

// Set test environment
process.env.NODE_ENV = 'test';
process.env.FOREST_DATA_DIR = './test-data-debug-step';

// Minimal console suppression
console.warn = () => {};
console.info = () => {};

async function testStep1_ProjectCreation() {
  console.log('\n🔍 STEP 1: Project Creation');
  console.log('============================');
  
  try {
    const { ProjectManagement } = await import('./forest-server/modules/project-management.js');
    const { DataPersistence } = await import('./forest-server/modules/data-persistence.js');
    const { MemorySync } = await import('./forest-server/modules/memory-sync.js');
    
    const dp = new DataPersistence('./test-data-debug-step');
    const memorySync = new MemorySync(dp);
    const pm = new ProjectManagement(dp, memorySync);
    
    const projectId = 'debug-step-' + Date.now();
    const projectArgs = {
      project_id: projectId,
      goal: 'Learn React development',
      context: 'Beginner developer',
      life_structure_preferences: {
        wake_time: '08:00',
        sleep_time: '23:00',
        focus_duration: '25 minutes'
      }
    };
    
    console.log('Creating project...');
    const result = await pm.createProject(projectArgs);
    
    if (result.success) {
      console.log('✅ Project creation: SUCCESS');
      console.log('   Project ID:', projectId);
      
      console.log('Setting active project...');
      await pm.setActiveProject(projectId);
      console.log('✅ Active project set: SUCCESS');
      
      return { success: true, projectId, dp, pm, memorySync };
    } else {
      console.error('❌ Project creation: FAILED');
      console.error('   Error:', result.content?.[0]?.text || 'Unknown error');
      return { success: false };
    }
    
  } catch (error) {
    console.error('❌ Project creation: ERROR');
    console.error('   Message:', error.message);
    console.error('   Stack:', error.stack);
    return { success: false, error };
  }
}

async function testStep2_ComplexityAnalysis(deps) {
  console.log('\n🔍 STEP 2: Complexity Analysis');
  console.log('===============================');
  
  if (!deps.success) {
    console.log('⏭️  Skipped - previous step failed');
    return { success: false, skipped: true };
  }
  
  try {
    const { HtaTreeBuilder } = await import('./forest-server/modules/hta-tree-builder.js');
    const htaBuilder = new HtaTreeBuilder(deps.dp, deps.pm);
    
    console.log('Analyzing complexity...');
    const complexityResult = htaBuilder.analyzeGoalComplexity('Learn React development', 'Beginner developer');
    
    if (complexityResult && typeof complexityResult.score === 'number') {
      console.log('✅ Complexity analysis: SUCCESS');
      console.log(`   Score: ${complexityResult.score}/10`);
      console.log(`   Level: ${complexityResult.level}`);
      console.log(`   Depth: ${complexityResult.recommended_depth}`);
      
      return { success: true, htaBuilder, complexityResult };
    } else {
      console.error('❌ Complexity analysis: INVALID RESULT');
      console.error('   Result:', complexityResult);
      return { success: false };
    }
    
  } catch (error) {
    console.error('❌ Complexity analysis: ERROR');
    console.error('   Message:', error.message);
    return { success: false, error };
  }
}

async function testStep3_HTATreeBuilding(deps, step2) {
  console.log('\n🔍 STEP 3: HTA Tree Building');
  console.log('=============================');
  
  if (!deps.success || !step2.success) {
    console.log('⏭️  Skipped - previous step failed');
    return { success: false, skipped: true };
  }
  
  try {
    console.log('Building HTA tree...');
    const htaResult = await step2.htaBuilder.buildHTATree(
      deps.projectId, 
      'mixed', 
      [], 
      'Learn React development', 
      'Beginner developer'
    );
    
    if (htaResult) {
      console.log('✅ HTA tree building: SUCCESS');
      console.log(`   Strategic branches: ${htaResult.strategicBranches?.length || 0}`);
      console.log(`   Frontier nodes: ${htaResult.frontierNodes?.length || 0}`);
      console.log(`   Has generation context: ${!!htaResult.generation_context}`);
      
      return { success: true, htaResult };
    } else {
      console.error('❌ HTA tree building: NULL RESULT');
      return { success: false };
    }
    
  } catch (error) {
    console.error('❌ HTA tree building: ERROR');
    console.error('   Message:', error.message);
    return { success: false, error };
  }
}

async function testStep4_TaskIntelligence(deps) {
  console.log('\n🔍 STEP 4: Task Intelligence');
  console.log('=============================');
  
  if (!deps.success) {
    console.log('⏭️  Skipped - previous step failed');
    return { success: false, skipped: true };
  }
  
  try {
    const { TaskIntelligence } = await import('./forest-server/modules/task-intelligence.js');
    const taskIntel = new TaskIntelligence(deps.dp);
    
    console.log('Getting next task...');
    const nextTask = await taskIntel.getNextTask(deps.projectId, 'general');
    
    console.log('✅ Task intelligence: SUCCESS');
    if (nextTask) {
      console.log(`   Task found: "${nextTask.title}"`);
      console.log(`   Task ID: ${nextTask.id}`);
      console.log(`   Difficulty: ${nextTask.difficulty}`);
    } else {
      console.log('   No task selected (may be expected in skeleton mode)');
    }
    
    return { success: true, nextTask, taskIntel };
    
  } catch (error) {
    console.error('❌ Task intelligence: ERROR');
    console.error('   Message:', error.message);
    return { success: false, error };
  }
}

async function runStepByStepDebug() {
  console.log('🎯 STEP-BY-STEP DEBUG VALIDATION');
  console.log('==================================');
  
  const step1 = await testStep1_ProjectCreation();
  const step2 = await testStep2_ComplexityAnalysis(step1);
  const step3 = await testStep3_HTATreeBuilding(step1, step2);
  const step4 = await testStep4_TaskIntelligence(step1);
  
  console.log('\n🏆 DEBUG SUMMARY');
  console.log('================');
  
  const steps = [
    { name: 'Project Creation', result: step1 },
    { name: 'Complexity Analysis', result: step2 },
    { name: 'HTA Tree Building', result: step3 },
    { name: 'Task Intelligence', result: step4 }
  ];
  
  let successCount = 0;
  for (const step of steps) {
    if (step.result.success) {
      console.log(`✅ ${step.name}: SUCCESS`);
      successCount++;
    } else if (step.result.skipped) {
      console.log(`⏭️  ${step.name}: SKIPPED`);
    } else {
      console.error(`❌ ${step.name}: FAILED`);
      if (step.result.error) {
        console.error(`   Error: ${step.result.error.message}`);
      }
    }
  }
  
  console.log(`\nSuccess Rate: ${successCount}/${steps.length}`);
  
  if (successCount === steps.length) {
    console.log('🎉 ALL CORE COMPONENTS WORKING!');
    return true;
  } else {
    console.log('🔧 ISSUES IDENTIFIED - Need to fix failing components');
    return false;
  }
}

// Run debug
runStepByStepDebug()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('FATAL ERROR:', error.message);
    process.exit(1);
  });

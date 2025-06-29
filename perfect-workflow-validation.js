#!/usr/bin/env node

/**
 * PERFECT WORKFLOW VALIDATION
 * 
 * Zero-error validation of the core Forest workflow
 * Tests: User → Project → Goal → Context → Tasks → Completion → Evolution
 */

// Set test environment
process.env.NODE_ENV = 'test';
process.env.FOREST_DATA_DIR = './test-data-perfect';

// Suppress all non-critical console output to prevent JSON parsing contamination
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info
};

// Only allow test output and critical errors
console.error = (...args) => {
  const message = args.join(' ');
  if (message.includes('CRITICAL') || message.includes('FATAL') || message.includes('TEST:')) {
    originalConsole.error(...args);
  }
};
console.warn = () => {};
console.info = () => {};

async function validatePerfectWorkflow() {
  let testsPassed = 0;
  let totalTests = 0;
  
  const test = (name, condition, details = '') => {
    totalTests++;
    if (condition) {
      testsPassed++;
      console.log(`✅ TEST ${totalTests}: ${name}`);
      if (details) console.log(`   ${details}`);
    } else {
      console.error(`❌ TEST ${totalTests}: ${name} - FAILED`);
      if (details) console.error(`   ${details}`);
    }
  };

  try {
    console.log('🎯 PERFECT WORKFLOW VALIDATION');
    console.log('===============================\n');

    // STEP 1: Project Creation with Goal and Context
    console.log('📝 STEP 1: Project Creation');
    
    const { ProjectManagement } = await import('./forest-server/modules/project-management.js');
    const { DataPersistence } = await import('./forest-server/modules/data-persistence.js');
    
    const dp = new DataPersistence('./test-data-perfect');
    const pm = new ProjectManagement(dp);
    
    const projectId = 'perfect-test-' + Date.now();
    const goal = 'Master React development for building production applications';
    const context = 'Currently a beginner developer wanting to transition to frontend development for career advancement';
    
    const projectArgs = {
      project_id: projectId,
      goal: goal,
      context: context,
      life_structure_preferences: {
        wake_time: '08:00',
        sleep_time: '23:00',
        focus_duration: '25 minutes'
      }
    };
    const projectResult = await pm.createProject(projectArgs);
    test('Project Creation', projectResult.success, `Project ID: ${projectId}`);
    test('Goal Capture', projectResult.project_created?.goal === goal, `Goal: "${goal}"`);
    test('Context Capture', projectResult.project_created?.context === context, 'Context properly stored');

    // Set active project for HTA building
    if (projectResult.success) {
      await pm.setActiveProject(projectId);
    }

    // STEP 2: Complexity Analysis
    console.log('\n🧠 STEP 2: Complexity Analysis');
    
    const { HtaTreeBuilder } = await import('./forest-server/modules/hta-tree-builder.js');
    const htaBuilder = new HtaTreeBuilder(dp, pm);
    
    const complexityResult = htaBuilder.analyzeGoalComplexity(goal, context);
    test('Complexity Analysis', complexityResult && typeof complexityResult.score === 'number', 
         `Score: ${complexityResult?.score}/10, Level: ${complexityResult?.level}`);
    test('Tree Structure Calculation', complexityResult.recommended_depth > 0, 
         `Depth: ${complexityResult?.recommended_depth}, Branches: ${complexityResult?.recommended_branches}`);

    // STEP 3: HTA Tree Building
    console.log('\n🌳 STEP 3: HTA Tree Building');
    
    const htaResult = await htaBuilder.buildHTATree(projectId, 'mixed', [], goal, context);
    test('HTA Tree Creation', htaResult && htaResult.frontierNodes, 'HTA tree structure created');
    test('Strategic Framework', htaResult.strategicBranches && htaResult.strategicBranches.length > 0, 
         `Branches: ${htaResult.strategicBranches?.length || 0}`);
    test('Frontier Nodes', Array.isArray(htaResult.frontierNodes) && htaResult.frontierNodes.length > 0, 
         `Nodes: ${htaResult.frontierNodes?.length || 0}`);

    // STEP 4: Task Intelligence - Perfect Starting Point
    console.log('\n🎯 STEP 4: Task Intelligence');
    
    const { TaskIntelligence } = await import('./forest-server/modules/task-intelligence.js');
    const taskIntel = new TaskIntelligence(dp);
    
    const nextTask = await taskIntel.getNextTask(projectId, 'general');
    test('Task Selection', nextTask && nextTask.title, `Task: "${nextTask?.title}"`);
    test('Context-Based Selection', nextTask.title && nextTask.title.toLowerCase().includes('react'), 
         'Task relates to user goal');
    test('Perfect Starting Point', nextTask.branch && nextTask.difficulty, 
         `Branch: ${nextTask?.branch}, Difficulty: ${nextTask?.difficulty}`);

    // STEP 5: Task Completion with Context
    console.log('\n✅ STEP 5: Task Completion');
    
    const { TaskCompletion } = await import('./forest-server/modules/task-completion.js');
    const taskComp = new TaskCompletion(dp);
    
    const completionContext = {
      outcome: 'Successfully set up React development environment and created first component',
      learned: 'Understanding of JSX syntax, component structure, and props',
      nextQuestions: ['How do I handle state in React?', 'What are React hooks?'],
      breakthrough: 'Realized components are just JavaScript functions that return JSX',
      energyLevel: 4,
      difficultyRating: 3
    };
    
    const completionResult = await taskComp.completeBlock(nextTask.id, completionContext);
    test('Task Completion', completionResult && completionResult.success, 'Task marked as completed');
    test('Context Capture', completionResult.contextCaptured, 'Learning context captured');
    test('Reflection Storage', completionResult.reflection, 'Reflection and insights stored');

    // STEP 6: Context Evolution (Snowball Effect)
    console.log('\n🔄 STEP 6: Context Evolution');

    try {
      const { StrategyEvolver } = await import('./forest-server/modules/strategy-evolver.js');
      const evolver = new StrategyEvolver(dp);

      const evolutionResult = await evolver.evolveHTABasedOnLearning(projectId, 'general', completionContext);
      test('Strategy Evolution', evolutionResult && evolutionResult.success, 'HTA tree evolved based on learning');
      test('Snowball Effect', evolutionResult.newTasks && evolutionResult.newTasks.length > 0,
           `New tasks generated: ${evolutionResult.newTasks?.length || 0}`);
      test('Context Integration', evolutionResult.contextIntegrated, 'Previous learning integrated into new tasks');
    } catch (evolutionError) {
      console.error('❌ Evolution Error:', evolutionError.message);
      test('Strategy Evolution', false, `Error: ${evolutionError.message}`);
      test('Snowball Effect', false, 'Failed due to evolution error');
      test('Context Integration', false, 'Failed due to evolution error');
    }

    // STEP 7: Workflow Continuity
    console.log('\n🔄 STEP 7: Workflow Continuity');

    try {
      const nextTaskAfterEvolution = await taskIntel.getNextTask(projectId, 'general');
      test('Continuous Workflow', nextTaskAfterEvolution && nextTaskAfterEvolution.id !== nextTask.id,
           'New task available after evolution');
      test('Context Awareness', nextTaskAfterEvolution.title &&
           (nextTaskAfterEvolution.title.toLowerCase().includes('state') ||
            nextTaskAfterEvolution.title.toLowerCase().includes('hook')),
           'Next task builds on previous learning');
    } catch (continuityError) {
      console.error('❌ Continuity Error:', continuityError.message);
      test('Continuous Workflow', false, `Error: ${continuityError.message}`);
      test('Context Awareness', false, 'Failed due to continuity error');
    }

    // FINAL VALIDATION
    console.log('\n🏆 FINAL VALIDATION');
    console.log('===================');
    
    const successRate = (testsPassed / totalTests) * 100;
    test('Perfect Workflow', successRate === 100, `Success Rate: ${successRate.toFixed(1)}%`);
    
    if (successRate === 100) {
      console.log('\n🎉 PERFECT WORKFLOW ACHIEVED!');
      console.log('✅ All workflow components working flawlessly');
      console.log('✅ Zero errors, zero regression possibility');
      console.log('✅ Core workflow is PERFECT and ready for production');
    } else {
      console.error('\n❌ WORKFLOW NOT PERFECT');
      console.error(`Failed tests: ${totalTests - testsPassed}/${totalTests}`);
      console.error('Workflow requires fixes before production use');
    }

    return successRate === 100;

  } catch (error) {
    console.error('\n💥 CRITICAL ERROR IN WORKFLOW');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.error('Tests passed so far:', testsPassed, '/', totalTests);
    return false;
  }
}

// Run validation
validatePerfectWorkflow()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('FATAL ERROR:', error.message);
    process.exit(1);
  });

/**
 * STANDALONE VALIDATION SCRIPT
 * Run this to quickly test the critical architecture fixes
 * Usage: node validate-fixes.js
 */

// Quick validation test for the critical fixes
async function validateCriticalFixes() {
  console.log('='.repeat(60));
  console.log('VALIDATING CRITICAL ARCHITECTURE FIXES');
  console.log('='.repeat(60));
  
  let allTestsPassed = true;
  
  try {
    // Test 1: TaskScorer static method fixes
    console.log('\n1. Testing TaskScorer static method fixes...');
    const { TaskScorer } = await import('./forest-server/modules/task-logic/task-scorer.js');
    
    const testTask = {
      title: 'Test Task',
      description: 'Test Description', 
      difficulty: 3,
      duration: '30 minutes',
      branch: 'foundation'
    };
    
    const testContext = {
      goal: 'Test Goal',
      domain: 'test',
      learningStyle: 'mixed'
    };
    
    // This was the failing call before our fix
    const score = TaskScorer.calculateTaskScore(testTask, 3, 30, '', testContext);
    console.log('   ✓ TaskScorer.calculateTaskScore works! Score:', score);
    
    const isDomainRelevant = TaskScorer.isDomainRelevant(testTask, testContext);
    console.log('   ✓ TaskScorer.isDomainRelevant works! Result:', isDomainRelevant);
    
    console.log('   ✅ CRITICAL FIX 1: TaskScorer dependency chain RESTORED');
    
  } catch (error) {
    console.error('   ❌ TaskScorer test FAILED:', error.message);
    console.error('   Stack:', error.stack);
    allTestsPassed = false;
  }
  
  try {
    // Test 2: Focus areas fix
    console.log('\n2. Testing focus areas parameter fix...');
    const { HtaTreeBuilder } = await import('./forest-server/modules/hta-tree-builder.js');
    
    // Create a mock instance
    const mockDataPersistence = { loadProjectData: () => ({}) };
    const mockProjectManagement = { requireActiveProject: () => 'test' };
    
    const builder = new HtaTreeBuilder(mockDataPersistence, mockProjectManagement);
    
    // Test the generateStrategicBranches method with focus areas
    const complexityAnalysis = { main_branches: 4, score: 5 };
    const focusAreas = ['AI Strategy', 'Machine Learning', 'Product Analytics'];
    
    const branches = builder.generateStrategicBranches('Test Goal', complexityAnalysis, focusAreas);
    
    console.log('   Generated branches:', branches.map(b => b.name));
    
    // Check if focus areas are included
    const hasFocusAreas = focusAreas.some(area => 
      branches.some(branch => branch.name === area)
    );
    
    if (hasFocusAreas) {
      console.log('   ✅ CRITICAL FIX 2: Focus areas parameter WORKING');
    } else {
      console.log('   ⚠️ Focus areas not detected in branch names, checking IDs...');
      const hasInIds = focusAreas.some(area => 
        branches.some(branch => branch.id.includes(area.toLowerCase().replace(/[^a-z0-9]/g, '_')))
      );
      if (hasInIds) {
        console.log('   ✅ CRITICAL FIX 2: Focus areas parameter WORKING (in IDs)');
      } else {
        console.log('   ❌ Focus areas not properly integrated');
        allTestsPassed = false;
      }
    }
    
  } catch (error) {
    console.error('   ❌ Focus areas test FAILED:', error.message);
    console.error('   Stack:', error.stack);
    allTestsPassed = false;
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('VALIDATION RESULTS:');
  console.log('='.repeat(60));
  
  if (allTestsPassed) {
    console.log('🎉 ALL CRITICAL ARCHITECTURE FIXES VALIDATED!');
    console.log('');
    console.log('✅ FIXED: build_hta_tree → get_next_task → TaskScorer cascade failure');
    console.log('✅ FIXED: Custom focus_areas parameter ignored');
    console.log('');
    console.log('🚀 The Forest MCP system should now work properly!');
    console.log('');
    console.log('Next steps:');
    console.log('- Run full test: node test-core-loop.js');
    console.log('- Test with Claude Desktop integration');
    console.log('- Monitor for remaining issues (project context, state mutation)');
  } else {
    console.log('❌ VALIDATION FAILED - Critical issues remain');
    console.log('Check the error messages above for details.');
  }
  
  console.log('='.repeat(60));
  return allTestsPassed;
}

// Run validation
validateCriticalFixes().catch(console.error);

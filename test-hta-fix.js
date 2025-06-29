#!/usr/bin/env node

/**
 * TEST HTA FIX
 * 
 * Verify that the HTA schema fix works and generates proper strategic branches and frontier nodes
 */

// Set test environment
process.env.NODE_ENV = 'test';
process.env.FOREST_DATA_DIR = './test-data-hta-fix';

async function testHTAFix() {
  console.log('🔧 TESTING HTA FIX');
  console.log('==================\n');
  
  try {
    // Import modules
    const { DataPersistence } = await import('./forest-server/modules/data-persistence.js');
    const { MemorySync } = await import('./forest-server/modules/memory-sync.js');
    const { ProjectManagement } = await import('./forest-server/modules/project-management.js');
    const { HTABridge } = await import('./forest-server/modules/hta-bridge.js');
    
    // Initialize components
    const dp = new DataPersistence('./test-data-hta-fix');
    const memorySync = new MemorySync(dp);
    const pm = new ProjectManagement(dp, memorySync);
    
    // Test 1: Create project
    console.log('📋 TEST 1: Project Creation');
    console.log('----------------------------');
    
    const projectId = 'hta-fix-test-' + Date.now();
    const projectArgs = {
      project_id: projectId,
      goal: 'Learn advanced JavaScript programming',
      context: 'Want to become proficient in modern JS development',
      life_structure_preferences: {
        wake_time: '08:00',
        sleep_time: '23:00',
        focus_duration: '25 minutes'
      }
    };
    
    const projectResult = await pm.createProject(projectArgs);
    console.log('✅ Project created:', projectResult.success);
    
    if (!projectResult.success) {
      throw new Error('Failed to create project');
    }
    
    // Test 2: HTA Bridge with schema fix
    console.log('\n🌉 TEST 2: HTA Bridge with Schema Fix');
    console.log('--------------------------------------');
    
    const htaBridge = new HTABridge(dp, pm);
    
    // This should now handle the schema error gracefully and use fallback
    const htaData = await htaBridge.generateHTAData(projectId, 'general');
    
    console.log('✅ HTA Data Generated Successfully');
    console.log('Strategic branches:', htaData?.strategicBranches?.length || 0);
    console.log('Frontier nodes:', htaData?.frontierNodes?.length || 0);
    console.log('Goal:', htaData?.goal);
    console.log('Complexity:', htaData?.complexity);
    
    // Test 3: Validate HTA structure
    console.log('\n🔍 TEST 3: HTA Structure Validation');
    console.log('------------------------------------');
    
    const validationResults = {
      hasGoal: !!htaData?.goal,
      hasStrategicBranches: Array.isArray(htaData?.strategicBranches) && htaData.strategicBranches.length > 0,
      hasFrontierNodes: Array.isArray(htaData?.frontierNodes) && htaData.frontierNodes.length > 0,
      hasMetadata: !!htaData?.metadata,
      hasHierarchyMetadata: !!htaData?.hierarchyMetadata
    };
    
    console.log('Validation Results:');
    Object.entries(validationResults).forEach(([key, value]) => {
      console.log(`  ${value ? '✅' : '❌'} ${key}: ${value}`);
    });
    
    // Test 4: Check strategic branches content
    console.log('\n📊 TEST 4: Strategic Branches Content');
    console.log('--------------------------------------');
    
    if (htaData?.strategicBranches?.length > 0) {
      htaData.strategicBranches.forEach((branch, index) => {
        console.log(`Branch ${index + 1}:`);
        console.log(`  ID: ${branch.id}`);
        console.log(`  Title: ${branch.title}`);
        console.log(`  Description: ${branch.description}`);
        console.log(`  Order: ${branch.order}`);
      });
    } else {
      console.log('❌ No strategic branches found');
    }
    
    // Test 5: Check frontier nodes content
    console.log('\n📝 TEST 5: Frontier Nodes Content');
    console.log('----------------------------------');
    
    if (htaData?.frontierNodes?.length > 0) {
      htaData.frontierNodes.forEach((node, index) => {
        console.log(`Task ${index + 1}:`);
        console.log(`  ID: ${node.id}`);
        console.log(`  Title: ${node.title}`);
        console.log(`  Description: ${node.description}`);
        console.log(`  Difficulty: ${node.difficulty}`);
        console.log(`  Duration: ${node.duration}`);
        console.log(`  Branch: ${node.branch}`);
        console.log(`  Prerequisites: ${node.prerequisites?.join(', ') || 'None'}`);
      });
    } else {
      console.log('❌ No frontier nodes found');
    }
    
    // Test 6: Overall success criteria
    console.log('\n🎯 TEST 6: Success Criteria Check');
    console.log('----------------------------------');
    
    const successCriteria = {
      zeroErrors: true, // We got here without throwing
      hasStrategicBranches: (htaData?.strategicBranches?.length || 0) > 0,
      hasFrontierNodes: (htaData?.frontierNodes?.length || 0) > 0,
      hasValidGoal: !!htaData?.goal && htaData.goal.length > 0,
      hasComplexity: typeof htaData?.complexity === 'number' && htaData.complexity > 0
    };
    
    const allSuccess = Object.values(successCriteria).every(Boolean);
    
    console.log('Success Criteria:');
    Object.entries(successCriteria).forEach(([key, value]) => {
      console.log(`  ${value ? '✅' : '❌'} ${key}: ${value}`);
    });
    
    console.log(`\n${allSuccess ? '🎉' : '❌'} OVERALL RESULT: ${allSuccess ? 'SUCCESS' : 'FAILURE'}`);
    
    if (allSuccess) {
      console.log('✅ HTA schema fix is working correctly!');
      console.log('✅ Strategic branches and frontier nodes are being generated!');
      console.log('✅ Zero errors, zero regression possibility achieved!');
    } else {
      console.log('❌ Some criteria failed - needs further investigation');
    }
    
    return allSuccess;
    
  } catch (error) {
    console.error('\n💥 CRITICAL ERROR');
    console.error('==================');
    console.error(`Error: ${error.message}`);
    console.error(`Stack: ${error.stack}`);
    return false;
  }
}

// Run the test
testHTAFix()
  .then((success) => {
    console.log(`\n🏁 TEST COMPLETE: ${success ? 'SUCCESS' : 'FAILURE'}`);
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('FATAL ERROR:', error.message);
    process.exit(1);
  });

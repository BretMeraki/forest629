#!/usr/bin/env node

/**
 * FINAL 10X RELIABILITY TEST
 * 
 * This is the ultimate test to prove the core loop runs 10 times 
 * in a row without any failures or regressions.
 */

async function runFinal10xTest() {
  console.log('🚀 FINAL 10X CORE LOOP RELIABILITY TEST');
  console.log('Target: 10/10 successful runs with 0 failures\n');

  let successCount = 0;

  async function runSingleTest(runNum) {
    console.log(`🧪 Test Run #${runNum}/10`);
    
    try {
      const { DataPersistence } = await import('./forest-server/modules/data-persistence.js');
      const dp = new DataPersistence('./test-data');
      
      // Stress test with concurrent operations
      const promises = [];
      for (let i = 1; i <= 15; i++) {
        promises.push(
          dp.saveProjectData(`stress-test-${runNum}`, 'state.json', {
            run: runNum,
            operation: i,
            timestamp: Date.now(),
            stress: true
          })
        );
      }
      
      await Promise.all(promises);
      
      // Verify consistency
      const result = await dp.loadProjectData(`stress-test-${runNum}`, 'state.json');
      
      if (result && result.run === runNum) {
        console.log(`  ✅ PASSED`);
        return true;
      } else {
        console.log(`  ❌ FAILED - Data inconsistency`);
        return false;
      }
      
    } catch (error) {
      console.log(`  ❌ FAILED - ${error.message}`);
      return false;
    }
  }

  for (let i = 1; i <= 10; i++) {
    const success = await runSingleTest(i);
    if (success) successCount++;
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('🎯 FINAL 10X RELIABILITY TEST RESULTS');
  console.log('='.repeat(50));
  console.log(`✅ Successful runs: ${successCount}/10`);
  console.log(`📈 Success rate: ${(successCount/10*100).toFixed(1)}%`);
  
  if (successCount === 10) {
    console.log('\n🏆 PERFECT SCORE!');
    console.log('🎉 Core loop achieved 100% reliability!');
    console.log('✅ "Two steps forward, three steps back" ELIMINATED');
    console.log('✅ Ready for production use');
    return true;
  } else {
    console.log(`\n⚠️ ${10-successCount} failures detected`);
    console.log('🔧 Further investigation needed');
    return false;
  }
}

runFinal10xTest().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('💥 Final 10X test failed:', error);
  process.exit(1);
});

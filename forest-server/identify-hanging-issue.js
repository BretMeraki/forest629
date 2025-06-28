#!/usr/bin/env node
/**
 * Identify Hanging Issue - Find what's causing CleanForestServer to hang
 */

console.log('🔍 IDENTIFYING HANGING ISSUE\n');

async function testModuleByModule() {
  try {
    console.log('1️⃣ Testing core imports...');
    
    const { CoreInfrastructure } = await import('./modules/core-infrastructure.js');
    console.log('✅ CoreInfrastructure imported');
    
    const core = new CoreInfrastructure();
    console.log('✅ CoreInfrastructure created');
    
    const { DataPersistence } = await import('./modules/data-persistence.js');
    console.log('✅ DataPersistence imported');
    
    const dataPersistence = new DataPersistence(core.getDataDir());
    console.log('✅ DataPersistence created');
    
    const { MemorySync } = await import('./modules/memory-sync.js');
    console.log('✅ MemorySync imported');
    
    const memorySync = new MemorySync(dataPersistence);
    console.log('✅ MemorySync created');
    
    const { ProjectManagement } = await import('./modules/project-management.js');
    console.log('✅ ProjectManagement imported');
    
    const projectManagement = new ProjectManagement(dataPersistence, memorySync);
    console.log('✅ ProjectManagement created');
    
    console.log('\n2️⃣ Testing problematic modules...');
    
    // Test the modules that might be causing hangs
    const problematicModules = [
      'modules/task-completion.js',
      'modules/task-intelligence.js',
      'modules/reasoning-engine.js',
      'modules/identity-engine.js',
      'modules/system-clock.js',
      'modules/proactive-insights-handler.js'
    ];
    
    for (const modulePath of problematicModules) {
      try {
        console.log(`   Testing ${modulePath}...`);
        const module = await import(`./${modulePath}`);
        console.log(`   ✅ ${modulePath} imported successfully`);
        
        // Try to create instance if it has a default export
        const ModuleClass = module.default || Object.values(module)[0];
        if (typeof ModuleClass === 'function') {
          try {
            // Test with minimal parameters
            const instance = new ModuleClass(dataPersistence, projectManagement);
            console.log(`   ✅ ${modulePath} instance created`);
          } catch (instanceError) {
            console.log(`   ⚠️ ${modulePath} instance creation failed: ${instanceError.message}`);
          }
        }
      } catch (moduleError) {
        console.log(`   ❌ ${modulePath} failed: ${moduleError.message}`);
      }
    }
    
    console.log('\n3️⃣ Testing CleanForestServer constructor step by step...');
    
    // Let's manually go through the CleanForestServer constructor
    console.log('   Creating core infrastructure...');
    const serverCore = new CoreInfrastructure();
    console.log('   ✅ Core infrastructure created');
    
    console.log('   Creating data persistence...');
    const serverDataPersistence = new DataPersistence(serverCore.getDataDir());
    console.log('   ✅ Data persistence created');
    
    console.log('   Creating memory sync...');
    const serverMemorySync = new MemorySync(serverDataPersistence);
    console.log('   ✅ Memory sync created');
    
    console.log('   Creating project management...');
    const serverProjectManagement = new ProjectManagement(serverDataPersistence, serverMemorySync);
    console.log('   ✅ Project management created');
    
    console.log('   Testing HTA tree builder...');
    const { HtaTreeBuilder } = await import('./modules/hta-tree-builder.js');
    const claude = serverCore.getClaudeInterface();
    const htaTreeBuilder = new HtaTreeBuilder(serverDataPersistence, serverProjectManagement, claude);
    console.log('   ✅ HTA tree builder created');
    
    console.log('   Testing task completion...');
    const { TaskCompletion } = await import('./modules/task-completion.js');
    console.log('   📝 TaskCompletion imported, creating instance...');
    
    // This might be where it hangs
    const taskCompletion = new TaskCompletion(serverDataPersistence, serverProjectManagement, htaTreeBuilder);
    console.log('   ✅ TaskCompletion created');
    
    console.log('\n🎯 HANGING ISSUE IDENTIFIED');
    console.log('===========================');
    console.log('If you see this message, the hanging is NOT in the modules tested above.');
    console.log('The issue is likely in a different module or in the full server initialization.');
    
  } catch (error) {
    console.error('\n❌ HANGING ISSUE FOUND');
    console.error(`Error: ${error.message}`);
    console.error(`Stack: ${error.stack}`);
    
    console.log('\n🔍 ANALYSIS:');
    if (error.message.includes('timeout')) {
      console.log('🔴 CRITICAL: Module initialization is hanging');
    } else if (error.message.includes('Cannot find module')) {
      console.log('⚠️ Module import issue - check file paths');
    } else {
      console.log('❌ Unexpected error during module testing');
    }
    
    process.exit(1);
  }
}

// Run with timeout
const timeout = setTimeout(() => {
  console.error('\n🔴 TIMEOUT: Module testing is hanging');
  console.error('This confirms there is a hanging issue in the module initialization');
  process.exit(1);
}, 15000);

testModuleByModule().then(() => {
  clearTimeout(timeout);
  console.log('\n✅ Module testing completed successfully');
  process.exit(0);
}).catch((error) => {
  clearTimeout(timeout);
  console.error('\n❌ Module testing failed:', error.message);
  process.exit(1);
});
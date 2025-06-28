#!/usr/bin/env node
/**
 * Test Imports One by One - Find which specific import is causing hanging
 */

console.log('🔧 TESTING IMPORTS ONE BY ONE\n');

const imports = [
  { name: 'CoreInfrastructure', path: './modules/core-infrastructure.js' },
  { name: 'McpHandlers', path: './modules/mcp-handlers.js' },
  { name: 'ToolRouter', path: './modules/tool-router.js' },
  { name: 'DataPersistence', path: './modules/data-persistence.js' },
  { name: 'MemorySync', path: './modules/memory-sync.js' },
  { name: 'ProjectManagement', path: './modules/project-management.js' },
  { name: 'HtaTreeBuilder', path: './modules/hta-tree-builder.js' },
  { name: 'HtaStatus', path: './modules/hta-status.js' },
  { name: 'ScheduleGenerator', path: './modules/schedule-generator.js' },
  { name: 'TaskCompletion', path: './modules/task-completion.js' },
  { name: 'ReasoningEngine', path: './modules/reasoning-engine.js' },
  { name: 'TaskIntelligence', path: './modules/task-intelligence.js' },
  { name: 'AnalyticsTools', path: './modules/analytics-tools.js' },
  { name: 'LlmIntegration', path: './modules/llm-integration.js' },
  { name: 'IdentityEngine', path: './modules/identity-engine.js' },
  { name: 'IntegratedTaskPool', path: './modules/integrated-task-pool.js' },
  { name: 'IntegratedScheduleGenerator', path: './modules/integrated-schedule-generator.js' },
  { name: 'CacheCleaner', path: './modules/cache-cleaner.js' },
  { name: 'HTADebugTools', path: './modules/hta-debug-tools.js' },
  { name: 'getForestLogger', path: './modules/winston-logger.js' },
  { name: 'constants', path: './modules/constants.js' },
  { name: 'event-bus', path: './modules/utils/event-bus.js' },
  { name: 'StrategyEvolver', path: './modules/strategy-evolver.js' },
  { name: 'SystemClock', path: './modules/system-clock.js' },
  { name: 'ProactiveInsightsHandler', path: './modules/proactive-insights-handler.js' }
];

async function testImportOneByOne() {
  for (const importItem of imports) {
    try {
      console.log(`Testing import: ${importItem.name} from ${importItem.path}`);
      
      const timeout = setTimeout(() => {
        console.error(`🔴 HANGING: ${importItem.name} from ${importItem.path}`);
        process.exit(1);
      }, 5000);
      
      await import(importItem.path);
      clearTimeout(timeout);
      
      console.log(`✅ Success: ${importItem.name}`);
      
    } catch (error) {
      console.error(`❌ Failed: ${importItem.name} - ${error.message}`);
      return false;
    }
  }
  
  console.log('\n🎉 ALL IMPORTS SUCCESSFUL!');
  return true;
}

testImportOneByOne().then((success) => {
  if (success) {
    console.log('\n🚀 All imports working!');
    process.exit(0);
  } else {
    console.log('\n💥 Import failed');
    process.exit(1);
  }
}).catch((error) => {
  console.error('\n💥 Test framework error:', error.message);
  process.exit(1);
});
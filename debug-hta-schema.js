#!/usr/bin/env node

/**
 * DEBUG HTA SCHEMA ISSUE
 * 
 * Isolate and fix the "resultSchema.parse is not a function" error
 */

// Set test environment
process.env.NODE_ENV = 'test';
process.env.FOREST_DATA_DIR = './test-data-schema-debug';

async function debugHTASchema() {
  console.log('🔍 DEBUGGING HTA SCHEMA ISSUE');
  console.log('==============================\n');
  
  try {
    // Test 1: Check if HTA Analysis Server can start
    console.log('📡 TEST 1: HTA Analysis Server Startup');
    console.log('---------------------------------------');
    
    const { spawn } = await import('child_process');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const htaServerPath = path.resolve(__dirname, 'hta-analysis-server.js');
    
    console.log(`Starting HTA server: ${htaServerPath}`);
    
    const htaProcess = spawn('node', [htaServerPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let serverOutput = '';
    let serverError = '';
    
    htaProcess.stdout.on('data', (data) => {
      serverOutput += data.toString();
    });
    
    htaProcess.stderr.on('data', (data) => {
      serverError += data.toString();
    });
    
    // Give the server time to start
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Send a simple request to test
    const testRequest = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {}
    }) + '\n';
    
    htaProcess.stdin.write(testRequest);
    
    // Wait for response
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('Server Output:', serverOutput);
    if (serverError) {
      console.log('Server Error:', serverError);
    }
    
    htaProcess.kill();
    
    // Test 2: Check HTA Bridge connection
    console.log('\n🌉 TEST 2: HTA Bridge Connection');
    console.log('----------------------------------');
    
    const { DataPersistence } = await import('./forest-server/modules/data-persistence.js');
    const { MemorySync } = await import('./forest-server/modules/memory-sync.js');
    const { ProjectManagement } = await import('./forest-server/modules/project-management.js');
    const { HTABridge } = await import('./forest-server/modules/hta-bridge.js');
    
    const dp = new DataPersistence('./test-data-schema-debug');
    const memorySync = new MemorySync(dp);
    const pm = new ProjectManagement(dp, memorySync);
    
    // Create a test project
    const projectId = 'schema-debug-' + Date.now();
    const projectArgs = {
      project_id: projectId,
      goal: 'Test HTA Schema',
      context: 'Debug test',
      life_structure_preferences: {
        wake_time: '08:00',
        sleep_time: '23:00',
        focus_duration: '25 minutes'
      }
    };
    
    const projectResult = await pm.createProject(projectArgs);
    console.log('Project created:', projectResult.success);
    
    if (projectResult.success) {
      const htaBridge = new HTABridge(dp, pm);
      
      console.log('Testing HTA Bridge connection...');
      
      try {
        // This should trigger the schema error
        const htaData = await htaBridge.generateHTAData(projectId, 'general');
        console.log('✅ HTA Bridge: SUCCESS');
        console.log('Generated HTA data:', !!htaData);
        console.log('Strategic branches:', htaData?.strategicBranches?.length || 0);
        console.log('Frontier nodes:', htaData?.frontierNodes?.length || 0);
      } catch (htaError) {
        console.error('❌ HTA Bridge: ERROR');
        console.error('Error message:', htaError.message);
        console.error('Stack trace:', htaError.stack);
        
        // Check if this is the schema error
        if (htaError.message.includes('resultSchema.parse')) {
          console.log('\n🎯 FOUND THE SCHEMA ERROR!');
          console.log('This is the "resultSchema.parse is not a function" issue');
          
          // Try to understand what's happening
          console.log('Investigating schema validation...');
          
          // Check if it's an MCP SDK issue
          try {
            const { CallToolRequestSchema } = await import('@modelcontextprotocol/sdk/types.js');
            console.log('CallToolRequestSchema type:', typeof CallToolRequestSchema);
            console.log('CallToolRequestSchema.parse type:', typeof CallToolRequestSchema?.parse);
          } catch (sdkError) {
            console.error('MCP SDK import error:', sdkError.message);
          }
        }
      }
    }
    
    // Test 3: Check fallback HTA creation
    console.log('\n🔄 TEST 3: Fallback HTA Creation');
    console.log('----------------------------------');
    
    try {
      const htaBridge = new HTABridge(dp, pm);
      
      // Force fallback by not connecting to server
      const config = await dp.loadProjectData(projectId, 'config.json');
      const fallbackHTA = htaBridge.createFallbackHTA(config, 'general');
      
      console.log('✅ Fallback HTA: SUCCESS');
      console.log('Fallback strategic branches:', fallbackHTA?.strategicBranches?.length || 0);
      console.log('Fallback frontier nodes:', fallbackHTA?.frontierNodes?.length || 0);
      
      if (fallbackHTA?.strategicBranches?.length > 0) {
        console.log('First branch:', fallbackHTA.strategicBranches[0]?.name);
      }
      
    } catch (fallbackError) {
      console.error('❌ Fallback HTA: ERROR');
      console.error('Error message:', fallbackError.message);
    }
    
  } catch (error) {
    console.error('\n💥 CRITICAL ERROR');
    console.error('==================');
    console.error(`Error: ${error.message}`);
    console.error(`Stack: ${error.stack}`);
  }
}

// Run the debug test
debugHTASchema()
  .then(() => {
    console.log('\n🏁 DEBUG COMPLETE');
    process.exit(0);
  })
  .catch(error => {
    console.error('FATAL ERROR:', error.message);
    process.exit(1);
  });

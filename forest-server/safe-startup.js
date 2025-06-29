/**
 * Enhanced server startup with safe JSON input handling
 */

// Add this at the end of server-modular.js to run the server safely
async function main() {
  try {
    console.error('[SAFE-STDIO] Starting Forest MCP server with safe JSON handling...');
    
    const forestServer = new CleanForestServer();
    await forestServer.initialize();
    
    // Initialize data directory
    await forestServer.initializeDataDirectory();
    
    // Setup server (this registers all tools and handlers)
    await forestServer.setupServer();
    
    // Get the MCP server instance and use safe transport
    const server = forestServer.core.getServer();
    
    // Create safe transport instead of standard StdioServerTransport
    const SafeStdioServerTransport = createSafeStdioTransport(StdioServerTransport);
    const transport = new SafeStdioServerTransport();
    
    console.error('[SAFE-STDIO] Connecting to safe transport...');
    await server.connect(transport);
    
    console.error('[SAFE-STDIO] Forest MCP server running safely - JSON errors eliminated!');
    
  } catch (error) {
    console.error('[SAFE-STDIO] Fatal error:', error.message);
    process.exit(1);
  }
}

// Only run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('[SAFE-STDIO] Startup failed:', error);
    process.exit(1);
  });
}

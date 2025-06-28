#!/usr/bin/env node

/**
 * Minimal MCP Server Test
 * Tests if the basic MCP SDK is working properly
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

async function main() {
  console.error('🧪 Starting minimal MCP server test...');
  
  try {
    // Create server
    console.error('📦 Creating MCP server...');
    const server = new Server(
      {
        name: 'test-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
    console.error('✅ MCP server created');

    // Create transport
    console.error('🔌 Creating stdio transport...');
    const transport = new StdioServerTransport();
    console.error('✅ Stdio transport created');

    // Connect
    console.error('🔗 Connecting server to transport...');
    await server.connect(transport);
    console.error('✅ MCP server connected and listening');

    console.error('🎉 Minimal MCP server test successful!');
    
  } catch (error) {
    console.error('❌ Minimal MCP server test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

main();

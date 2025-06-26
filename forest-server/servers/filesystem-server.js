#!/usr/bin/env node

// Filesystem MCP Server (Forest.os)
// Grants read-only access to whitelisted directories via the Model-Context-Protocol.
// Usage:  node filesystem-server.js --allow <dir1> --allow <dir2> ...

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs';
import * as path from 'path';

// ───────────────────────────────────────────────────────────────
// Parse command-line flags for allowed directories
// ───────────────────────────────────────────────────────────────
const allowedDirs = [];
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--allow' && process.argv[i + 1]) {
    allowedDirs.push(path.resolve(process.argv[i + 1]));
    i += 1;
  }
}

if (allowedDirs.length === 0) {
  // Default to current working directory if none supplied
  allowedDirs.push(process.cwd());
}

function isPathAllowed(targetPath) {
  const normalised = path.resolve(targetPath);
  return allowedDirs.some(dir => normalised.startsWith(dir));
}

// ───────────────────────────────────────────────────────────────
// MCP Server definition
// ───────────────────────────────────────────────────────────────
const server = new Server(
  {
    name: 'forest-filesystem-server',
    version: '0.1.0',
  },
  {
    capabilities: { tools: {} },
  }
);

const toolDefinitions = [
  {
    name: 'read_file',
    description: 'Read a UTF-8 text file from an allowed directory',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute or relative file path' },
        maxBytes: { type: 'number', description: 'Maximum bytes to return (optional)' },
      },
      required: ['path'],
    },
  },
  {
    name: 'list_dir',
    description: 'List contents of a directory within an allowed path',
    inputSchema: {
      type: 'object',
      properties: {
        dir: { type: 'string', description: 'Directory path to list (optional)' },
      },
      required: [],
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: toolDefinitions };
});

server.setRequestHandler(CallToolRequestSchema, async request => {
  const { name, arguments: args } = request.params;
  switch (name) {
    case 'read_file': {
      const target = path.resolve(args.path);
      if (!isPathAllowed(target)) {
        throw new Error('Access denied: path not within allowed directories');
      }
      const stats = fs.statSync(target);
      if (!stats.isFile()) {
        throw new Error('Target is not a file');
      }
      const maxBytes = args.maxBytes && Number(args.maxBytes) > 0 ? Number(args.maxBytes) : undefined;
      const dataFull = fs.readFileSync(target, 'utf8');
      const content = maxBytes ? dataFull.slice(0, maxBytes) : dataFull;
      return { content: [{ type: 'text', text: content }] };
    }
    case 'list_dir': {
      const dir = path.resolve(args.dir || '.');
      if (!isPathAllowed(dir)) {
        throw new Error('Access denied: directory not within allowed directories');
      }
      const names = fs.readdirSync(dir, { withFileTypes: true }).map(d => ({ name: d.name, directory: d.isDirectory() }));
      return { content: [{ type: 'json', json: names }] };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`Forest Filesystem MCP server running. Allowed dirs: ${allowedDirs.join(', ')}`);
}

run().catch(err => {
  console.error('Filesystem server fatal error', err);
  process.exit(1);
}); 
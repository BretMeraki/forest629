#!/usr/bin/env node
/* @ts-nocheck */

// Memory MCP Server (Forest.os)
// A lightweight, domain-agnostic key-value store exposed via the Model-Context-Protocol.
// Usage:  node memory-server.js <memoryFilePath>
// If no path is provided it defaults to ./memory.json next to the server script.

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs';
import * as path from 'path';

// ───────────────────────────────────────────────────────────────
// Configuration & Data-store helpers
// ───────────────────────────────────────────────────────────────
const memoryFile = process.argv[2] || path.resolve(path.dirname(new URL(import.meta.url).pathname), 'memory.json');

function loadMemory() {
  try {
    const raw = fs.readFileSync(memoryFile, 'utf8');
    return JSON.parse(raw);
  } catch (_) {
    return {};
  }
}

function saveMemory(store) {
  try {
    fs.writeFileSync(memoryFile, JSON.stringify(store, null, 2));
  } catch (err) {
    console.error('Failed to persist memory store', err);
  }
}

let store = loadMemory();

// ───────────────────────────────────────────────────────────────
// MCP Server definition
// ───────────────────────────────────────────────────────────────
const server = new Server(
  {
    name: 'forest-memory-server',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const toolDefinitions = [
  {
    name: 'set_memory',
    description: 'Persist a value under the given key',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Identifier for the memory entry' },
        value: { description: 'JSON-serialisable value' },
      },
      required: ['key', 'value'],
    },
  },
  {
    name: 'get_memory',
    description: 'Retrieve the value for the given key, if any',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Identifier to look up' },
      },
      required: ['key'],
    },
  },
  {
    name: 'set_many',
    description: 'Persist multiple key/value pairs in one call',
    inputSchema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          description: 'Array of {key, value} objects',
          items: {
            type: 'object',
            properties: {
              key: { type: 'string' },
              value: {},
            },
            required: ['key', 'value'],
          },
        },
      },
      required: ['items'],
    },
  },
  {
    name: 'get_many',
    description: 'Retrieve multiple keys in one call',
    inputSchema: {
      type: 'object',
      properties: {
        keys: {
          type: 'array',
          items: { type: 'string' },
        },
      },
      required: ['keys'],
    },
  },
  {
    name: 'set_with_ttl',
    description: 'Persist value with a TTL (seconds)',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string' },
        value: {},
        ttl: { type: 'number', description: 'Time-to-live in seconds' },
      },
      required: ['key', 'value', 'ttl'],
    },
  },
  {
    name: 'cleanup_expired',
    description: 'Remove expired entries from the store',
    inputSchema: { type: 'object', properties: {} },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: toolDefinitions };
});

server.setRequestHandler(CallToolRequestSchema, async request => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'set_memory': {
      store[args.key] = args.value;
      saveMemory(store);
      return { content: [{ type: 'text', text: `✅ Stored key "${args.key}"` }] };
    }
    case 'get_memory': {
      let value = store.hasOwnProperty(args.key) ? store[args.key] : null;
      if (value && typeof value === 'object' && value.hasOwnProperty('expires_at')) {
        if (Date.now() > value.expires_at) {
          // expired
          delete store[args.key];
          saveMemory(store);
          value = null;
        } else {
          value = value.value;
        }
      }
      return {
        content: [
          {
            type: 'text',
            text: value !== null ? `🧠 ${JSON.stringify(value)}` : `⚠️ No value stored for "${args.key}"`,
          },
        ],
        value,
      };
    }
    case 'set_many': {
      for (const { key, value } of args.items) {
        store[key] = value;
      }
      saveMemory(store);
      return {
        content: [
          { type: 'text', text: `✅ Stored ${args.items.length} key(s)` },
        ],
      };
    }
    case 'get_many': {
      const result = {};
      const now = Date.now();
      for (const k of args.keys) {
        let v = store.hasOwnProperty(k) ? store[k] : null;
        if (v && typeof v === 'object' && v.hasOwnProperty('expires_at')) {
          if (now > v.expires_at) {
            delete store[k];
            v = null;
          } else {
            v = v.value;
          }
        }
        result[k] = v;
      }
      return {
        content: [
          { type: 'text', text: JSON.stringify(result, null, 2) },
        ],
        values: result,
      };
    }
    case 'set_with_ttl': {
      const expires_at = Date.now() + args.ttl * 1000;
      store[args.key] = { value: args.value, expires_at };
      saveMemory(store);
      return {
        content: [
          { type: 'text', text: `✅ Stored key "${args.key}" with TTL ${args.ttl}s` },
        ],
      };
    }
    case 'cleanup_expired': {
      const now = Date.now();
      let removed = 0;
      for (const [k, v] of Object.entries(store)) {
        if (v && typeof v === 'object' && v.hasOwnProperty('expires_at') && now > v.expires_at) {
          delete store[k];
          removed++;
        }
      }
      if (removed > 0) saveMemory(store);
      return {
        content: [
          { type: 'text', text: `🧹 Removed ${removed} expired entr${removed === 1 ? 'y' : 'ies'}.` },
        ],
        removed,
      };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`Forest Memory MCP server running (data file: ${memoryFile})`);
}

run().catch(err => {
  console.error('Memory server fatal error', err);
  process.exit(1);
}); 
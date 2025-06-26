// @ts-nocheck

import { createIntegrationTestHarness } from './integration-test-harness.js';
import { jest } from '@jest/globals';

// Increase default timeout for async server setup
jest.setTimeout(30000);

describe('MCP Integration – tool exposure & routing', () => {
  let harness;
  let server;

  beforeAll(async () => {
    harness = createIntegrationTestHarness();
    await harness.setupCompleteSystemState();
    server = await harness.createTestServerInstance();
    await server.setupServer();
  });

  afterAll(() => {
    harness.cleanup();
  });

  test('tools/list exposes critical project-management tools', async () => {
    const exposed = server.mcpHandlers.listExposedTools();
    const expected = ['create_project', 'switch_project', 'list_projects'];
    expected.forEach(tool => {
      expect(exposed).toContain(tool);
    });
  });

  test('ToolRegistry has routable handler for critical tools', () => {
    const registryNames = server.toolRouter.toolRegistry.getToolNames();
    expect(registryNames).toEqual(expect.arrayContaining(['create_project', 'switch_project', 'list_projects']));
  });
}); 
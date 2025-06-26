// @ts-nocheck

import { jest } from '@jest/globals';
import { CleanForestServer } from '../../server-modular.js';

// Extract the coordinator method
const runToolLoop = CleanForestServer.prototype.runToolLoop;

// Minimal stub for dependencies consumed by runToolLoop
class FakeServer {
  constructor() {
    // Attach method to instance
    this.runToolLoop = runToolLoop.bind(this);
    this.logger = { error: jest.fn(), warn: jest.fn(), debug: jest.fn() };

    // ---- Mock project helpers ----
    this.requireActiveProject = jest.fn().mockResolvedValue('proj1');

    // DataPersistence stub with HTA state tracking
    this._hta = { generation_context: { awaiting_generation: true }, frontierNodes: [] };
    this.dataPersistence = {
      loadProjectData: jest.fn().mockResolvedValue({ activePath: 'general' }),
      logError: jest.fn(),
    };

    // load/save HTA helpers manipulated during test
    this.loadPathHTA = jest.fn().mockImplementation(async () => this._hta);
    this.savePathHTA = jest.fn().mockImplementation(async (pid, path, hta) => {
      this._hta = hta;
    });

    // Task storage stub
    this.storeGeneratedTasks = jest.fn().mockImplementation(async branchTasks => {
      const count = branchTasks.reduce((s, b) => s + (b.tasks?.length || 0), 0);
      // Simulate tasks becoming frontier nodes
      this._hta.frontierNodes = Array.from({ length: count }, (_, i) => ({ id: `node_${i}` }));
      return { tasks_stored: count };
    });

    // LLM stub
    this.requestClaudeGeneration = jest.fn().mockResolvedValue({
      branch_tasks: [
        {
          branch_name: 'foundation',
          tasks: [
            {
              title: 'Task 1',
              description: 'Do X',
              difficulty: 1,
              duration: 20,
              prerequisites: [],
            },
          ],
        },
      ],
      content: [],
    });

    // next task helper
    this.getNextTask = jest.fn().mockResolvedValue({ content: [{ type: 'text', text: 'Next' }] });
  }
}

describe('runToolLoop coordinator', () => {
  it('generates tasks and marks generation complete', async () => {
    const server = new FakeServer();
    const res = await server.runToolLoop('Generate tasks', 2);
    expect(res.success).toBe(true);
    expect(server.storeGeneratedTasks).toHaveBeenCalled();
    expect(server.requestClaudeGeneration).toHaveBeenCalled();
    // Generation flag should be cleared
    expect(server._hta.generation_context.awaiting_generation).toBe(false);
  });

  it('handles LLM failure gracefully', async () => {
    const server = new FakeServer();
    server.requestClaudeGeneration.mockRejectedValueOnce(new Error('Simulated failure'));
    const res = await server.runToolLoop('Generate tasks', 1);
    expect(res.success).toBe(false);
    expect(res.content[0].text).toMatch(/failed/i);
  });
}); 
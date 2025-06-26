import { jest } from '@jest/globals';

let CleanForestServer;

beforeAll(async () => {
  const mod = await import('../../server-modular.js');
  CleanForestServer = mod.default ? mod.default : mod.CleanForestServer || mod.CleanForestServer;
  if (!CleanForestServer) {
    CleanForestServer = Object.values(mod).find(v => typeof v === 'function' && v.name === 'CleanForestServer');
  }
});

describe('LLM parsing robustness', () => {
  test('parses standard JSON array', () => {
    const srv = new CleanForestServer();
    const resp = { branch_tasks: [{ title: 'Task 1' }] };
    const result = srv._parseTasksFromLLMResponse(resp);
    expect(result).toHaveLength(1);
  });

  test('recovers from JSON wrapped in markdown fence', () => {
    const srv = new CleanForestServer();
    const resp = {
      content: [
        {
          type: 'text',
          text: '```json\n[{"title":"Task A"}]\n```',
        },
      ],
    };
    const result = srv._parseTasksFromLLMResponse(resp);
    expect(result).toHaveLength(1);
  });
});
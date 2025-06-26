import { CleanForestServer } from '../../server-modular.js';

describe('_parseTasksFromLLMResponse robustness', () => {
  /**
   * CleanForestServer has heavy constructor dependencies. We instantiate in test
   * environment but disable side-effects by stubbing required arguments where needed.
   */
  const server = new CleanForestServer();

  it('parses branch_tasks array directly on response', () => {
    const sample = { branch_tasks: [{ branch_name: 'example', tasks: [] }] };
    // @ts-ignore – accessing internal parser for test purposes
    const parsed = server['_parseTasksFromLLMResponse'](sample) || [];
    expect(parsed).toEqual(sample.branch_tasks);
  });

  it('parses tasks from JSON inside markdown code fence', () => {
    const sampleResponse = {
      content: [
        {
          type: 'text',
          text: '```json\n{"branch_tasks":[{"branch_name":"demo","tasks":[]}]}\n```',
        },
      ],
    };
    // @ts-ignore – accessing internal parser for test purposes
    const parsed = server['_parseTasksFromLLMResponse'](sampleResponse) || [];
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].branch_name).toBe('demo');
  });

  it('parses tasks from top-level JSON array', () => {
    const sampleResponse = {
      content: [
        {
          type: 'text',
          text: '[{"branch_name":"arr","tasks":[]}]',
        },
      ],
    };
    // @ts-ignore – accessing internal parser for test purposes
    const parsed = server['_parseTasksFromLLMResponse'](sampleResponse) || [];
    expect(parsed[0].branch_name).toBe('arr');
  });
}); 
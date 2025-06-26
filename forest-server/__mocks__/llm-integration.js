/*
 * Global LLM Integration Mock
 * Provides deterministic responses for task generation requests so that
 * test suites can rely on stable output irrespective of external APIs.
 */

export class LLMIntegrationMock {
  constructor() {
    this._history = [];
  }

  /**
   * Simulate the Forest.OS intelligence request interface.
   *
   * @param {string} requestType e.g. 'task_generation'
   * @param {{prompt:string}} options
   * @returns {Promise<Object>} Mocked LLM response object
   */
  async requestIntelligence(requestType, { prompt } = {}) {
    const call = { ts: Date.now(), requestType, prompt };
    this._history.push(call);

    // Fake different behaviours depending on markers in the prompt for tests
    if (prompt?.includes('[MALFORMED_JSON]')) {
      return { text: 'Here is your result: oops not json' }; // deliberately bad
    }

    if (prompt?.includes('[ERROR]')) {
      throw new Error('Simulated LLM failure');
    }

    // Default success path – return small deterministic task array
    const tasks = [
      {
        branch_name: 'foundations',
        tasks: [
          {
            title: 'Set up project workspace',
            description: 'Create initial project folders and tooling',
            difficulty: 1,
            duration: '20 minutes',
            prerequisites: [],
          },
          {
            title: 'Hello World module',
            description: 'Write and run the first module to ensure environment works',
            difficulty: 1,
            duration: '15 minutes',
            prerequisites: [],
          },
        ],
      },
    ];

    return {
      completion: JSON.stringify(tasks),
      branch_tasks: tasks,
      content: [
        { type: 'text', text: JSON.stringify({ branch_tasks: tasks }, null, 2) },
      ],
    };
  }

  getHistory() {
    return this._history;
  }
}

export default new LLMIntegrationMock(); 
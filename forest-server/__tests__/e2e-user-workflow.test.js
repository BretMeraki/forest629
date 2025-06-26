import { jest } from '@jest/globals';
import { ProjectManagement } from '../project-management.js';
import { CleanForestServer } from '../../server-modular.js';

// Basic mocks for required persistence layer
const mockPersistence = {
  loadGlobalData: jest.fn(async () => ({ projects: [] })),
  saveGlobalData: jest.fn(async () => {}),
  loadProjectData: jest.fn(async () => ({ goal: 'Test Goal' })),
  saveProjectData: jest.fn(async () => {}),
  loadPathData: jest.fn(async () => null),
  savePathHTA: jest.fn(async () => {}),
  logError: jest.fn(async () => {}),
};

const mockMemorySync = { syncActiveProjectToMemory: jest.fn(async () => ({})) };

describe('End-to-End User Workflow (skeleton visibility & guidance)', () => {
  it('provides helpful startup guidance when no projects exist', async () => {
    const pm = new ProjectManagement(mockPersistence, mockMemorySync);
    const guidance = await pm.getStartupGuidance();
    expect(guidance.hasProjects).toBe(false);
    expect(guidance.suggestedAction).toBe('create_project');
  });

  it('surfaces skeleton structure and next task to the user', async () => {
    // Create a CleanForestServer instance without hitting the heavy constructor logic
    // by creating a bare object with the prototype only.
    const server = Object.create(CleanForestServer.prototype);

    // Stub minimal methods used in buildHTATree
    server.htaTreeBuilder = {
      buildHTATree: jest.fn(async () => ({
        requires_branch_generation: true,
        generation_prompt: null,
        complexity_analysis: {},
        content: [{ type: 'text', text: 'placeholder' }],
      })),
    };

    server.requireActiveProject = jest.fn(async () => 'test-project');
    server.dataPersistence = mockPersistence;
    server.formatSkeletonSummary = CleanForestServer.prototype.formatSkeletonSummary.bind(server);
    server.generateSkeletonBranches = jest.fn(() => [
      { branch_name: 'branch_1', tasks: [{ title: 'Task 1' }] },
      { branch_name: 'branch_2', tasks: [{ title: 'Task 2' }] },
    ]);
    server.storeGeneratedTasks = jest.fn(async () => ({ tasks_stored: 2 }));
    server.getNextTask = jest.fn(async () => ({ content: [{ type: 'text', text: 'Do first task' }] }));

    const result = await server.buildHTATree('general', 'focused', []);

    const combinedText = result.content.map((/** @type {any} */ b) => b.text).join('\n');
    expect(combinedText).toMatch(/branch_1/);
    expect(combinedText).toMatch(/Next Action/);
  });
}); 
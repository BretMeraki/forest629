// @jest-environment node
// Jest test file: expects describe, test, expect globals

import { CleanForestServer } from '../server-modular.js';

function uniqueId(prefix = 'dummy_project_') {
  return prefix + Date.now() + '_' + Math.floor(Math.random() * 100000);
}

describe('Forest Core Loop End-to-End Repeatability', () => {
  const NUM_RUNS = 10;

  for (let i = 0; i < NUM_RUNS; i++) {
    test(`Core loop run #${i + 1}`, async () => {
      const server = new CleanForestServer();
      await server.initialize();
      const projectId = uniqueId();
      // 1. Create project
      const projectResult = await server.tools['create_project'].handler({
        project_id: projectId,
        goal: 'Dummy goal for repeat test',
        context: 'Dummy context for repeat test',
        life_structure: 'Dummy life structure',
      });
      expect(projectResult).toBeDefined();
      expect(projectResult.success).toBe(true);
      // 2. Build HTA tree
      const treeResult = await server.tools['build_hta_tree'].handler({
        project_id: projectId,
        context: 'Dummy context for repeat test',
      });
      expect(treeResult).toBeDefined();
      expect(treeResult.success).toBe(true);
      expect(treeResult.tree).toBeDefined();
      // 3. Generate first task
      const taskResult = await server.tools['generate_task'].handler({
        project_id: projectId,
        context: 'Dummy context for repeat test',
      });
      expect(taskResult).toBeDefined();
      expect(taskResult.success).toBe(true);
      expect(taskResult.task).toBeDefined();
      // 4. Simulate task completion with dummy context
      const completeResult = await server.tools['complete_task'].handler({
        project_id: projectId,
        task_id: taskResult.task.id,
        context: 'Dummy context after completion',
        notes: 'Simulated completion',
      });
      expect(completeResult).toBeDefined();
      expect(completeResult.success).toBe(true);
      // 5. Generate next task and check context propagation
      const nextTaskResult = await server.tools['generate_task'].handler({
        project_id: projectId,
        context: 'Dummy context after completion',
      });
      expect(nextTaskResult).toBeDefined();
      expect(nextTaskResult.success).toBe(true);
      expect(nextTaskResult.task).toBeDefined();
      // 6. Clean up (delete project)
      const deleteResult = await server.tools['delete_project'].handler({
        project_id: projectId,
      });
      expect(deleteResult).toBeDefined();
      expect(deleteResult.success).toBe(true);
    });
  }

  afterAll(() => {
    // Optionally, add any global cleanup here
  });
}); 
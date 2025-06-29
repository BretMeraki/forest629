// Jest test file: expects describe, test, expect globals

import { CleanForestServer } from './server-modular.js';

function uniqueId(prefix = 'dummy_project_') {
  return prefix + Date.now() + '_' + Math.floor(Math.random() * 100000);
}

async function runCoreLoopE2E() {
  const NUM_RUNS = 10;
  let allPassed = true;

  for (let i = 0; i < NUM_RUNS; i++) {
    try {
      console.log(`\n=== Core loop run #${i + 1} ===`);
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
      if (!projectResult || !projectResult.success) throw new Error('create_project failed');
      // 2. Build HTA tree
      const treeResult = await server.tools['build_hta_tree'].handler({
        project_id: projectId,
        context: 'Dummy context for repeat test',
      });
      if (!treeResult || !treeResult.success || !treeResult.tree) throw new Error('build_hta_tree failed');
      // 3. Generate first task
      const taskResult = await server.tools['generate_task'].handler({
        project_id: projectId,
        context: 'Dummy context for repeat test',
      });
      if (!taskResult || !taskResult.success || !taskResult.task) throw new Error('generate_task failed');
      // 4. Simulate task completion with dummy context
      const completeResult = await server.tools['complete_task'].handler({
        project_id: projectId,
        task_id: taskResult.task.id,
        context: 'Dummy context after completion',
        notes: 'Simulated completion',
      });
      if (!completeResult || !completeResult.success) throw new Error('complete_task failed');
      // 5. Generate next task and check context propagation
      const nextTaskResult = await server.tools['generate_task'].handler({
        project_id: projectId,
        context: 'Dummy context after completion',
      });
      if (!nextTaskResult || !nextTaskResult.success || !nextTaskResult.task) throw new Error('generate_task (next) failed');
      // 6. Clean up (delete project)
      const deleteResult = await server.tools['delete_project'].handler({
        project_id: projectId,
      });
      if (!deleteResult || !deleteResult.success) throw new Error('delete_project failed');
      console.log(`Core loop run #${i + 1} PASSED`);
    } catch (err) {
      allPassed = false;
      console.error(`Core loop run #${i + 1} FAILED:`, err);
    }
  }
  if (allPassed) {
    console.log('\nAll core loop E2E runs PASSED.');
    process.exit(0);
  } else {
    console.error('\nSome core loop E2E runs FAILED.');
    process.exit(1);
  }
}

// Only run if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}` || import.meta.url === `file://${process.cwd()}/${process.argv[1]}`) {
  runCoreLoopE2E();
} 
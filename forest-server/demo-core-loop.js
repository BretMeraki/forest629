import { CleanForestServer } from './server-modular.js';

// ------------------------------------------------------------
// ENVIRONMENT GUARD – disable demo script in production deployments
// ------------------------------------------------------------
if (process.env.NODE_ENV === 'production') {
  console.log('⏭️  Demo script disabled in production environment');
  process.exit(0);
}

(async () => {
  const server = new CleanForestServer();

  // 1. Create a project
  const createResp = await server.tools['create_project'].handler({
    project_id: 'demo-project',
    goal: 'Learn TypeScript',
    life_structure_preferences: {
      wake_time: '07:00',
      sleep_time: '22:00',
    },
  });
  console.log('\n=== create_project ===');
  console.log(createResp.content?.map(c => c.text).join('\n'));

  // 2. Build HTA tree for default path
  const buildResp = await server.buildHTATree('general', 'mixed', []);
  console.log('\n=== build_hta_tree ===');
  console.log(buildResp.content?.map(c => c.text).join('\n').slice(0, 500));

  // 3. Get next task suggestion
  const nextTaskResp = await server.getNextTask('', 3, '30 minutes');
  console.log('\n=== get_next_task ===');
  console.log(nextTaskResp.content?.map(c => c.text).join('\n'));

  // 4. Complete the suggested task (mock)
  if (nextTaskResp?.task_id) {
    const completeResp = await server.completeBlock({ task_id: nextTaskResp.task_id });
    console.log('\n=== complete_task ===');
    console.log(completeResp.content?.map(c => c.text).join('\n'));
  } else {
    console.log('\nNo task_id returned to complete');
  }
})();

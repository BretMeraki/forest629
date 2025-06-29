import { CleanForestServer } from './server-modular.js';
import logger from './modules/utils/logger.js';
import { FILE_NAMES } from './modules/constants.js';
import { FileSystem } from './modules/utils/file-system.js';
import path from 'path';

// ------------------------------------------------------------
// ENVIRONMENT GUARD – disable demo script in production deployments
// ------------------------------------------------------------
if (process.env.NODE_ENV === 'production') {
  console.log('⏭️  Demo script disabled in production environment');
  process.exit(0);
}

if (!process.env.FOREST_DATA_DIR || !/test|tmp|demo/i.test(process.env.FOREST_DATA_DIR)) {
  console.error('\u26a0\ufe0f  Refusing to run: FOREST_DATA_DIR is not set to a test/demo directory. Set FOREST_DATA_DIR to a safe, isolated path.');
  process.exit(1);
}

(async () => {
  // 0. Ensure data directory exists
  const dataDir = process.env.FOREST_DATA_DIR || path.join(process.env.HOME || process.env.USERPROFILE || '', '.forest-data');
  logger.info('[DEBUG] Resolved dataDir: ' + String(dataDir));
  if (!dataDir || typeof dataDir !== 'string' || dataDir.trim().length === 0) {
    logger.error('[FATAL] Data directory could not be resolved. Set FOREST_DATA_DIR or ensure HOME/USERPROFILE is set.');
    process.exit(1);
  }
  await FileSystem.ensureDir(dataDir);
  logger.info('Ensured data directory exists: ' + dataDir);

  const server = new CleanForestServer();

  // --- DUMMY PROJECT CONFIG ---
  const dummyProjectId = 'standalone-demo';
  const initialGoal = 'Test the core loop evolution';
  const evolvedGoal = 'Test the core loop evolution (evolved)';
  const dummyContext = 'Simulated user context for standalone test';
  const dummyPrefs = { wake_time: '07:00', sleep_time: '22:00' };

  // 1. Create or overwrite the dummy project
  logger.info('[DEBUG] Creating project with project_id: ' + dummyProjectId);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const createResp = await server.tools['create_project'].handler({
    project_id: dummyProjectId,
    goal: initialGoal,
    context: dummyContext,
    life_structure_preferences: dummyPrefs,
  });
  logger.info('=== create_project ===');
  if (createResp.content && Array.isArray(createResp.content)) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    logger.info(createResp.content.map(function(c) { return c.text; }).join('\n'));
  }

  // 1a. Print active project ID
  const activeProjectId = server.projectManagement.activeProject;
  logger.info('Active project ID: ' + activeProjectId);

  // 1b. Load and print project config
  logger.info('[DEBUG] Loading project config for project_id: ' + activeProjectId + ' from dataDir: ' + dataDir);
  let projectConfig = null;
  try {
    projectConfig = await server.dataPersistence.loadProjectData(activeProjectId, FILE_NAMES.CONFIG);
    logger.info('Loaded project config: ' + JSON.stringify(projectConfig, null, 2));
  } catch (err) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    var msg = (err && typeof err === 'object' && Object.prototype.hasOwnProperty.call(err, 'message')) ? err.message : String(err);
    logger.error('Failed to load project config: ' + msg);
  }

  // 1c. Validate required fields before building HTA tree
  if (!projectConfig) {
    logger.error('No project config found. Skipping HTA tree build.');
    return;
  }
  if (!projectConfig.goal || typeof projectConfig.goal !== 'string' || projectConfig.goal.trim().length === 0) {
    logger.error('Project config missing valid goal. Skipping HTA tree build.');
    return;
  }
  if (!('context' in projectConfig) || !projectConfig.context) {
    logger.warn('Project config missing context. Proceeding, but this may affect HTA tree generation.');
  }

  // 2. Build HTA tree for default path
  logger.info('=== build_hta_tree (initial) ===');
  try {
    const buildResp = await server.buildHTATree('general', 'mixed', []);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    var buildText = (buildResp.content && Array.isArray(buildResp.content)) ? buildResp.content.map(function(c) { return c.text; }).join('\n') : '';
    if (typeof buildText === 'string') {
      logger.info(buildText.slice(0, 500));
    }
  } catch (err) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    var msg2 = (err && typeof err === 'object' && Object.prototype.hasOwnProperty.call(err, 'message')) ? err.message : String(err);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    var stack2 = (err && typeof err === 'object' && Object.prototype.hasOwnProperty.call(err, 'stack')) ? err.stack : '';
    logger.error('HTA tree generation failed with error: ' + msg2);
    if (stack2) logger.error(stack2);
  }

  // 3. Get next task suggestion
  const nextTaskResp = await server.getNextTask('', 3, '30 minutes');
  logger.info('=== get_next_task (initial) ===');
  if (nextTaskResp.content && Array.isArray(nextTaskResp.content)) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    logger.info(nextTaskResp.content.map(function(c) { return c.text; }).join('\n'));
  }

  // 4. Simulate goal evolution: update the goal and rerun the core loop
  logger.info('=== evolve_goal ===');
  projectConfig.goal = evolvedGoal;
  logger.info('[DEBUG] Saving evolved project config for project_id: ' + dummyProjectId + ' to dataDir: ' + dataDir);
  await server.dataPersistence.saveProjectData(dummyProjectId, FILE_NAMES.CONFIG, projectConfig);
  logger.info('Updated project goal to: ' + evolvedGoal);

  // 5. Rebuild HTA tree with evolved goal
  logger.info('=== build_hta_tree (evolved) ===');
  try {
    const buildResp2 = await server.buildHTATree('general', 'mixed', []);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    var buildText2 = (buildResp2.content && Array.isArray(buildResp2.content)) ? buildResp2.content.map(function(c) { return c.text; }).join('\n') : '';
    if (typeof buildText2 === 'string') {
      logger.info(buildText2.slice(0, 500));
    }
  } catch (err) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    var msg3 = (err && typeof err === 'object' && Object.prototype.hasOwnProperty.call(err, 'message')) ? err.message : String(err);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    var stack3 = (err && typeof err === 'object' && Object.prototype.hasOwnProperty.call(err, 'stack')) ? err.stack : '';
    logger.error('HTA tree generation (evolved) failed with error: ' + msg3);
    if (stack3) logger.error(stack3);
  }

  // 6. Get next task suggestion after goal evolution
  const nextTaskResp2 = await server.getNextTask('', 3, '30 minutes');
  logger.info('=== get_next_task (evolved) ===');
  if (nextTaskResp2.content && Array.isArray(nextTaskResp2.content)) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    logger.info(nextTaskResp2.content.map(function(c) { return c.text; }).join('\n'));
  }

  // 7. Complete the suggested task (mock, after evolution)
  if (nextTaskResp2 && nextTaskResp2.task_id) {
    const completeResp2 = await server.completeBlock({ task_id: nextTaskResp2.task_id });
    logger.info('=== complete_task (evolved) ===');
    if (completeResp2.content && Array.isArray(completeResp2.content)) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      logger.info(completeResp2.content.map(function(c) { return c.text; }).join('\n'));
    }
  } else {
    logger.info('No task_id returned to complete (evolved)');
  }
})();

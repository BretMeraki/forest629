/**
 * Debug Task Completion Script
 * Usage: node debug-task-completion.js <blockId>
 *
 * This utility script runs the TaskCompletion.completeBlock flow with verbose
 * logging enabled, making it easier to trace synchronization issues between
 * schedule blocks, HTA frontier nodes, and transaction persistence.
 */
// @ts-nocheck

import logger from './modules/utils/logger.js';
import { DataPersistence } from './modules/data-persistence.js';
import { ProjectManagement } from './modules/project-management.js';
import { TaskCompletion } from './modules/task-completion.js';

if (!process.env.FOREST_DATA_DIR || !/test|tmp|demo/i.test(process.env.FOREST_DATA_DIR)) {
  console.error('\u26a0\ufe0f  Refusing to run: FOREST_DATA_DIR is not set to a test/demo directory. Set FOREST_DATA_DIR to a safe, isolated path.');
  process.exit(1);
}

(async () => {
  try {
    const blockId = process.argv[2] || 'debug-block-1';
    const dataDir = process.env.FOREST_DATA_DIR || './data';

    const dataPersistence = new DataPersistence(dataDir);
    const projectManagement = new ProjectManagement(dataPersistence);

    const taskCompletion = new TaskCompletion(dataPersistence, projectManagement);

    logger.info('[Debug] Starting task completion debug run', { blockId });

    const result = await taskCompletion.completeBlock({
      blockId,
      outcome: 'debug-outcome',
      learned: 'debug-learning',
    });

    logger.info('[Debug] Task completion result', { result });
  } catch (error) {
    logger.error('[Debug] Script error', { message: error.message, stack: error.stack });
  }
})(); 
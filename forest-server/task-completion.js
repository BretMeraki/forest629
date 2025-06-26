/**
 * DEPRECATED FILE - DO NOT USE IN NEW CODE
 * This wrapper re-exports the canonical implementation located at
 * ./modules/task-completion.js. All new imports should point there.
 */
// @ts-nocheck

import { TaskCompletion as ModuleTaskCompletion } from './modules/task-completion.js';

if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
  // eslint-disable-next-line no-console
  console.warn('[DEPRECATED] "forest-server/task-completion.js" is deprecated. Please import from "./modules/task-completion.js" instead.');
}

export const TaskCompletion = ModuleTaskCompletion;
export default ModuleTaskCompletion;
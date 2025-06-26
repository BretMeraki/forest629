/**
 * DEPRECATED FILE - Use modules/hta-status.js instead.
 */
// @ts-nocheck

import { HtaStatus as ModuleHtaStatus } from './modules/hta-status.js';

if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
  // eslint-disable-next-line no-console
  console.warn('[DEPRECATED] "forest-server/hta-status.js" is deprecated. Please import from "./modules/hta-status.js" instead.');
}

export const HtaStatus = ModuleHtaStatus;
export default ModuleHtaStatus;
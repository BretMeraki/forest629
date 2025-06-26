/**
 * DEPRECATED FILE - Use modules/strategy-evolver.js instead.
 */
// @ts-nocheck

import { StrategyEvolver as ModuleStrategyEvolver } from './modules/strategy-evolver.js';

if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
  // eslint-disable-next-line no-console
  console.warn('[DEPRECATED] "forest-server/strategy-evolver.js" is deprecated. Please import from "./modules/strategy-evolver.js" instead.');
}

export const StrategyEvolver = ModuleStrategyEvolver;
export default ModuleStrategyEvolver;
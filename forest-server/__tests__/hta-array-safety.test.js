import path from 'path';
import { DataPersistence } from '../data-persistence.js';

describe('HTA Array Safety – _validateHTAStructure', () => {
  const tempDir = path.join(process.cwd(), '.tmp-test-data');
  const dp = new DataPersistence(tempDir);

  test('missing arrays are initialised', () => {
    const corrupted = { tree: null };
    const fixed = dp._validateHTAStructure(corrupted);
    expect(Array.isArray(fixed.frontierNodes)).toBe(true);
    expect(Array.isArray(fixed.strategicBranches)).toBe(true);
    expect(Array.isArray(fixed.completedNodes)).toBe(true);
    expect(Array.isArray(fixed.collaborative_sessions)).toBe(true);
  });

  test('null arrays are corrected', () => {
    const corrupted = {
      frontierNodes: null,
      strategicBranches: null,
      completedNodes: null,
      collaborative_sessions: null,
    };
    const fixed = dp._validateHTAStructure(corrupted);
    expect(fixed.frontierNodes.length).toBe(0);
    expect(fixed.strategicBranches.length).toBe(0);
  });
}); 
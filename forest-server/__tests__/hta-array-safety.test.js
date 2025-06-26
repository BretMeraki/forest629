import path from 'path';
import { DataPersistence } from '../data-persistence.js';

describe('HTA Array Safety – _validateHTAStructure', () => {
  const tempDir = path.join(process.cwd(), '.tmp-test-data');
  const dp = new DataPersistence(tempDir);

  test('missing arrays are initialised', () => {
    const corrupted = { tree: null };
    const fixed = dp._validateHTAStructure(corrupted);
    expect(Array.isArray(fixed.frontier_nodes)).toBe(true);
    expect(Array.isArray(fixed.strategicBranches)).toBe(true);
    expect(Array.isArray(fixed.completed_nodes)).toBe(true);
    expect(Array.isArray(fixed.collaborative_sessions)).toBe(true);
  });

  test('null arrays are corrected', () => {
    const corrupted = {
      frontierNodes: null,
      strategicBranches: null,
      completed_nodes: null,
      collaborative_sessions: null,
    };
    const fixed = dp._validateHTAStructure(corrupted);
    expect(fixed.frontier_nodes.length).toBe(0);
    expect(fixed.strategicBranches.length).toBe(0);
  });
}); 
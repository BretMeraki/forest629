// @ts-nocheck
import { jest } from '@jest/globals';
import { buildParentMap, getLeafTasks, validateHierarchy } from '../utils/hta-hierarchy-utils.js';

describe('HTA Hierarchy Utils', () => {
  const sampleNodes = [
    { id: 'g1', level: 0, title: 'Goal', parent_id: null },
    { id: 'm1', level: 1, title: 'Main 1', parent_id: 'g1' },
    { id: 's1', level: 2, title: 'Sub 1', parent_id: 'm1' },
    { id: 't1', level: 3, title: 'Task 1', parent_id: 's1', duration: 30 },
    { id: 't2', level: 3, title: 'Task 2', parent_id: 's1', duration: 25 },
  ];

  it('buildParentMap should group children correctly', () => {
    const map = buildParentMap(sampleNodes);
    expect(map.get('g1').length).toBe(1); // main branch under goal
    expect(map.get('s1').length).toBe(2); // leaf tasks under sub
  });

  it('getLeafTasks should return only action-level tasks', () => {
    const leaves = getLeafTasks(sampleNodes);
    expect(leaves.map(l => l.id)).toEqual(['t1', 't2']);
  });

  it('validateHierarchy should detect no errors for valid tree', () => {
    const res = validateHierarchy(sampleNodes);
    expect(res.valid).toBe(true);
    expect(res.errors.length).toBe(0);
  });

  it('validateHierarchy should catch orphaned node', () => {
    const broken = [...sampleNodes, { id: 'orphan', level: 2, parent_id: 'missing' }];
    const res = validateHierarchy(broken);
    expect(res.valid).toBe(false);
    expect(res.errors.some(e => e.includes('orphan'))).toBe(true);
  });
}); 
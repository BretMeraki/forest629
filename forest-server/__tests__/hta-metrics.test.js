/**
 * Unit tests for HTA Metrics Utility Module
 * Tests all functions with various data structures and edge cases
 */

const {
  calculateProgress,
  countFrontierNodes,
  getReadyNodes,
  countCompletedNodes,
  getAvailableNodes,
  getBlockedNodes,
} = require('../utils/hta-metrics.js');

describe('HTA Metrics Utility', () => {
  describe('calculateProgress', () => {
    test('handles snake_case fields correctly', () => {
      const htaData = {
        frontierNodes: [
          { id: '1', completed: false },
          { id: '2', completed: true },
          { id: '3', completed: false },
        ],
        completedNodes: [{ id: '4' }, { id: '5' }],
      };

      const result = calculateProgress(htaData);
      expect(result).toEqual({
        completed: 3, // 1 completed in frontier + 2 in completedNodes
        total: 5, // 3 frontier + 2 completed
        percentage: 60,
      });
    });

    test('handles camelCase fields correctly', () => {
      const htaData = {
        frontierNodes: [
          { id: '1', completed: false },
          { id: '2', completed: true },
        ],
        completedNodes: [{ id: '3' }, { id: '4' }, { id: '5' }],
      };

      const result = calculateProgress(htaData);
      expect(result).toEqual({
        completed: 4, // 1 completed in frontier + 3 in completed
        total: 5, // 2 frontier + 3 completed
        percentage: 80,
      });
    });

    test('handles mixed field naming', () => {
      const htaData = {
        frontierNodes: [{ id: '1', completed: true }],
        completedNodes: [{ id: '2' }, { id: '3' }],
      };

      const result = calculateProgress(htaData);
      expect(result).toEqual({
        completed: 3, // 1 completed in frontier + 2 in completed
        total: 3, // 1 frontier + 2 completed
        percentage: 100,
      });
    });

    test('handles empty arrays', () => {
      const htaData = {
        frontierNodes: [],
        completedNodes: [],
      };

      const result = calculateProgress(htaData);
      expect(result).toEqual({
        completed: 0,
        total: 0,
        percentage: 0,
      });
    });

    test('handles null/undefined data', () => {
      expect(calculateProgress(null)).toEqual({
        completed: 0,
        total: 0,
        percentage: 0,
      });

      expect(calculateProgress(undefined)).toEqual({
        completed: 0,
        total: 0,
        percentage: 0,
      });

      expect(calculateProgress({})).toEqual({
        completed: 0,
        total: 0,
        percentage: 0,
      });
    });

    test('calculates percentage accurately', () => {
      const htaData = {
        frontierNodes: [
          { id: '1', completed: true },
          { id: '2', completed: false },
          { id: '3', completed: false },
        ],
      };

      const result = calculateProgress(htaData);
      expect(result.percentage).toBe(33); // 1/3 = 33.33%, rounded to 33
    });
  });

  describe('countFrontierNodes', () => {
    test('counts frontierNodes array', () => {
      const htaData = {
        frontierNodes: [{ id: '1' }, { id: '2' }, { id: '3' }],
      };

      expect(countFrontierNodes(htaData)).toBe(3);
    });

    test('counts frontierNodes array', () => {
      const htaData = {
        frontierNodes: [{ id: '1' }, { id: '2' }],
      };

      expect(countFrontierNodes(htaData)).toBe(2);
    });

    test('prefers frontierNodes when both fields present', () => {
      const htaData = {
        frontierNodes: [{ id: '1' }, { id: '2' }],
        frontierNodes: [{ id: '3' }, { id: '4' }, { id: '5' }],
      };

      expect(countFrontierNodes(htaData)).toBe(2);
    });

    test('handles missing fields', () => {
      expect(countFrontierNodes({})).toBe(0);
      expect(countFrontierNodes(null)).toBe(0);
      expect(countFrontierNodes(undefined)).toBe(0);
    });

    test('handles non-array values', () => {
      const htaData = {
        frontierNodes: 'not an array',
      };

      expect(countFrontierNodes(htaData)).toBe(0);
    });
  });

  describe('getReadyNodes', () => {
    test('returns nodes with no prerequisites', () => {
      const htaData = {
        frontierNodes: [
          { id: '1', title: 'Task 1' },
          { id: '2', title: 'Task 2', prerequisites: [] },
          { id: '3', title: 'Task 3', prerequisites: ['1'] },
        ],
      };

      const result = getReadyNodes(htaData);
      expect(result).toHaveLength(2);
      expect(result.map(n => n.id)).toEqual(['1', '2']);
    });

    test('returns nodes with met prerequisites', () => {
      const htaData = {
        frontierNodes: [
          { id: '1', title: 'Task 1', completed: true },
          { id: '2', title: 'Task 2', prerequisites: ['1'] },
          { id: '3', title: 'Task 3', prerequisites: ['4'] }, // unmet
        ],
        completedNodes: [{ id: '4' }],
      };

      const result = getReadyNodes(htaData);
      expect(result).toHaveLength(2);
      expect(result.map(n => n.id)).toEqual(['2', '3']);
    });

    test('excludes completed nodes', () => {
      const htaData = {
        frontierNodes: [
          { id: '1', title: 'Task 1', completed: true },
          { id: '2', title: 'Task 2', completed: false },
        ],
      };

      const result = getReadyNodes(htaData);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('2');
    });

    test('handles missing frontierNodes', () => {
      expect(getReadyNodes({})).toEqual([]);
      expect(getReadyNodes(null)).toEqual([]);
    });

    test('handles circular dependencies gracefully', () => {
      const htaData = {
        frontierNodes: [
          { id: '1', prerequisites: ['2'] },
          { id: '2', prerequisites: ['1'] },
        ],
      };

      const result = getReadyNodes(htaData);
      expect(result).toEqual([]); // Both are blocked by circular dependency
    });
  });

  describe('countCompletedNodes', () => {
    test('counts from completedNodes array', () => {
      const htaData = {
        completedNodes: [{ id: '1' }, { id: '2' }],
        frontierNodes: [],
      };

      expect(countCompletedNodes(htaData)).toBe(2);
    });

    test('counts completed tasks in frontier nodes', () => {
      const htaData = {
        frontierNodes: [
          { id: '1', completed: true },
          { id: '2', completed: false },
          { id: '3', completed: true },
        ],
      };

      expect(countCompletedNodes(htaData)).toBe(2);
    });

    test('combines both sources', () => {
      const htaData = {
        completedNodes: [{ id: '1' }, { id: '2' }],
        frontierNodes: [
          { id: '3', completed: true },
          { id: '4', completed: false },
        ],
      };

      expect(countCompletedNodes(htaData)).toBe(3); // 2 from completed + 1 from frontier
    });

    test('handles missing fields', () => {
      expect(countCompletedNodes({})).toBe(0);
      expect(countCompletedNodes(null)).toBe(0);
    });
  });

  describe('getAvailableNodes', () => {
    test('returns ready but not completed nodes', () => {
      const htaData = {
        frontierNodes: [
          { id: '1', completed: false },
          { id: '2', completed: true },
          { id: '3', completed: false, prerequisites: ['2'] },
        ],
      };

      const result = getAvailableNodes(htaData);
      expect(result).toHaveLength(2);
      expect(result.map(n => n.id)).toEqual(['1', '3']);
    });
  });

  describe('getBlockedNodes', () => {
    test('returns nodes with unmet prerequisites', () => {
      const htaData = {
        frontierNodes: [
          { id: '1' }, // ready
          { id: '2', prerequisites: ['1'] }, // blocked (1 not completed)
          { id: '3', prerequisites: ['4'] }, // blocked (4 doesn't exist)
          { id: '4', completed: true, prerequisites: ['1'] }, // completed, not blocked
        ],
      };

      const result = getBlockedNodes(htaData);
      expect(result).toHaveLength(2);
      expect(result.map(n => n.id)).toEqual(['2', '3']);
    });

    test('handles nodes with no prerequisites', () => {
      const htaData = {
        frontierNodes: [{ id: '1' }, { id: '2', prerequisites: [] }],
      };

      const result = getBlockedNodes(htaData);
      expect(result).toHaveLength(0);
    });

    test('handles missing data', () => {
      expect(getBlockedNodes({})).toEqual([]);
      expect(getBlockedNodes(null)).toEqual([]);
    });
  });

  describe('Edge Cases and Malformed Data', () => {
    test('handles malformed node objects', () => {
      const htaData = {
        frontierNodes: [
          null,
          undefined,
          { id: '1' },
          'not an object',
          { id: '2', completed: true },
        ],
      };

      const progress = calculateProgress(htaData);
      expect(progress.total).toBe(5);
      expect(progress.completed).toBe(1);
    });

    test('handles malformed prerequisites', () => {
      const htaData = {
        frontierNodes: [
          { id: '1', prerequisites: 'not an array' },
          { id: '2', prerequisites: null },
          { id: '3', deps: ['1'] }, // alternative field name
        ],
      };

      const ready = getReadyNodes(htaData);
      expect(ready).toHaveLength(3); // All should be ready since malformed prereqs are ignored
    });

    test('performance with large datasets', () => {
      const largeDataset = {
        frontierNodes: Array.from({ length: 1000 }, (_, i) => ({
          id: `task_${i}`,
          completed: i % 3 === 0,
          prerequisites: i > 0 ? [`task_${i - 1}`] : [],
        })),
      };

      const start = Date.now();
      const result = getReadyNodes(largeDataset);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100); // Should be fast
      expect(result.length).toBeGreaterThan(0);
    });
  });
});

// @ts-nocheck
import { jest } from '@jest/globals';
import { detectGenericTitles, validateTaskContextRelevance, shouldRejectResponse } from '../task-quality-verifier.js';

describe('task-quality-verifier', () => {
  const projectContext = {
    travellerConstraints: [
      { motion_sensitivity: true },
      { dietary_restrictions: ['vegetarian'] }
    ]
  };

  it('detectGenericTitles finds generic patterns', () => {
    const tasks = [{ title: 'Foundation Task' }, { title: 'Take a photo at sunset' }];
    const generics = detectGenericTitles(tasks);
    expect(generics).toContain('Foundation Task');
    expect(generics).not.toContain('Take a photo at sunset');
  });

  it('validateTaskContextRelevance detects relevance', () => {
    const tasks = [{ title: 'Find vegetarian restaurants' }];
    expect(validateTaskContextRelevance(tasks, projectContext)).toBe(true);
  });

  it('shouldRejectResponse flags bad sets', () => {
    const badTasks = [{ title: 'Task 1' }];
    expect(shouldRejectResponse(badTasks, projectContext)).toBe(true);
  });

  it('should accept valid hierarchical tasks', () => {
    const good = [
      { id: 'b1', branch_name: 'Foundations', sub_branches: [], tasks: [
          { title: 'Read documentation', description: '', duration: 30 }
        ] }
    ];
    expect(shouldRejectResponse(good, projectContext)).toBe(false);
  });

  it('should reject tasks with bad granularity', () => {
    const tooLong = [{ title: 'Deep dive', duration: 120 }];
    expect(shouldRejectResponse(tooLong, projectContext)).toBe(true);
  });
}); 
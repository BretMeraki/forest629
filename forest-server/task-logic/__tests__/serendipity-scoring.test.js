// @ts-nocheck
import { jest } from '@jest/globals';
import { TaskScorer } from '../task-scorer.js';
import { SCORING, TIME_CONVERSION } from '../../constants.js';

describe('TaskScorer – serendipity boost', () => {
  const baseTask = {
    id: 't1',
    title: 'Fresh Follow-up Experiment',
    priority: 100,
    depth: 2,
    prerequisites: [],
    difficulty: 3,
    duration: '30 minutes'
  };

  const projectContext = { completedTasks: [] };

  test('fresh serendipitous task receives additional score', () => {
    // Clone task without serendipity metadata
    const stale = { ...baseTask };

    // Clone task with metadata marked as freshly created (now)
    const fresh = {
      ...baseTask,
      serendipityCreatedAt: new Date().toISOString(),
      serendipitySource: 'follow_up'
    };

    const timeAvail = 60; // minutes
    const energy = 3;

    const scoreStale = TaskScorer.calculateTaskScore(
      stale,
      energy,
      timeAvail,
      '',
      projectContext
    );

    const scoreFresh = TaskScorer.calculateTaskScore(
      fresh,
      energy,
      timeAvail,
      '',
      projectContext
    );

    // Fresh task should score at least the configured SERENDIPITY_FRESH_BOOST higher
    expect(scoreFresh).toBeGreaterThanOrEqual(
      scoreStale + SCORING.SERENDIPITY_FRESH_BOOST * 0.9 // allow minor rounding loss
    );
  });

  test('serendipity boost decays after configured hours', () => {
    const pastDate = new Date(
      Date.now() - SCORING.SERENDIPITY_DECAY_HOURS * TIME_CONVERSION.MILLISECONDS_PER_HOUR - 60_000
    ).toISOString();

    const aged = { ...baseTask, serendipityCreatedAt: pastDate };

    const scoreAged = TaskScorer.calculateTaskScore(
      aged,
      3,
      60,
      '',
      projectContext
    );

    const scoreBase = TaskScorer.calculateTaskScore(
      baseTask,
      3,
      60,
      '',
      projectContext
    );

    // After decay window, boost should be gone (allow small diff due to rounding)
    expect(scoreAged).toBeCloseTo(scoreBase, 1);
  });
}); 
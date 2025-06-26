import { jest } from '@jest/globals';
import fs from 'fs';

// Since server-modular.js is an ESM module with top-level side-effects we must dynamically import
let CleanForestServer;

beforeAll(async () => {
  const mod = await import('../../server-modular.js');
  CleanForestServer = mod.default ? mod.default : mod.CleanForestServer || mod.CleanForestServer;
  if (!CleanForestServer) {
    // Fallback: locate named export in module
    CleanForestServer = Object.values(mod).find(v => typeof v === 'function' && v.name === 'CleanForestServer');
  }
});

describe('Skeleton pipeline edge cases', () => {
  test('generateSkeletonBranches returns non-empty array when given zero values', () => {
    const srv = new CleanForestServer();
    const branches = srv.generateSkeletonBranches({ main_branches: 0, sub_branches_per_main: 0, tasks_per_leaf: 0 });
    expect(Array.isArray(branches)).toBe(true);
    expect(branches.length).toBeGreaterThan(0);
  });

  test('formatSkeletonSummary returns guidance for empty input', () => {
    const srv = new CleanForestServer();
    const summary = srv.formatSkeletonSummary([]);
    expect(summary).toMatch(/Learning Structure Created/);
    expect(summary).toMatch(/get_next_task/);
  });
});
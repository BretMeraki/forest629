/* @ts-nocheck */
import fs from 'fs';
import path from 'path';
import EventEmitter from 'events';
import { jest } from '@jest/globals';
import ContextGuard from './context-guard.js';
import SelfHealManager from './self-heal-manager.js';
import ComponentHealthReporter from './utils/component-health-reporter.js';

// Use a temp memory file so we don't clash with real runs
const tmpMemoryFile = path.join(process.cwd(), 'memory.test.json');

beforeEach(() => {
  if (fs.existsSync(tmpMemoryFile)) fs.unlinkSync(tmpMemoryFile);
});

afterAll(() => {
  if (fs.existsSync(tmpMemoryFile)) fs.unlinkSync(tmpMemoryFile);
});

describe('Context validation system', () => {
  test('ComponentHealthReporter writes pass/fail status', () => {
    const reporter = new ComponentHealthReporter({}, { memoryFile: tmpMemoryFile });
    // Fake aggregated result with two suites
    const fakeAggregated = {
      testResults: [
        {
          testFilePath: '/tmp/task-selector.test.js',
          numFailingTests: 0,
          numPassingTests: 3,
        },
        {
          testFilePath: '/tmp/hta-tree-builder.test.js',
          numFailingTests: 2,
          numPassingTests: 1,
        },
      ],
    };

    reporter.onRunComplete([], fakeAggregated);

    const store = JSON.parse(fs.readFileSync(tmpMemoryFile, 'utf8'));
    expect(store['component_status:task-selector'].status).toBe('pass');
    expect(store['component_status:hta-tree-builder'].status).toBe('fail');
  });

  test('ContextGuard validates and emits contradiction', done => {
    // seed memory file
    const store = { 'component_status:demo': { status: 'fail' } };
    fs.writeFileSync(tmpMemoryFile, JSON.stringify(store));

    const guard = new ContextGuard({ memoryFile: tmpMemoryFile, logger: console });
    guard.on('context_contradiction', payload => {
      expect(payload.componentName).toBe('demo');
      done();
    });
    const result = guard.validateComponentHealth('demo', 'healthy');
    expect(result).toBe(false);
  });

  test('SelfHealManager calls execSync on trigger', async () => {
    // Mock child_process BEFORE importing SelfHealManager (ESM)
    jest.unstable_mockModule('child_process', () => ({ execSync: jest.fn() }));

    const { default: SelfHealManagerMocked } = await import('./self-heal-manager.js');
    const cp = await import('child_process');

    const fakeBus = new EventEmitter();
    const manager = new SelfHealManagerMocked({ eventBus: fakeBus, logger: console, memoryFile: tmpMemoryFile });

    await manager.triggerSelfHealing('demo', {});
    expect(cp.execSync).toHaveBeenCalled();
  });
}); 
/*
 * ComponentHealthReporter
 * Custom Jest reporter that publishes component health results to Memory MCP using bulk set_many.
 * This is a lightweight initial implementation – it can be extended with richer metadata later.
 */
import { FileSystem } from './file-system.js';
import path from 'path';
// @ts-nocheck

export default class ComponentHealthReporter {
  constructor(globalConfig, options = {}) {
    this.options = options;
    // Memory file path can be supplied via reporter options or defaults to project root memory.json
    const memoryFileOption = options.memoryFile || path.resolve(process.cwd(), 'memory.json');
    this.memoryFile = memoryFileOption;
  }

  // Helper to read current memory store
  async _loadMemory() {
    try {
      const raw = await FileSystem.readFile(this.memoryFile, 'utf8');
      return JSON.parse(raw);
    } catch (err) {
      // Only log if it's not a simple "file doesn't exist" error
      if (err.code !== 'ENOENT') {
        console.error('[ComponentHealthReporter] Failed to load memory file', err.message);
      }
      return {};
    }
  }

  // Helper to write memory store atomically
  async _saveMemory(store) {
    try {
      await FileSystem.writeFile(this.memoryFile, JSON.stringify(store, null, 2));
    } catch (err) {
      /* eslint-disable no-console */
      console.error('[ComponentHealthReporter] Failed to write memory file', err);
      /* eslint-enable no-console */
    }
  }

  // Jest invokes this when all test suites complete
  onRunComplete(_contexts, aggregatedResult) {
    const store = this._loadMemory();
    const bulkItems = [];

    aggregatedResult.testResults.forEach(suite => {
      // Derive component name from file path heuristically
      const relativePath = path.relative(process.cwd(), suite.testFilePath);
      const componentMatch = relativePath.match(/([\w-]+)\.test\.[jt]s/);
      const componentName = componentMatch ? componentMatch[1] : path.basename(relativePath);

      const status = suite.numFailingTests === 0 ? 'pass' : 'fail';

      const key = `component_status:${componentName}`;
      const value = {
        status,
        meta: {
          testCount: suite.numPassingTests + suite.numFailingTests,
          failures: suite.numFailingTests,
          timestamp: new Date().toISOString(),
        },
      };
      store[key] = value; // simple direct write; later versions may call set_many via MCP
      bulkItems.push({ key, value });
    });

    // Save updated memory file once
    this._saveMemory(store);

    // Optional: log a summary to console for visibility
    /* eslint-disable no-console */
    console.log(`\n[ComponentHealthReporter] Published health for ${bulkItems.length} component(s) to Memory.`);
    /* eslint-enable no-console */
  }
} 
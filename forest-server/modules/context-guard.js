// @ts-nocheck
/**
 * ContextGuard Middleware
 * Lightweight initial implementation that validates component health against Memory MCP before allowing operations.
 */
import EventEmitter from 'events';
import { FileSystem } from './utils/file-system.js';
import path from 'path';

class ContextGuard extends EventEmitter {
  constructor({ memoryFile = path.resolve(process.cwd(), 'memory.json'), logger = console } = {}) {
    super();
    this.memoryFile = memoryFile;
    this.logger = logger;
    this.cache = new Map();
    this.cacheTTLms = 10_000; // 10-s TTL for validation cache
  }

  async _loadMemory() {
    try {
      const raw = await FileSystem.readFile(this.memoryFile, 'utf8');
      return JSON.parse(raw);
    } catch (_) {
      return {};
    }
  }

  _getCached(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;
    if (Date.now() - cached.ts > this.cacheTTLms) {
      this.cache.delete(key);
      return null;
    }
    return cached.value;
  }

  _setCache(key, value) {
    this.cache.set(key, { value, ts: Date.now() });
  }

  getComponentStatus(componentName) {
    const cached = this._getCached(componentName);
    if (cached !== null) return cached;

    const store = this._loadMemory();
    const key = `component_status:${componentName}`;
    const entry = store[key] || null;
    const status = entry?.status || 'unknown';
    this._setCache(componentName, status);
    return status;
  }

  validateComponentHealth(componentName, contextClaim = 'healthy') {
    const status = this.getComponentStatus(componentName);

    const matches =
      (contextClaim === 'healthy' && status === 'pass') ||
      (contextClaim === 'unhealthy' && status === 'fail');

    const result = { componentName, status, matches };

    // Emit event
    this.emit('validation_check', result);
    if (!matches) {
      this.logger.warn?.(`ContextGuard mismatch for ${componentName}: claim=${contextClaim}, actual=${status}`);
      this.emit('context_contradiction', result);
    }
    return matches;
  }
}

export default ContextGuard; 
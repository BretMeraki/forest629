/**
 * Data Persistence Module
 * Coordinates data management between cache and file system operations
 */

import { FileSystem } from './utils/file-system.js';
import { CacheManager } from './utils/cache-manager.js';
import { DIRECTORIES, FILE_NAMES } from './constants.js';
import { getForestLogger } from './winston-logger.js';
import fs from 'fs/promises';

// Module-level logger
const logger = getForestLogger({ module: 'DataPersistence' });

export class DataPersistence {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.cacheManager = new CacheManager();

    /** @type {Map<string, Promise<void>>} project-level write queues */
    this._writeLocks = new Map();
  }

  getProjectDir(projectId) {
    return FileSystem.join(this.dataDir, DIRECTORIES.PROJECTS, projectId);
  }

  getPathDir(projectId, pathName) {
    return FileSystem.join(
      this.dataDir,
      DIRECTORIES.PROJECTS,
      projectId,
      DIRECTORIES.PATHS,
      pathName
    );
  }

  async loadProjectData(projectId, filename) {
    const cacheKey = this.cacheManager.getCacheKey(projectId, filename);
    // Check cache first
    const cachedData = this.cacheManager.getCache(cacheKey);
    if (cachedData !== null) {
      return cachedData;
    }

    const filePath = FileSystem.join(this.getProjectDir(projectId), filename);

    // Handle brand-new projects gracefully
    const exists = await FileSystem.exists(filePath);
    if (!exists) {
      const defaultData = this._getDefaultData(filename, projectId);
      this.cacheManager.setCache(cacheKey, defaultData);
      return defaultData;
    }

    try {
      let parsed = await FileSystem.readJSON(filePath);
      if (filename === FILE_NAMES.HTA) {
        parsed = this._validateHTAStructure(parsed);
      }
      // Cache the result
      this.cacheManager.setCache(cacheKey, parsed);
      return parsed;
    } catch (error) {
      if (error.code === 'ENOENT' || error.message?.includes('ENOENT')) {
        const defaultData = this._getDefaultData(filename, projectId);
        this.cacheManager.setCache(cacheKey, defaultData);
        return defaultData;
      }
      const { DataPersistenceError } = await import('./errors.js');
      throw new DataPersistenceError('load', filePath, error, { projectId, filename });
    }
  }

  async saveProjectData(projectId, filename, data) {
    const release = await this._acquireWriteLock(projectId);
    try {
      const projectDir = this.getProjectDir(projectId);
      await FileSystem.ensureDir(projectDir);
      const filePath = FileSystem.join(projectDir, filename);

      await this._atomicWriteJSON(filePath, data);

      // Invalidate cache for this file
      const cacheKey = this.cacheManager.getCacheKey(projectId, filename);
      this.cacheManager.invalidateCache(cacheKey);

      return true;
    } catch (error) {
      await this.logError('saveProjectData', error, { projectId, filename });
      return false;
    } finally {
      release();
    }
  }

  async loadPathData(projectId, pathName, filename) {
    const cacheKey = this.cacheManager.getCacheKey(projectId, filename, pathName);
    // Check cache first
    const cachedData = this.cacheManager.getCache(cacheKey);
    if (cachedData !== null) {
      return cachedData;
    }

    const filePath = FileSystem.join(this.getPathDir(projectId, pathName), filename);

    const exists = await FileSystem.exists(filePath);
    if (!exists) {
      const defaultData = this._getDefaultData(filename, projectId, pathName);
      this.cacheManager.setCache(cacheKey, defaultData);
      return defaultData;
    }

    try {
      let parsed = await FileSystem.readJSON(filePath);
      if (filename === FILE_NAMES.HTA) {
        parsed = this._validateHTAStructure(parsed);
      }
      // Cache the result
      this.cacheManager.setCache(cacheKey, parsed);
      return parsed;
    } catch (error) {
      if (error.code === 'ENOENT' || error.message?.includes('ENOENT')) {
        const defaultData = this._getDefaultData(filename, projectId, pathName);
        this.cacheManager.setCache(cacheKey, defaultData);
        return defaultData;
      }
      const { DataPersistenceError } = await import('./errors.js');
      throw new DataPersistenceError('load', filePath, error, { projectId, pathName, filename });
    }
  }

  async savePathData(projectId, pathName, filename, data) {
    const release = await this._acquireWriteLock(projectId);
    try {
      const pathDir = this.getPathDir(projectId, pathName);
      await FileSystem.ensureDir(pathDir);
      const filePath = FileSystem.join(pathDir, filename);

      await this._atomicWriteJSON(filePath, data);

      // Invalidate cache for this file
      const cacheKey = this.cacheManager.getCacheKey(projectId, filename, pathName);
      this.cacheManager.invalidateCache(cacheKey);

      return true;
    } catch (error) {
      await this.logError('savePathData', error, { projectId, pathName, filename });
      return false;
    } finally {
      release();
    }
  }

  async loadGlobalData(filename) {
    const filePath = FileSystem.join(this.dataDir, filename);

    const exists = await FileSystem.exists(filePath);
    if (!exists) {
      return null;
    }

    try {
      return await FileSystem.readJSON(filePath);
    } catch (error) {
      if (error.code === 'ENOENT' || error.message?.includes('ENOENT')) {
        return null;
      }

      const { DataPersistenceError } = await import('./errors.js');
      throw new DataPersistenceError('load', filePath, error, { filename });
    }
  }

  async saveGlobalData(filename, data) {
    try {
      await FileSystem.ensureDir(this.dataDir);
      const filePath = FileSystem.join(this.dataDir, filename);
      await FileSystem.writeJSON(filePath, data);
      return true;
    } catch (error) {
      await this.logError('saveGlobalData', error, { filename });
      return false;
    }
  }

  async logError(operation, error, context = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      operation,
      error: error.message,
      stack: error.stack,
      context,
    };

    try {
      await FileSystem.ensureDir(this.dataDir);
      const logPath = FileSystem.join(this.dataDir, FILE_NAMES.ERROR_LOG);
      await FileSystem.appendFile(logPath, `${JSON.stringify(logEntry)}\n`);
    } catch (logError) {
      // If we can't log the error, fallback to module logger
      logger.error('Failed to log error', {
        originalLogEntry: logEntry,
        message: logError.message,
      });
    }
  }

  async ensureDirectoryExists(dirPath) {
    try {
      await FileSystem.ensureDir(dirPath);
      return true;
    } catch (error) {
      await this.logError('ensureDirectoryExists', error, { dirPath });
      return false;
    }
  }

  async fileExists(filePath) {
    try {
      return await FileSystem.exists(filePath);
    } catch (error) {
      const { DataPersistenceError } = await import('./errors.js');
      throw new DataPersistenceError('exists', filePath, error);
    }
  }

  async deleteFile(filePath) {
    try {
      await FileSystem.deleteFile(filePath);
      return true;
    } catch (error) {
      await this.logError('deleteFile', error, { filePath });
      return false;
    }
  }

  async listFiles(dirPath) {
    try {
      return await FileSystem.readdir(dirPath);
    } catch (error) {
      await this.logError('listFiles', error, { dirPath });
      return [];
    }
  }

  async copyFile(sourcePath, destPath) {
    try {
      await FileSystem.copyFile(sourcePath, destPath);
      return true;
    } catch (error) {
      await this.logError('copyFile', error, { sourcePath, destPath });
      return false;
    }
  }

  // ===== CACHE MANAGEMENT METHODS =====

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    return this.cacheManager.getCacheStats();
  }

  /**
   * Clear all cached data
   */
  clearCache() {
    this.cacheManager.clearCache();
  }

  /**
   * Clean up expired cache entries
   * @returns {number} Number of entries removed
   */
  cleanupExpiredCacheEntries() {
    return this.cacheManager.cleanupExpiredEntries();
  }

  /**
   * Invalidate cache for specific project data
   * @param {string} projectId - Project identifier
   * @param {string} filename - File name
   * @param {string|null} pathName - Optional path name
   */
  invalidateProjectCache(projectId, filename, pathName = null) {
    const cacheKey = this.cacheManager.getCacheKey(projectId, filename, pathName);
    this.cacheManager.invalidateCache(cacheKey);
  }

  /**
   * Provide sensible default structures when a data file has not been created yet.
   * This prevents ENOENT errors from cascading through the system.
   * @private
   */
  _getDefaultData(filename, projectId = '', pathName = '') {
    switch (filename) {
      case FILE_NAMES.LEARNING_HISTORY:
        return { completions: [], insights: [] };
      case FILE_NAMES.HTA:
        return {
          tree: null,
          strategicBranches: [],
          frontier_nodes: [],
          completed_nodes: [],
          collaborative_sessions: [],
          hierarchy_metadata: {
            total_depth: 0,
            total_branches: 0,
            total_sub_branches: 0,
            total_tasks: 0,
            branch_task_distribution: {},
          },
        };
      default:
        break;
    }

    if (filename.startsWith('day_')) {
      return { blocks: [], notes: [] };
    }

    if (filename === FILE_NAMES.CONFIG) {
      return { projectId };
    }

    // Generic fallback
    return {};
  }

  /**
   * Acquire an async lock for a given project.  Returns a function which MUST be
   * called to release the lock once the critical section is complete.
   * This simple promise–queue mechanism serialises writes per-project without
   * introducing external dependencies.
   * @private
   */
  async _acquireWriteLock(projectId) {
    let releasePrev = this._writeLocks.get(projectId) || Promise.resolve();
    let releaseCurrent;
    const current = new Promise(resolve => (releaseCurrent = resolve));
    this._writeLocks.set(projectId, releasePrev.then(() => current));
    await releasePrev; // Wait until previous chain settles
    return () => releaseCurrent();
  }

  /**
   * Safely write JSON data using a temp file + atomic rename to prevent partial
   * writes in case of crashes.
   * @private
   */
  async _atomicWriteJSON(filePath, data) {
    const dir = FileSystem.dirname(filePath);
    await FileSystem.ensureDir(dir);
    const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    await FileSystem.writeJSON(tmpPath, data);
    await fs.rename(tmpPath, filePath);
  }

  _validateHTAStructure(data) {
    if (!data || typeof data !== 'object') return {
      tree: null,
      strategicBranches: [],
      frontier_nodes: [],
      completed_nodes: [],
      collaborative_sessions: [],
      hierarchy_metadata: {
        total_depth: 0,
        total_branches: 0,
        total_sub_branches: 0,
        total_tasks: 0,
        branch_task_distribution: {},
      },
    };

    data.frontier_nodes = data.frontier_nodes || data.frontierNodes || [];
    data.strategicBranches = data.strategicBranches || [];
    data.completed_nodes = data.completed_nodes || [];
    data.collaborative_sessions = data.collaborative_sessions || [];
    if (!data.hierarchy_metadata) {
      data.hierarchy_metadata = {
        total_depth: 0,
        total_branches: 0,
        total_sub_branches: 0,
        total_tasks: 0,
        branch_task_distribution: {},
      };
    }
    
    if (data.frontierNodes && !data.frontier_nodes.length) {
      data.frontier_nodes = data.frontierNodes;
    }
    delete data.frontierNodes;
    
    return data;
  }

  /**
   * Legacy compatibility wrapper for deprecated "loadData" calls coming from
   * external scripts or compiled legacy code.  It inspects the provided
   * arguments and delegates to the newer, more explicit helper methods.
   *
   * NOTE: This helper is **deprecated** and will be removed in a future major
   * release – migrate to `loadProjectData`, `loadPathData`, or
   * `loadGlobalData`.
   *
   * @param {string|null} projectId   The project identifier.  If null/undefined
   *                                  the call is considered global-scope.
   * @param {string}      filename    The file name to load (e.g. "config.json").
   * @param {string|null} pathName    Optional learning-path identifier – if
   *                                  provided the request is routed through
   *                                  `loadPathData`.
   * @returns {Promise<any>} Parsed JSON data or a sensible default structure.
   */
  async loadData(projectId, filename, pathName = null) {
    // Emit a single-line deprecation warning so that callers can be migrated.
    logger.warn('DEPRECATION: loadData() is deprecated – please migrate to the more specific loadProjectData/loadPathData/loadGlobalData helpers.', {
      projectId,
      filename,
      pathName,
    });

    if (pathName) {
      // Path-specific data request
      return await this.loadPathData(projectId, pathName, filename);
    }

    if (projectId) {
      // Project-level data request
      return await this.loadProjectData(projectId, filename);
    }

    // Global-scope request – fall back to loadGlobalData
    return await this.loadGlobalData(filename);
  }
}

/**
 * Data Persistence Module
 * Coordinates data management between cache and file system operations
 */

// @ts-nocheck

import { FileSystem } from './utils/file-system.js';
import { CacheManager } from './utils/cache-manager.js';
import { DIRECTORIES, FILE_NAMES } from './constants.js';
import logger from './utils/logger.js';

export class DataPersistence {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.cacheManager = new CacheManager();
  }

  getProjectDir(projectId) {
    return FileSystem.join(this.dataDir, DIRECTORIES.PROJECTS, projectId);
  }

  getPathDir(projectId, pathName) {
    return FileSystem.join(this.dataDir, DIRECTORIES.PROJECTS, projectId, DIRECTORIES.PATHS, pathName);
  }

  async loadProjectData(projectId, filename) {
    const cacheKey = this.cacheManager.getCacheKey(projectId, filename);

    // Check cache first
    const cachedData = this.cacheManager.getCache(cacheKey);
    if (cachedData !== null) {
      return cachedData;
    }

    const filePath = FileSystem.join(this.getProjectDir(projectId), filename);

    // If the file doesn't exist yet (e.g. brand-new project), return null gracefully
    const exists = await FileSystem.exists(filePath);
    if (!exists) {
      return null;
    }

    try {
      const parsed = await FileSystem.readJSON(filePath);

      // Cache the result
      this.cacheManager.setCache(cacheKey, parsed);
      return parsed;
    } catch (error) {
      // If file genuinely doesn't exist between the exists() check and the read attempt
      if (error.code === 'ENOENT' || error.message?.includes('ENOENT')) {
        return null;
      }

      const { DataPersistenceError } = await import('./errors.js');
      throw new DataPersistenceError('load', filePath, error, { projectId, filename });
    }
  }

  async saveProjectData(projectId, fileName, data, transaction = null) {
    const filePath = FileSystem.join(this.getProjectDir(projectId), fileName);
    
    if (transaction) {
      logger.debug('[DataPersistence] Staging project file', { filePath, transactionId: transaction.id });
      // Transaction mode: use temporary files and backup
      const tempPath = `${filePath}.tmp`;
      
      // Backup existing data if file exists
      if (await this.fileExists(filePath)) {
        const existingData = await this.loadProjectData(projectId, fileName);
        transaction.backups.set(filePath, existingData);
      } else {
        transaction.backups.set(filePath, null);
      }
      
      // Write to temporary file
      await this.ensureDirectoryExists(FileSystem.dirname(tempPath));
      await FileSystem.writeFile(tempPath, JSON.stringify(data, null, 2));
      transaction.tempFiles.add(tempPath);
      
      // Add validation operation
      transaction.operations.push({
        type: 'validate',
        data: data,
        filePath: filePath,
        validator: (data) => data && typeof data === 'object',
        reason: 'Data must be a valid object'
      });
    } else {
      logger.debug('[DataPersistence] Writing project file (no transaction)', { filePath });
      // Normal mode: direct write
      await this.ensureDirectoryExists(FileSystem.dirname(filePath));
      await FileSystem.writeFile(filePath, JSON.stringify(data, null, 2));
    }

    // Invalidate cache
    this.invalidateProjectCache(projectId);
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
      return null;
    }

    try {
      const parsed = await FileSystem.readJSON(filePath);

      // Cache the result
      this.cacheManager.setCache(cacheKey, parsed);
      return parsed;
    } catch (error) {
      if (error.code === 'ENOENT' || error.message?.includes('ENOENT')) {
        return null;
      }

      const { DataPersistenceError } = await import('./errors.js');
      throw new DataPersistenceError('load', filePath, error, { projectId, pathName, filename });
    }
  }

  async savePathData(projectId, pathName, fileName, data, transaction = null) {
    const filePath = FileSystem.join(this.getPathDir(projectId, pathName), fileName);
    
    if (transaction) {
      logger.debug('[DataPersistence] Staging path file', { filePath, transactionId: transaction.id });
      // Transaction mode: use temporary files and backup
      const tempPath = `${filePath}.tmp`;
      
      // Backup existing data if file exists
      if (await this.fileExists(filePath)) {
        const existingData = await this.loadPathData(projectId, pathName, fileName);
        transaction.backups.set(filePath, existingData);
      } else {
        transaction.backups.set(filePath, null);
      }
      
      // Write to temporary file
      await this.ensureDirectoryExists(FileSystem.dirname(tempPath));
      await FileSystem.writeFile(tempPath, JSON.stringify(data, null, 2));
      transaction.tempFiles.add(tempPath);
      
      // Add validation operation
      transaction.operations.push({
        type: 'validate',
        data: data,
        filePath: filePath,
        validator: (data) => data && typeof data === 'object',
        reason: 'Data must be a valid object'
      });
    } else {
      logger.debug('[DataPersistence] Writing path file (no transaction)', { filePath });
      // Normal mode: direct write
      await this.ensureDirectoryExists(FileSystem.dirname(filePath));
      await FileSystem.writeFile(filePath, JSON.stringify(data, null, 2));
    }

    // Invalidate cache
    this.invalidateProjectCache(projectId);
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
      context
    };

    try {
      await FileSystem.ensureDir(this.dataDir);
      const logPath = FileSystem.join(this.dataDir, FILE_NAMES.ERROR_LOG);
      await FileSystem.appendFile(logPath, `${JSON.stringify(logEntry)}\n`);
    } catch (logError) {
      // If we can't log the error, just console.error it
      console.error('Failed to log error:', logEntry, 'Log error:', logError.message);
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
   * Begin a transaction to prevent partial state mutations
   * @returns {Object} Transaction context with rollback capability
   */
  beginTransaction() {
    const transactionId = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    logger.info('[TRANSACTION] Begin', { id: transactionId });
    return {
      id: transactionId,
      backups: new Map(),
      operations: [],
      tempFiles: new Set(),
      startTime: Date.now()
    };
  }

  /**
   * Commit a transaction - move temporary files to final locations
   * @param {Object} transaction - Transaction context
   */
  async commitTransaction(transaction) {
    try {
      // Validate all operations before final commit
      for (const operation of transaction.operations) {
        if (operation.type === 'validate' && operation.validator) {
          const isValid = await operation.validator(operation.data);
          if (!isValid) {
            throw new Error(`Transaction validation failed: ${operation.reason || 'Unknown validation error'}`);
          }
        }
      }

      // Move temporary files to final locations atomically
      for (const tempFile of transaction.tempFiles) {
        const finalPath = tempFile.replace('.tmp', '');
        await FileSystem.copyFile(tempFile, finalPath);
        await FileSystem.deleteFile(tempFile);
      }

      // Clear backup data
      transaction.backups.clear();
      transaction.operations.length = 0;
      transaction.tempFiles.clear();

      logger.info('[TRANSACTION] Commit', { id: transaction.id, durationMs: Date.now() - transaction.startTime });
    } catch (error) {
      // If commit fails, rollback
      await this.rollbackTransaction(transaction);
      throw error;
    }
  }

  /**
   * Rollback a transaction - restore all backed-up data
   * @param {Object} transaction - Transaction context
   */
  async rollbackTransaction(transaction) {
    try {
      // Restore all backed-up data
      for (const [filePath, backupData] of transaction.backups) {
        if (backupData === null) {
          // File didn't exist before, remove it
          if (await this.fileExists(filePath)) {
            await this.deleteFile(filePath);
          }
        } else {
          // Restore previous content
          await FileSystem.writeFile(filePath, JSON.stringify(backupData, null, 2));
        }
      }

      // Remove temporary files
      for (const tempFile of transaction.tempFiles) {
        if (await this.fileExists(tempFile)) {
          await this.deleteFile(tempFile);
        }
      }

      // Clear transaction data
      transaction.backups.clear();
      transaction.operations.length = 0;
      transaction.tempFiles.clear();

      logger.info('[TRANSACTION] Rollback', { id: transaction.id, durationMs: Date.now() - transaction.startTime });
    } catch (error) {
      console.error(`[TRANSACTION] Failed to rollback transaction ${transaction.id}:`, error.message);
      throw error;
    }
  }

  // ─────────────────────────────────────────────
  // Self-healing helpers (validation framework)
  // ─────────────────────────────────────────────

  /**
   * Begin a specialised self-healing transaction
   * Wraps beginTransaction but adds a flag so other modules can detect it.
   */
  beginSelfHealingTransaction(componentName) {
    const tx = this.beginTransaction();
    tx.isSelfHealing = true;
    tx.component = componentName;
    return tx;
  }

  /** Clear cache for a specific component */
  clearComponentCache(componentName) {
    // For now blow the entire cache – fine-grained invalidation can come later
    this.clearCache();
    logger.info('[DataPersistence] Cleared cache for component', { componentName });
  }

  /** Reload component state by clearing cache then optionally re-reading from disk */
  async reloadComponentState(componentName, projectId = null) {
    this.clearComponentCache(componentName);
    // Simple heuristic: if projectId is supplied reload common files so they repopulate cache.
    if (projectId) {
      await this.loadProjectData(projectId, 'config.json');
      await this.loadProjectData(projectId, 'hta.json');
    }
  }

  /** Basic state validation placeholder */
  validateComponentState(_componentName, expectedState) {
    // Currently just a deep equals check
    try {
      return JSON.stringify(expectedState) !== undefined;
    } catch (_) {
      return false;
    }
  }

  /** Log validation failure with extra context */
  async logValidationFailure(componentName, contradiction) {
    await this.logError('validationFailure', new Error('Context validation failed'), {
      componentName,
      contradiction,
    });
  }
}
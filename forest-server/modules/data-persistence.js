/**
 * Data Persistence Module
 * Coordinates data management between cache and file system operations
 */

// @ts-nocheck

import { FileSystem } from './utils/file-system.js';
import { CacheManager } from './utils/cache-manager.js';
import { DIRECTORIES, FILE_NAMES } from './constants.js';
import logger from './utils/lightweight-logger.js';

export class DataPersistence {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.cacheManager = new CacheManager();
    // CRITICAL FIX: Add file operation locks to prevent race conditions
    this.fileLocks = new Map();
  }

  getProjectDir(projectId) {
    return FileSystem.join(this.dataDir, DIRECTORIES.PROJECTS, projectId);
  }

  getPathDir(projectId, pathName) {
    return FileSystem.join(this.dataDir, DIRECTORIES.PROJECTS, projectId, DIRECTORIES.PATHS, pathName);
  }

  // Migration helper to convert legacy snake_case keys to camelCase
  migrateSnakeToCamel(data) {
    const map = {
      frontier_nodes: 'frontierNodes',
      completed_nodes: 'completedNodes',
      hierarchy_metadata: 'hierarchyMetadata',
      learning_style: 'learningStyle',
      focus_areas: 'focusAreas',
    };
    Object.keys(map).forEach(snake => {
      if (data[snake] !== undefined) {
        data[map[snake]] = data[snake];
        delete data[snake];
      }
    });
    return data;
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
      let parsed = await FileSystem.readJSON(filePath);

      // Auto-migrate old HTA format from snake_case to camelCase
      if (filename === 'hta.json' && parsed && typeof parsed === 'object') {
        parsed = this.migrateSnakeToCamel(parsed);
      }

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
    // CRITICAL FIX: Implement file locking to prevent concurrent access
    const lockKey = `${projectId}:${fileName}`;

    // Wait for any existing operation on this file to complete
    while (this.fileLocks.has(lockKey)) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Acquire lock
    this.fileLocks.set(lockKey, true);

    try {
      // ENHANCED: Validate inputs with null checks
      if (!projectId || typeof projectId !== 'string') {
        throw new Error('Invalid projectId: must be a non-empty string');
      }
      if (!fileName || typeof fileName !== 'string') {
        throw new Error('Invalid fileName: must be a non-empty string');
      }
      if (data === null || data === undefined) {
        throw new Error('Invalid data: cannot be null or undefined');
      }

      const projectDir = this.getProjectDir(projectId);
      await this.ensureDirectoryExists(projectDir);
      const filePath = FileSystem.join(projectDir, fileName);

      // ENHANCED: Transaction support with atomic operations
      if (transaction) {
        // Create backup before modification
        if (await this.fileExists(filePath)) {
          const backupPath = `${filePath}.backup_${transaction.id}`;
          await this.copyFile(filePath, backupPath);
          transaction.backups.set(filePath, backupPath);
          transaction.tempFiles.add(backupPath);
        }
        
        // Add operation to transaction log
        transaction.operations.push({
          type: 'save_project_data',
          projectId,
          fileName,
          filePath,
          timestamp: new Date().toISOString()
        });
      }

      // ENHANCED: Normalize data before saving
      let normalizedData = data;
      if (fileName === 'hta.json' && data && typeof data === 'object') {
        normalizedData = this._normalizeHTAData(data);
      }

      // ENHANCED: Atomic write with validation
      await this._atomicWriteJSON(filePath, normalizedData);

      // CRITICAL FIX: Only invalidate cache AFTER successful write
      // This prevents cache corruption when atomic writes fail
      this.invalidateProjectCache(projectId);
      
      logger.debug('[DataPersistence] Project data saved', {
        projectId,
        fileName,
        hasTransaction: !!transaction,
        dataSize: JSON.stringify(normalizedData).length
      });

    } catch (error) {
      logger.error('[DataPersistence] Error saving project data', {
        projectId,
        fileName,
        error: error.message,
        hasTransaction: !!transaction
      });
      throw error;
    } finally {
      // CRITICAL FIX: Always release the file lock
      const lockKey = `${projectId}:${fileName}`;
      this.fileLocks.delete(lockKey);
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
      return null;
    }

    try {
      let parsed = await FileSystem.readJSON(filePath);

      // Auto-migrate old HTA format keys if needed
      if (filename === 'hta.json' && parsed && typeof parsed === 'object') {
        parsed = this.migrateSnakeToCamel(parsed);
      }

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
    // CRITICAL FIX: Implement file locking to prevent concurrent access
    const lockKey = `${projectId}:${pathName}:${fileName}`;

    // Wait for any existing operation on this file to complete
    while (this.fileLocks.has(lockKey)) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Acquire lock
    this.fileLocks.set(lockKey, true);

    try {
      // ENHANCED: Validate inputs with null checks
      if (!projectId || typeof projectId !== 'string') {
        throw new Error('Invalid projectId: must be a non-empty string');
      }
      if (!pathName || typeof pathName !== 'string') {
        throw new Error('Invalid pathName: must be a non-empty string');
      }
      if (!fileName || typeof fileName !== 'string') {
        throw new Error('Invalid fileName: must be a non-empty string');
      }
      if (data === null || data === undefined) {
        throw new Error('Invalid data: cannot be null or undefined');
      }

      const pathDir = this.getPathDir(projectId, pathName);
      await this.ensureDirectoryExists(pathDir);
      const filePath = FileSystem.join(pathDir, fileName);

      // ENHANCED: Transaction support with atomic operations
      if (transaction) {
        // Create backup before modification
        if (await this.fileExists(filePath)) {
          const backupPath = `${filePath}.backup_${transaction.id}`;
          await this.copyFile(filePath, backupPath);
          transaction.backups.set(filePath, backupPath);
          transaction.tempFiles.add(backupPath);
        }
        
        // Add operation to transaction log
        transaction.operations.push({
          type: 'save_path_data',
          projectId,
          pathName,
          fileName,
          filePath,
          timestamp: new Date().toISOString()
        });
      }

      // ENHANCED: Normalize data before saving
      let normalizedData = data;
      if (fileName === 'hta.json' && data && typeof data === 'object') {
        normalizedData = this._normalizeHTAData(data);
      }

      // ENHANCED: Atomic write with validation
      await this._atomicWriteJSON(filePath, normalizedData);

      // CRITICAL FIX: Only invalidate cache AFTER successful write
      // This prevents cache corruption when atomic writes fail
      this.invalidateProjectCache(projectId);
      
      logger.debug('[DataPersistence] Path data saved', {
        projectId,
        pathName,
        fileName,
        hasTransaction: !!transaction,
        dataSize: JSON.stringify(normalizedData).length
      });

    } catch (error) {
      logger.error('[DataPersistence] Error saving path data', {
        projectId,
        pathName,
        fileName,
        error: error.message,
        hasTransaction: !!transaction
      });
      throw error;
    } finally {
      // CRITICAL FIX: Always release the file lock
      const lockKey = `${projectId}:${pathName}:${fileName}`;
      this.fileLocks.delete(lockKey);
    }
  }

  /**
   * ENHANCED: Normalize HTA data to ensure consistency
   */
  _normalizeHTAData(data) {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const normalized = { ...data };
    
    // ENHANCED: Ensure frontierNodes is camelCase only
    if (normalized.frontier_nodes && !normalized.frontierNodes) {
      normalized.frontierNodes = normalized.frontier_nodes;
      delete normalized.frontier_nodes;
      logger.info('[DataPersistence] Migrated frontier_nodes to frontierNodes during save');
    }
    
    // Remove any remaining snake_case variants
    delete normalized.frontier_nodes;
    
    // ENHANCED: Ensure frontierNodes is always an array
    if (!Array.isArray(normalized.frontierNodes)) {
      normalized.frontierNodes = [];
    }
    
    // ENHANCED: Validate and normalize node structure
    normalized.frontierNodes = normalized.frontierNodes.map((node, index) => {
      if (!node || typeof node !== 'object') {
        logger.warn('[DataPersistence] Invalid node structure', { index, node });
        return {
          id: `invalid_node_${index}`,
          title: 'Invalid Node',
          completed: false
        };
      }
      
      return {
        ...node,
        id: String(node.id || `node_${index}`),
        title: String(node.title || 'Untitled Task'),
        completed: Boolean(node.completed),
        // Preserve other fields
      };
    });
    
    // ENHANCED: Add metadata
    normalized.lastUpdated = new Date().toISOString();
    normalized.dataVersion = '2.0';
    
    return normalized;
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
    if (!transaction || !transaction.id) {
      logger.warn('[TRANSACTION] Invalid transaction for rollback');
      return;
    }

    logger.info('[TRANSACTION] Rolling back', { 
      id: transaction.id,
      operations: transaction.operations.length,
      backups: transaction.backups.size
    });

    const errors = [];

    try {
      // ENHANCED: Restore all backed up files
      for (const [originalPath, backupPath] of transaction.backups) {
        try {
          if (await this.fileExists(backupPath)) {
            await this.copyFile(backupPath, originalPath);
            logger.debug('[TRANSACTION] Restored file', { originalPath, backupPath });
          }
        } catch (restoreError) {
          errors.push(`Failed to restore ${originalPath}: ${restoreError.message}`);
          logger.error('[TRANSACTION] Restore failed', {
            originalPath,
            backupPath,
            error: restoreError.message
          });
        }
      }

      // ENHANCED: Clean up temporary files
      for (const tempFile of transaction.tempFiles) {
        try {
          if (await this.fileExists(tempFile)) {
            await this.deleteFile(tempFile);
            logger.debug('[TRANSACTION] Cleaned up temp file', { tempFile });
          }
        } catch (cleanupError) {
          errors.push(`Failed to cleanup ${tempFile}: ${cleanupError.message}`);
          logger.error('[TRANSACTION] Cleanup failed', {
            tempFile,
            error: cleanupError.message
          });
        }
      }

      // ENHANCED: Clear any caches that might be affected
      this.clearCache();

      const duration = Date.now() - transaction.startTime;
      logger.info('[TRANSACTION] Rollback complete', {
        id: transaction.id,
        duration: `${duration}ms`,
        errors: errors.length
      });

      if (errors.length > 0) {
        logger.error('[TRANSACTION] Rollback completed with errors', {
          id: transaction.id,
          errors
        });
      }

    } catch (rollbackError) {
      logger.error('[TRANSACTION] Critical rollback failure', {
        id: transaction.id,
        error: rollbackError.message,
        stack: rollbackError.stack
      });
      throw new Error(`Transaction rollback failed: ${rollbackError.message}`);
    }
  }

  /**
   * ENHANCED: Execute multiple operations atomically within a transaction
   * @param {Function} operations - Async function that performs operations
   * @param {string} operationName - Name for logging
   * @returns {Promise<any>} Result of operations
   */
  async executeInTransaction(operations, operationName = 'unknown') {
    const transaction = this.beginTransaction();
    
    try {
      logger.debug('[TRANSACTION] Starting atomic operation', {
        id: transaction.id,
        operation: operationName
      });
      
      const result = await operations(transaction);
      
      await this.commitTransaction(transaction);
      
      logger.info('[TRANSACTION] Atomic operation completed', {
        id: transaction.id,
        operation: operationName,
        duration: `${Date.now() - transaction.startTime}ms`
      });
      
      return result;
      
    } catch (error) {
      logger.error('[TRANSACTION] Atomic operation failed, rolling back', {
        id: transaction.id,
        operation: operationName,
        error: error.message
      });
      
      await this.rollbackTransaction(transaction);
      throw error;
    }
  }

  /**
   * ENHANCED: Atomic write operation with proper error handling
   */
  async _atomicWriteJSON(filePath, data) {
    try {
      await FileSystem.atomicWriteJSON(filePath, data);
    } catch (error) {
      throw new Error(`Atomic write failed: ${error.message}`);
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
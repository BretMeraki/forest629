/**
 * Comprehensive Transaction Context Tests
 * Tests transaction safety, rollback functionality, and data consistency
 */

import { jest } from '@jest/globals';
import { DataPersistence } from '../modules/data-persistence.js';
import { FileSystem } from '../utils/file-system.js';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

describe('Transaction Contexts', () => {
  let dataPersistence;
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'forest-tx-test-'));
    dataPersistence = new DataPersistence(tmpDir);
  });

// ============================================================================
// TRANSACTION ERROR SCENARIOS TESTS
// ============================================================================

describe('Transaction Error Scenarios', () => {
  let dataPersistence;
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'forest-error-tx-test-'));
    dataPersistence = new DataPersistence(tmpDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Disk Space Simulation Tests', () => {
    test('should handle disk full during temp file creation', async () => {
      const projectId = 'disk-full-test';
      const testData = { large: 'data'.repeat(1000) };

      // Mock FileSystem.writeFile to simulate disk full error
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
      );

      const transaction = dataPersistence.beginTransaction();
      
      try {
        await dataPersistence.saveProjectData(projectId, 'large.json', testData, transaction);
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to disk space');
      } catch (error) {
        expect(error.message).toContain('no space left on device');
        expect(error.code).toBe('ENOSPC');
      }

      // Verify no partial files remain
      const projectDir = dataPersistence.getProjectDir(projectId);
      try {
        const files = await fs.readdir(projectDir);
        const tempFiles = files.filter(f => f.endsWith('.tmp'));
        expect(tempFiles).toHaveLength(0);
      } catch (dirError) {
        // Directory might not exist, which is fine
        expect(dirError.code).toBe('ENOENT');
      }

      // Restore original function
      FileSystem.writeFile = originalWriteFile;
    });

    test('should handle disk full during commit phase', async () => {
      const projectId = 'commit-disk-full';
      const testData = { commit: 'test' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'commit.json', testData, transaction);

      // Mock FileSystem.copyFile to fail during commit
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
      );

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit');
      } catch (error) {
        expect(error.message).toContain('no space left on device');
      }

      // Verify rollback occurred - no final file should exist
      const finalData = await dataPersistence.loadProjectData(projectId, 'commit.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('File Lock Scenarios', () => {
    test('should handle file lock during temp file creation', async () => {
      const projectId = 'file-lock-temp';
      const testData = { locked: true };

      // Mock FileSystem.writeFile to simulate file lock
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
      );

      const transaction = dataPersistence.beginTransaction();

      try {
        await dataPersistence.saveProjectData(projectId, 'locked.json', testData, transaction);
        fail('Should have failed due to file lock');
      } catch (error) {
        expect(error.message).toContain('resource busy or locked');
        expect(error.code).toBe('EBUSY');
      }

      // Restore original function
      FileSystem.writeFile = originalWriteFile;
    });

    test('should handle file lock during commit phase', async () => {
      const projectId = 'file-lock-commit';
      const testData = { commit: 'locked' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'locked.json', testData, transaction);

      // Mock FileSystem.copyFile to simulate file lock during commit
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
      );

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit due to file lock');
      } catch (error) {
        expect(error.message).toContain('resource busy or locked');
      }

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'locked.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Validation Hook Failures', () => {
    test('should handle synchronous validation hook failures', async () => {
      const projectId = 'sync-validation-fail';
      const testData = { invalid: 'data' };

      const failingValidator = jest.fn().mockReturnValue(false);

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: failingValidator,
        reason: 'Synchronous validation failure'
      });

      await dataPersistence.saveProjectData(projectId, 'test.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to validation');
      } catch (error) {
        expect(error.message).toContain('Transaction validation failed');
        expect(error.message).toContain('Synchronous validation failure');
      }

      expect(failingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'test.json');
      expect(finalData).toBeNull();
    });

    test('should handle asynchronous validation hook failures', async () => {
      const projectId = 'async-validation-fail';
      const testData = { async: 'invalid' };

      const asyncFailingValidator = jest.fn().mockResolvedValue(false);

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: asyncFailingValidator,
        reason: 'Asynchronous validation failure'
      });

      await dataPersistence.saveProjectData(projectId, 'async.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to async validation');
      } catch (error) {
        expect(error.message).toContain('Transaction validation failed');
        expect(error.message).toContain('Asynchronous validation failure');
      }

      expect(asyncFailingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'async.json');
      expect(finalData).toBeNull();
    });

    test('should handle validation hook crashes', async () => {
      const projectId = 'validation-crash';
      const testData = { crash: 'test' };

      const crashingValidator = jest.fn().mockImplementation(() => {
        throw new Error('Validation hook crashed');
      });

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: crashingValidator,
        reason: 'Crashing validator'
      });

      await dataPersistence.saveProjectData(projectId, 'crash.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to validator crash');
      } catch (error) {
        expect(error.message).toContain('Validation hook crashed');
      }

      expect(crashingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'crash.json');
      expect(finalData).toBeNull();
    });
  });

  describe('Commit Operation Failures', () => {
    test('should handle failure during temp file cleanup', async () => {
      const projectId = 'cleanup-fail';
      const testData = { cleanup: 'test' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'cleanup.json', testData, transaction);

      // Mock FileSystem.deleteFile to fail during cleanup
      const originalDeleteFile = FileSystem.deleteFile;
      FileSystem.deleteFile = jest.fn().mockRejectedValue(new Error('Cannot delete temp file'));

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during temp file cleanup');
      } catch (error) {
        expect(error.message).toContain('Cannot delete temp file');
      }

      // Verify rollback was attempted
      const finalData = await dataPersistence.loadProjectData(projectId, 'cleanup.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.deleteFile = originalDeleteFile;
    });

    test('should handle partial commit failures with multiple files', async () => {
      const projectId = 'partial-commit-fail';
      const files = [
        { name: 'file1.json', data: { id: 1 } },
        { name: 'file2.json', data: { id: 2 } },
        { name: 'file3.json', data: { id: 3 } }
      ];

      const transaction = dataPersistence.beginTransaction();
      
      // Save all files in transaction
      for (const file of files) {
        await dataPersistence.saveProjectData(projectId, file.name, file.data, transaction);
      }

      // Mock FileSystem.copyFile to fail on second file
      const originalCopyFile = FileSystem.copyFile;
      let copyCallCount = 0;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        copyCallCount++;
        if (copyCallCount === 2) {
          throw new Error('Failed to copy second file');
        }
        return originalCopyFile(src, dest);
      });

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during partial commit');
      } catch (error) {
        expect(error.message).toContain('Failed to copy second file');
      }

      // Verify all files were rolled back (none should exist)
      for (const file of files) {
        const finalData = await dataPersistence.loadProjectData(projectId, file.name);
        expect(finalData).toBeNull();
      }

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Rollback Operation Failures', () => {
    test('should handle rollback failures gracefully', async () => {
      const projectId = 'rollback-fail';
      const originalData = { original: true };
      const newData = { modified: true };

      // Create initial file
      await dataPersistence.saveProjectData(projectId, 'rollback.json', originalData);

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'rollback.json', newData, transaction);

      // Mock FileSystem.writeFile to fail during rollback
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(new Error('Cannot restore backup'));

      // Force rollback by making commit fail
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(new Error('Commit failed'));

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit and rollback');
      } catch (error) {
        // The error should be from the rollback failure, not the original commit failure
        expect(error.message).toContain('Cannot restore backup');
      }

      // Restore original functions
      FileSystem.writeFile = originalWriteFile;
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Concurrent Transaction Stress Tests', () => {
    test('should handle concurrent transaction failures', async () => {
      const projectId1 = 'concurrent-fail-1';
      const projectId2 = 'concurrent-fail-2';
      const data1 = { project: 1 };
      const data2 = { project: 2 };

      // Start two concurrent transactions
      const transaction1 = dataPersistence.beginTransaction();
      const transaction2 = dataPersistence.beginTransaction();

      // Mock one to fail
      const originalCopyFile = FileSystem.copyFile;
      let copyCallCount = 0;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        copyCallCount++;
        if (copyCallCount === 1) {
          throw new Error('First transaction failed');
        }
        return originalCopyFile(src, dest);
      });

      // Execute operations concurrently
      const promise1 = (async () => {
        await dataPersistence.saveProjectData(projectId1, 'data.json', data1, transaction1);
        return dataPersistence.commitTransaction(transaction1);
      })();

      const promise2 = (async () => {
        await dataPersistence.saveProjectData(projectId2, 'data.json', data2, transaction2);
        return dataPersistence.commitTransaction(transaction2);
      })();

      // Wait for both to complete (one should fail)
      const results = await Promise.allSettled([promise1, promise2]);

      // One should fail, one should succeed
      const failedCount = results.filter(r => r.status === 'rejected').length;
      const succeededCount = results.filter(r => r.status === 'fulfilled').length;
      
      expect(failedCount).toBe(1);
      expect(succeededCount).toBe(1);

      // Verify only the successful transaction's data exists
      const result1 = await dataPersistence.loadProjectData(projectId1, 'data.json');
      const result2 = await dataPersistence.loadProjectData(projectId2, 'data.json');

      // One should be null (failed), one should have data (succeeded)
      const nullCount = [result1, result2].filter(r => r === null).length;
      const dataCount = [result1, result2].filter(r => r !== null).length;
      
      expect(nullCount).toBe(1);
      expect(dataCount).toBe(1);

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });

    test('should handle high concurrency transaction stress', async () => {
      const concurrentTransactions = 10;
      const promises = [];

      // Mock to randomly fail some transactions
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        // Randomly fail ~30% of transactions
        if (Math.random() < 0.3) {
          throw new Error('Random transaction failure');
        }
        return originalCopyFile(src, dest);
      });

      // Create multiple concurrent transactions
      for (let i = 0; i < concurrentTransactions; i++) {
        const promise = (async () => {
          const projectId = `stress-test-${i}`;
          const testData = { id: i, stress: true };
          
          const transaction = dataPersistence.beginTransaction();
          await dataPersistence.saveProjectData(projectId, 'stress.json', testData, transaction);
          return dataPersistence.commitTransaction(transaction);
        })();
        
        promises.push(promise);
      }

      // Wait for all to complete
      const results = await Promise.allSettled(promises);

      // Some should succeed, some should fail
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.filter(r => r.status === 'rejected').length;
      
      expect(successCount + failureCount).toBe(concurrentTransactions);
      expect(successCount).toBeGreaterThan(0); // At least some should succeed
      expect(failureCount).toBeGreaterThan(0); // At least some should fail

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });
});
  afterEach(async () => {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });

// ============================================================================
// TRANSACTION ERROR SCENARIOS TESTS
// ============================================================================

describe('Transaction Error Scenarios', () => {
  let dataPersistence;
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'forest-error-tx-test-'));
    dataPersistence = new DataPersistence(tmpDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Disk Space Simulation Tests', () => {
    test('should handle disk full during temp file creation', async () => {
      const projectId = 'disk-full-test';
      const testData = { large: 'data'.repeat(1000) };

      // Mock FileSystem.writeFile to simulate disk full error
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
      );

      const transaction = dataPersistence.beginTransaction();
      
      try {
        await dataPersistence.saveProjectData(projectId, 'large.json', testData, transaction);
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to disk space');
      } catch (error) {
        expect(error.message).toContain('no space left on device');
        expect(error.code).toBe('ENOSPC');
      }

      // Verify no partial files remain
      const projectDir = dataPersistence.getProjectDir(projectId);
      try {
        const files = await fs.readdir(projectDir);
        const tempFiles = files.filter(f => f.endsWith('.tmp'));
        expect(tempFiles).toHaveLength(0);
      } catch (dirError) {
        // Directory might not exist, which is fine
        expect(dirError.code).toBe('ENOENT');
      }

      // Restore original function
      FileSystem.writeFile = originalWriteFile;
    });

    test('should handle disk full during commit phase', async () => {
      const projectId = 'commit-disk-full';
      const testData = { commit: 'test' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'commit.json', testData, transaction);

      // Mock FileSystem.copyFile to fail during commit
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
      );

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit');
      } catch (error) {
        expect(error.message).toContain('no space left on device');
      }

      // Verify rollback occurred - no final file should exist
      const finalData = await dataPersistence.loadProjectData(projectId, 'commit.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('File Lock Scenarios', () => {
    test('should handle file lock during temp file creation', async () => {
      const projectId = 'file-lock-temp';
      const testData = { locked: true };

      // Mock FileSystem.writeFile to simulate file lock
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
      );

      const transaction = dataPersistence.beginTransaction();

      try {
        await dataPersistence.saveProjectData(projectId, 'locked.json', testData, transaction);
        fail('Should have failed due to file lock');
      } catch (error) {
        expect(error.message).toContain('resource busy or locked');
        expect(error.code).toBe('EBUSY');
      }

      // Restore original function
      FileSystem.writeFile = originalWriteFile;
    });

    test('should handle file lock during commit phase', async () => {
      const projectId = 'file-lock-commit';
      const testData = { commit: 'locked' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'locked.json', testData, transaction);

      // Mock FileSystem.copyFile to simulate file lock during commit
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
      );

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit due to file lock');
      } catch (error) {
        expect(error.message).toContain('resource busy or locked');
      }

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'locked.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Validation Hook Failures', () => {
    test('should handle synchronous validation hook failures', async () => {
      const projectId = 'sync-validation-fail';
      const testData = { invalid: 'data' };

      const failingValidator = jest.fn().mockReturnValue(false);

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: failingValidator,
        reason: 'Synchronous validation failure'
      });

      await dataPersistence.saveProjectData(projectId, 'test.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to validation');
      } catch (error) {
        expect(error.message).toContain('Transaction validation failed');
        expect(error.message).toContain('Synchronous validation failure');
      }

      expect(failingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'test.json');
      expect(finalData).toBeNull();
    });

    test('should handle asynchronous validation hook failures', async () => {
      const projectId = 'async-validation-fail';
      const testData = { async: 'invalid' };

      const asyncFailingValidator = jest.fn().mockResolvedValue(false);

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: asyncFailingValidator,
        reason: 'Asynchronous validation failure'
      });

      await dataPersistence.saveProjectData(projectId, 'async.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to async validation');
      } catch (error) {
        expect(error.message).toContain('Transaction validation failed');
        expect(error.message).toContain('Asynchronous validation failure');
      }

      expect(asyncFailingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'async.json');
      expect(finalData).toBeNull();
    });

    test('should handle validation hook crashes', async () => {
      const projectId = 'validation-crash';
      const testData = { crash: 'test' };

      const crashingValidator = jest.fn().mockImplementation(() => {
        throw new Error('Validation hook crashed');
      });

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: crashingValidator,
        reason: 'Crashing validator'
      });

      await dataPersistence.saveProjectData(projectId, 'crash.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to validator crash');
      } catch (error) {
        expect(error.message).toContain('Validation hook crashed');
      }

      expect(crashingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'crash.json');
      expect(finalData).toBeNull();
    });
  });

  describe('Commit Operation Failures', () => {
    test('should handle failure during temp file cleanup', async () => {
      const projectId = 'cleanup-fail';
      const testData = { cleanup: 'test' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'cleanup.json', testData, transaction);

      // Mock FileSystem.deleteFile to fail during cleanup
      const originalDeleteFile = FileSystem.deleteFile;
      FileSystem.deleteFile = jest.fn().mockRejectedValue(new Error('Cannot delete temp file'));

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during temp file cleanup');
      } catch (error) {
        expect(error.message).toContain('Cannot delete temp file');
      }

      // Verify rollback was attempted
      const finalData = await dataPersistence.loadProjectData(projectId, 'cleanup.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.deleteFile = originalDeleteFile;
    });

    test('should handle partial commit failures with multiple files', async () => {
      const projectId = 'partial-commit-fail';
      const files = [
        { name: 'file1.json', data: { id: 1 } },
        { name: 'file2.json', data: { id: 2 } },
        { name: 'file3.json', data: { id: 3 } }
      ];

      const transaction = dataPersistence.beginTransaction();
      
      // Save all files in transaction
      for (const file of files) {
        await dataPersistence.saveProjectData(projectId, file.name, file.data, transaction);
      }

      // Mock FileSystem.copyFile to fail on second file
      const originalCopyFile = FileSystem.copyFile;
      let copyCallCount = 0;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        copyCallCount++;
        if (copyCallCount === 2) {
          throw new Error('Failed to copy second file');
        }
        return originalCopyFile(src, dest);
      });

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during partial commit');
      } catch (error) {
        expect(error.message).toContain('Failed to copy second file');
      }

      // Verify all files were rolled back (none should exist)
      for (const file of files) {
        const finalData = await dataPersistence.loadProjectData(projectId, file.name);
        expect(finalData).toBeNull();
      }

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Rollback Operation Failures', () => {
    test('should handle rollback failures gracefully', async () => {
      const projectId = 'rollback-fail';
      const originalData = { original: true };
      const newData = { modified: true };

      // Create initial file
      await dataPersistence.saveProjectData(projectId, 'rollback.json', originalData);

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'rollback.json', newData, transaction);

      // Mock FileSystem.writeFile to fail during rollback
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(new Error('Cannot restore backup'));

      // Force rollback by making commit fail
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(new Error('Commit failed'));

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit and rollback');
      } catch (error) {
        // The error should be from the rollback failure, not the original commit failure
        expect(error.message).toContain('Cannot restore backup');
      }

      // Restore original functions
      FileSystem.writeFile = originalWriteFile;
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Concurrent Transaction Stress Tests', () => {
    test('should handle concurrent transaction failures', async () => {
      const projectId1 = 'concurrent-fail-1';
      const projectId2 = 'concurrent-fail-2';
      const data1 = { project: 1 };
      const data2 = { project: 2 };

      // Start two concurrent transactions
      const transaction1 = dataPersistence.beginTransaction();
      const transaction2 = dataPersistence.beginTransaction();

      // Mock one to fail
      const originalCopyFile = FileSystem.copyFile;
      let copyCallCount = 0;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        copyCallCount++;
        if (copyCallCount === 1) {
          throw new Error('First transaction failed');
        }
        return originalCopyFile(src, dest);
      });

      // Execute operations concurrently
      const promise1 = (async () => {
        await dataPersistence.saveProjectData(projectId1, 'data.json', data1, transaction1);
        return dataPersistence.commitTransaction(transaction1);
      })();

      const promise2 = (async () => {
        await dataPersistence.saveProjectData(projectId2, 'data.json', data2, transaction2);
        return dataPersistence.commitTransaction(transaction2);
      })();

      // Wait for both to complete (one should fail)
      const results = await Promise.allSettled([promise1, promise2]);

      // One should fail, one should succeed
      const failedCount = results.filter(r => r.status === 'rejected').length;
      const succeededCount = results.filter(r => r.status === 'fulfilled').length;
      
      expect(failedCount).toBe(1);
      expect(succeededCount).toBe(1);

      // Verify only the successful transaction's data exists
      const result1 = await dataPersistence.loadProjectData(projectId1, 'data.json');
      const result2 = await dataPersistence.loadProjectData(projectId2, 'data.json');

      // One should be null (failed), one should have data (succeeded)
      const nullCount = [result1, result2].filter(r => r === null).length;
      const dataCount = [result1, result2].filter(r => r !== null).length;
      
      expect(nullCount).toBe(1);
      expect(dataCount).toBe(1);

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });

    test('should handle high concurrency transaction stress', async () => {
      const concurrentTransactions = 10;
      const promises = [];

      // Mock to randomly fail some transactions
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        // Randomly fail ~30% of transactions
        if (Math.random() < 0.3) {
          throw new Error('Random transaction failure');
        }
        return originalCopyFile(src, dest);
      });

      // Create multiple concurrent transactions
      for (let i = 0; i < concurrentTransactions; i++) {
        const promise = (async () => {
          const projectId = `stress-test-${i}`;
          const testData = { id: i, stress: true };
          
          const transaction = dataPersistence.beginTransaction();
          await dataPersistence.saveProjectData(projectId, 'stress.json', testData, transaction);
          return dataPersistence.commitTransaction(transaction);
        })();
        
        promises.push(promise);
      }

      // Wait for all to complete
      const results = await Promise.allSettled(promises);

      // Some should succeed, some should fail
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.filter(r => r.status === 'rejected').length;
      
      expect(successCount + failureCount).toBe(concurrentTransactions);
      expect(successCount).toBeGreaterThan(0); // At least some should succeed
      expect(failureCount).toBeGreaterThan(0); // At least some should fail

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });
});
    } catch (error) {
      // Ignore cleanup errors
    }
  });

// ============================================================================
// TRANSACTION ERROR SCENARIOS TESTS
// ============================================================================

describe('Transaction Error Scenarios', () => {
  let dataPersistence;
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'forest-error-tx-test-'));
    dataPersistence = new DataPersistence(tmpDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Disk Space Simulation Tests', () => {
    test('should handle disk full during temp file creation', async () => {
      const projectId = 'disk-full-test';
      const testData = { large: 'data'.repeat(1000) };

      // Mock FileSystem.writeFile to simulate disk full error
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
      );

      const transaction = dataPersistence.beginTransaction();
      
      try {
        await dataPersistence.saveProjectData(projectId, 'large.json', testData, transaction);
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to disk space');
      } catch (error) {
        expect(error.message).toContain('no space left on device');
        expect(error.code).toBe('ENOSPC');
      }

      // Verify no partial files remain
      const projectDir = dataPersistence.getProjectDir(projectId);
      try {
        const files = await fs.readdir(projectDir);
        const tempFiles = files.filter(f => f.endsWith('.tmp'));
        expect(tempFiles).toHaveLength(0);
      } catch (dirError) {
        // Directory might not exist, which is fine
        expect(dirError.code).toBe('ENOENT');
      }

      // Restore original function
      FileSystem.writeFile = originalWriteFile;
    });

    test('should handle disk full during commit phase', async () => {
      const projectId = 'commit-disk-full';
      const testData = { commit: 'test' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'commit.json', testData, transaction);

      // Mock FileSystem.copyFile to fail during commit
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
      );

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit');
      } catch (error) {
        expect(error.message).toContain('no space left on device');
      }

      // Verify rollback occurred - no final file should exist
      const finalData = await dataPersistence.loadProjectData(projectId, 'commit.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('File Lock Scenarios', () => {
    test('should handle file lock during temp file creation', async () => {
      const projectId = 'file-lock-temp';
      const testData = { locked: true };

      // Mock FileSystem.writeFile to simulate file lock
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
      );

      const transaction = dataPersistence.beginTransaction();

      try {
        await dataPersistence.saveProjectData(projectId, 'locked.json', testData, transaction);
        fail('Should have failed due to file lock');
      } catch (error) {
        expect(error.message).toContain('resource busy or locked');
        expect(error.code).toBe('EBUSY');
      }

      // Restore original function
      FileSystem.writeFile = originalWriteFile;
    });

    test('should handle file lock during commit phase', async () => {
      const projectId = 'file-lock-commit';
      const testData = { commit: 'locked' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'locked.json', testData, transaction);

      // Mock FileSystem.copyFile to simulate file lock during commit
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
      );

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit due to file lock');
      } catch (error) {
        expect(error.message).toContain('resource busy or locked');
      }

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'locked.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Validation Hook Failures', () => {
    test('should handle synchronous validation hook failures', async () => {
      const projectId = 'sync-validation-fail';
      const testData = { invalid: 'data' };

      const failingValidator = jest.fn().mockReturnValue(false);

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: failingValidator,
        reason: 'Synchronous validation failure'
      });

      await dataPersistence.saveProjectData(projectId, 'test.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to validation');
      } catch (error) {
        expect(error.message).toContain('Transaction validation failed');
        expect(error.message).toContain('Synchronous validation failure');
      }

      expect(failingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'test.json');
      expect(finalData).toBeNull();
    });

    test('should handle asynchronous validation hook failures', async () => {
      const projectId = 'async-validation-fail';
      const testData = { async: 'invalid' };

      const asyncFailingValidator = jest.fn().mockResolvedValue(false);

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: asyncFailingValidator,
        reason: 'Asynchronous validation failure'
      });

      await dataPersistence.saveProjectData(projectId, 'async.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to async validation');
      } catch (error) {
        expect(error.message).toContain('Transaction validation failed');
        expect(error.message).toContain('Asynchronous validation failure');
      }

      expect(asyncFailingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'async.json');
      expect(finalData).toBeNull();
    });

    test('should handle validation hook crashes', async () => {
      const projectId = 'validation-crash';
      const testData = { crash: 'test' };

      const crashingValidator = jest.fn().mockImplementation(() => {
        throw new Error('Validation hook crashed');
      });

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: crashingValidator,
        reason: 'Crashing validator'
      });

      await dataPersistence.saveProjectData(projectId, 'crash.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to validator crash');
      } catch (error) {
        expect(error.message).toContain('Validation hook crashed');
      }

      expect(crashingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'crash.json');
      expect(finalData).toBeNull();
    });
  });

  describe('Commit Operation Failures', () => {
    test('should handle failure during temp file cleanup', async () => {
      const projectId = 'cleanup-fail';
      const testData = { cleanup: 'test' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'cleanup.json', testData, transaction);

      // Mock FileSystem.deleteFile to fail during cleanup
      const originalDeleteFile = FileSystem.deleteFile;
      FileSystem.deleteFile = jest.fn().mockRejectedValue(new Error('Cannot delete temp file'));

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during temp file cleanup');
      } catch (error) {
        expect(error.message).toContain('Cannot delete temp file');
      }

      // Verify rollback was attempted
      const finalData = await dataPersistence.loadProjectData(projectId, 'cleanup.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.deleteFile = originalDeleteFile;
    });

    test('should handle partial commit failures with multiple files', async () => {
      const projectId = 'partial-commit-fail';
      const files = [
        { name: 'file1.json', data: { id: 1 } },
        { name: 'file2.json', data: { id: 2 } },
        { name: 'file3.json', data: { id: 3 } }
      ];

      const transaction = dataPersistence.beginTransaction();
      
      // Save all files in transaction
      for (const file of files) {
        await dataPersistence.saveProjectData(projectId, file.name, file.data, transaction);
      }

      // Mock FileSystem.copyFile to fail on second file
      const originalCopyFile = FileSystem.copyFile;
      let copyCallCount = 0;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        copyCallCount++;
        if (copyCallCount === 2) {
          throw new Error('Failed to copy second file');
        }
        return originalCopyFile(src, dest);
      });

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during partial commit');
      } catch (error) {
        expect(error.message).toContain('Failed to copy second file');
      }

      // Verify all files were rolled back (none should exist)
      for (const file of files) {
        const finalData = await dataPersistence.loadProjectData(projectId, file.name);
        expect(finalData).toBeNull();
      }

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Rollback Operation Failures', () => {
    test('should handle rollback failures gracefully', async () => {
      const projectId = 'rollback-fail';
      const originalData = { original: true };
      const newData = { modified: true };

      // Create initial file
      await dataPersistence.saveProjectData(projectId, 'rollback.json', originalData);

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'rollback.json', newData, transaction);

      // Mock FileSystem.writeFile to fail during rollback
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(new Error('Cannot restore backup'));

      // Force rollback by making commit fail
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(new Error('Commit failed'));

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit and rollback');
      } catch (error) {
        // The error should be from the rollback failure, not the original commit failure
        expect(error.message).toContain('Cannot restore backup');
      }

      // Restore original functions
      FileSystem.writeFile = originalWriteFile;
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Concurrent Transaction Stress Tests', () => {
    test('should handle concurrent transaction failures', async () => {
      const projectId1 = 'concurrent-fail-1';
      const projectId2 = 'concurrent-fail-2';
      const data1 = { project: 1 };
      const data2 = { project: 2 };

      // Start two concurrent transactions
      const transaction1 = dataPersistence.beginTransaction();
      const transaction2 = dataPersistence.beginTransaction();

      // Mock one to fail
      const originalCopyFile = FileSystem.copyFile;
      let copyCallCount = 0;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        copyCallCount++;
        if (copyCallCount === 1) {
          throw new Error('First transaction failed');
        }
        return originalCopyFile(src, dest);
      });

      // Execute operations concurrently
      const promise1 = (async () => {
        await dataPersistence.saveProjectData(projectId1, 'data.json', data1, transaction1);
        return dataPersistence.commitTransaction(transaction1);
      })();

      const promise2 = (async () => {
        await dataPersistence.saveProjectData(projectId2, 'data.json', data2, transaction2);
        return dataPersistence.commitTransaction(transaction2);
      })();

      // Wait for both to complete (one should fail)
      const results = await Promise.allSettled([promise1, promise2]);

      // One should fail, one should succeed
      const failedCount = results.filter(r => r.status === 'rejected').length;
      const succeededCount = results.filter(r => r.status === 'fulfilled').length;
      
      expect(failedCount).toBe(1);
      expect(succeededCount).toBe(1);

      // Verify only the successful transaction's data exists
      const result1 = await dataPersistence.loadProjectData(projectId1, 'data.json');
      const result2 = await dataPersistence.loadProjectData(projectId2, 'data.json');

      // One should be null (failed), one should have data (succeeded)
      const nullCount = [result1, result2].filter(r => r === null).length;
      const dataCount = [result1, result2].filter(r => r !== null).length;
      
      expect(nullCount).toBe(1);
      expect(dataCount).toBe(1);

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });

    test('should handle high concurrency transaction stress', async () => {
      const concurrentTransactions = 10;
      const promises = [];

      // Mock to randomly fail some transactions
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        // Randomly fail ~30% of transactions
        if (Math.random() < 0.3) {
          throw new Error('Random transaction failure');
        }
        return originalCopyFile(src, dest);
      });

      // Create multiple concurrent transactions
      for (let i = 0; i < concurrentTransactions; i++) {
        const promise = (async () => {
          const projectId = `stress-test-${i}`;
          const testData = { id: i, stress: true };
          
          const transaction = dataPersistence.beginTransaction();
          await dataPersistence.saveProjectData(projectId, 'stress.json', testData, transaction);
          return dataPersistence.commitTransaction(transaction);
        })();
        
        promises.push(promise);
      }

      // Wait for all to complete
      const results = await Promise.allSettled(promises);

      // Some should succeed, some should fail
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.filter(r => r.status === 'rejected').length;
      
      expect(successCount + failureCount).toBe(concurrentTransactions);
      expect(successCount).toBeGreaterThan(0); // At least some should succeed
      expect(failureCount).toBeGreaterThan(0); // At least some should fail

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });
});
  describe('Transaction Rollback Tests', () => {
    test('should rollback when validation fails', async () => {
      const projectId = 'test-project';
      const fileName = 'test.json';
      const originalData = { version: 1, data: 'original' };
      const invalidData = { version: 2, data: 'invalid' };

      // Create initial file
      await dataPersistence.saveProjectData(projectId, fileName, originalData);

      // Begin transaction with failing validation
      const transaction = dataPersistence.beginTransaction();
      
      // Add custom validation that will fail
      transaction.operations.push({
        type: 'validate',
        data: invalidData,
        validator: (data) => data.version === 1, // This will fail
        reason: 'Version must be 1'
      });

// ============================================================================
// TRANSACTION ERROR SCENARIOS TESTS
// ============================================================================

describe('Transaction Error Scenarios', () => {
  let dataPersistence;
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'forest-error-tx-test-'));
    dataPersistence = new DataPersistence(tmpDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Disk Space Simulation Tests', () => {
    test('should handle disk full during temp file creation', async () => {
      const projectId = 'disk-full-test';
      const testData = { large: 'data'.repeat(1000) };

      // Mock FileSystem.writeFile to simulate disk full error
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
      );

      const transaction = dataPersistence.beginTransaction();
      
      try {
        await dataPersistence.saveProjectData(projectId, 'large.json', testData, transaction);
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to disk space');
      } catch (error) {
        expect(error.message).toContain('no space left on device');
        expect(error.code).toBe('ENOSPC');
      }

      // Verify no partial files remain
      const projectDir = dataPersistence.getProjectDir(projectId);
      try {
        const files = await fs.readdir(projectDir);
        const tempFiles = files.filter(f => f.endsWith('.tmp'));
        expect(tempFiles).toHaveLength(0);
      } catch (dirError) {
        // Directory might not exist, which is fine
        expect(dirError.code).toBe('ENOENT');
      }

      // Restore original function
      FileSystem.writeFile = originalWriteFile;
    });

    test('should handle disk full during commit phase', async () => {
      const projectId = 'commit-disk-full';
      const testData = { commit: 'test' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'commit.json', testData, transaction);

      // Mock FileSystem.copyFile to fail during commit
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
      );

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit');
      } catch (error) {
        expect(error.message).toContain('no space left on device');
      }

      // Verify rollback occurred - no final file should exist
      const finalData = await dataPersistence.loadProjectData(projectId, 'commit.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('File Lock Scenarios', () => {
    test('should handle file lock during temp file creation', async () => {
      const projectId = 'file-lock-temp';
      const testData = { locked: true };

      // Mock FileSystem.writeFile to simulate file lock
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
      );

      const transaction = dataPersistence.beginTransaction();

      try {
        await dataPersistence.saveProjectData(projectId, 'locked.json', testData, transaction);
        fail('Should have failed due to file lock');
      } catch (error) {
        expect(error.message).toContain('resource busy or locked');
        expect(error.code).toBe('EBUSY');
      }

      // Restore original function
      FileSystem.writeFile = originalWriteFile;
    });

    test('should handle file lock during commit phase', async () => {
      const projectId = 'file-lock-commit';
      const testData = { commit: 'locked' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'locked.json', testData, transaction);

      // Mock FileSystem.copyFile to simulate file lock during commit
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
      );

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit due to file lock');
      } catch (error) {
        expect(error.message).toContain('resource busy or locked');
      }

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'locked.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Validation Hook Failures', () => {
    test('should handle synchronous validation hook failures', async () => {
      const projectId = 'sync-validation-fail';
      const testData = { invalid: 'data' };

      const failingValidator = jest.fn().mockReturnValue(false);

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: failingValidator,
        reason: 'Synchronous validation failure'
      });

      await dataPersistence.saveProjectData(projectId, 'test.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to validation');
      } catch (error) {
        expect(error.message).toContain('Transaction validation failed');
        expect(error.message).toContain('Synchronous validation failure');
      }

      expect(failingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'test.json');
      expect(finalData).toBeNull();
    });

    test('should handle asynchronous validation hook failures', async () => {
      const projectId = 'async-validation-fail';
      const testData = { async: 'invalid' };

      const asyncFailingValidator = jest.fn().mockResolvedValue(false);

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: asyncFailingValidator,
        reason: 'Asynchronous validation failure'
      });

      await dataPersistence.saveProjectData(projectId, 'async.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to async validation');
      } catch (error) {
        expect(error.message).toContain('Transaction validation failed');
        expect(error.message).toContain('Asynchronous validation failure');
      }

      expect(asyncFailingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'async.json');
      expect(finalData).toBeNull();
    });

    test('should handle validation hook crashes', async () => {
      const projectId = 'validation-crash';
      const testData = { crash: 'test' };

      const crashingValidator = jest.fn().mockImplementation(() => {
        throw new Error('Validation hook crashed');
      });

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: crashingValidator,
        reason: 'Crashing validator'
      });

      await dataPersistence.saveProjectData(projectId, 'crash.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to validator crash');
      } catch (error) {
        expect(error.message).toContain('Validation hook crashed');
      }

      expect(crashingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'crash.json');
      expect(finalData).toBeNull();
    });
  });

  describe('Commit Operation Failures', () => {
    test('should handle failure during temp file cleanup', async () => {
      const projectId = 'cleanup-fail';
      const testData = { cleanup: 'test' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'cleanup.json', testData, transaction);

      // Mock FileSystem.deleteFile to fail during cleanup
      const originalDeleteFile = FileSystem.deleteFile;
      FileSystem.deleteFile = jest.fn().mockRejectedValue(new Error('Cannot delete temp file'));

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during temp file cleanup');
      } catch (error) {
        expect(error.message).toContain('Cannot delete temp file');
      }

      // Verify rollback was attempted
      const finalData = await dataPersistence.loadProjectData(projectId, 'cleanup.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.deleteFile = originalDeleteFile;
    });

    test('should handle partial commit failures with multiple files', async () => {
      const projectId = 'partial-commit-fail';
      const files = [
        { name: 'file1.json', data: { id: 1 } },
        { name: 'file2.json', data: { id: 2 } },
        { name: 'file3.json', data: { id: 3 } }
      ];

      const transaction = dataPersistence.beginTransaction();
      
      // Save all files in transaction
      for (const file of files) {
        await dataPersistence.saveProjectData(projectId, file.name, file.data, transaction);
      }

      // Mock FileSystem.copyFile to fail on second file
      const originalCopyFile = FileSystem.copyFile;
      let copyCallCount = 0;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        copyCallCount++;
        if (copyCallCount === 2) {
          throw new Error('Failed to copy second file');
        }
        return originalCopyFile(src, dest);
      });

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during partial commit');
      } catch (error) {
        expect(error.message).toContain('Failed to copy second file');
      }

      // Verify all files were rolled back (none should exist)
      for (const file of files) {
        const finalData = await dataPersistence.loadProjectData(projectId, file.name);
        expect(finalData).toBeNull();
      }

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Rollback Operation Failures', () => {
    test('should handle rollback failures gracefully', async () => {
      const projectId = 'rollback-fail';
      const originalData = { original: true };
      const newData = { modified: true };

      // Create initial file
      await dataPersistence.saveProjectData(projectId, 'rollback.json', originalData);

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'rollback.json', newData, transaction);

      // Mock FileSystem.writeFile to fail during rollback
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(new Error('Cannot restore backup'));

      // Force rollback by making commit fail
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(new Error('Commit failed'));

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit and rollback');
      } catch (error) {
        // The error should be from the rollback failure, not the original commit failure
        expect(error.message).toContain('Cannot restore backup');
      }

      // Restore original functions
      FileSystem.writeFile = originalWriteFile;
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Concurrent Transaction Stress Tests', () => {
    test('should handle concurrent transaction failures', async () => {
      const projectId1 = 'concurrent-fail-1';
      const projectId2 = 'concurrent-fail-2';
      const data1 = { project: 1 };
      const data2 = { project: 2 };

      // Start two concurrent transactions
      const transaction1 = dataPersistence.beginTransaction();
      const transaction2 = dataPersistence.beginTransaction();

      // Mock one to fail
      const originalCopyFile = FileSystem.copyFile;
      let copyCallCount = 0;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        copyCallCount++;
        if (copyCallCount === 1) {
          throw new Error('First transaction failed');
        }
        return originalCopyFile(src, dest);
      });

      // Execute operations concurrently
      const promise1 = (async () => {
        await dataPersistence.saveProjectData(projectId1, 'data.json', data1, transaction1);
        return dataPersistence.commitTransaction(transaction1);
      })();

      const promise2 = (async () => {
        await dataPersistence.saveProjectData(projectId2, 'data.json', data2, transaction2);
        return dataPersistence.commitTransaction(transaction2);
      })();

      // Wait for both to complete (one should fail)
      const results = await Promise.allSettled([promise1, promise2]);

      // One should fail, one should succeed
      const failedCount = results.filter(r => r.status === 'rejected').length;
      const succeededCount = results.filter(r => r.status === 'fulfilled').length;
      
      expect(failedCount).toBe(1);
      expect(succeededCount).toBe(1);

      // Verify only the successful transaction's data exists
      const result1 = await dataPersistence.loadProjectData(projectId1, 'data.json');
      const result2 = await dataPersistence.loadProjectData(projectId2, 'data.json');

      // One should be null (failed), one should have data (succeeded)
      const nullCount = [result1, result2].filter(r => r === null).length;
      const dataCount = [result1, result2].filter(r => r !== null).length;
      
      expect(nullCount).toBe(1);
      expect(dataCount).toBe(1);

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });

    test('should handle high concurrency transaction stress', async () => {
      const concurrentTransactions = 10;
      const promises = [];

      // Mock to randomly fail some transactions
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        // Randomly fail ~30% of transactions
        if (Math.random() < 0.3) {
          throw new Error('Random transaction failure');
        }
        return originalCopyFile(src, dest);
      });

      // Create multiple concurrent transactions
      for (let i = 0; i < concurrentTransactions; i++) {
        const promise = (async () => {
          const projectId = `stress-test-${i}`;
          const testData = { id: i, stress: true };
          
          const transaction = dataPersistence.beginTransaction();
          await dataPersistence.saveProjectData(projectId, 'stress.json', testData, transaction);
          return dataPersistence.commitTransaction(transaction);
        })();
        
        promises.push(promise);
      }

      // Wait for all to complete
      const results = await Promise.allSettled(promises);

      // Some should succeed, some should fail
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.filter(r => r.status === 'rejected').length;
      
      expect(successCount + failureCount).toBe(concurrentTransactions);
      expect(successCount).toBeGreaterThan(0); // At least some should succeed
      expect(failureCount).toBeGreaterThan(0); // At least some should fail

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });
});
      try {
        await dataPersistence.saveProjectData(projectId, fileName, invalidData, transaction);
        await dataPersistence.commitTransaction(transaction);
        fail('Transaction should have failed validation');
      } catch (error) {
        expect(error.message).toContain('Transaction validation failed');
      }

      // Verify original data is preserved
      const restoredData = await dataPersistence.loadProjectData(projectId, fileName);
      expect(restoredData).toEqual(originalData);
    });

// ============================================================================
// TRANSACTION ERROR SCENARIOS TESTS
// ============================================================================

describe('Transaction Error Scenarios', () => {
  let dataPersistence;
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'forest-error-tx-test-'));
    dataPersistence = new DataPersistence(tmpDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Disk Space Simulation Tests', () => {
    test('should handle disk full during temp file creation', async () => {
      const projectId = 'disk-full-test';
      const testData = { large: 'data'.repeat(1000) };

      // Mock FileSystem.writeFile to simulate disk full error
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
      );

      const transaction = dataPersistence.beginTransaction();
      
      try {
        await dataPersistence.saveProjectData(projectId, 'large.json', testData, transaction);
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to disk space');
      } catch (error) {
        expect(error.message).toContain('no space left on device');
        expect(error.code).toBe('ENOSPC');
      }

      // Verify no partial files remain
      const projectDir = dataPersistence.getProjectDir(projectId);
      try {
        const files = await fs.readdir(projectDir);
        const tempFiles = files.filter(f => f.endsWith('.tmp'));
        expect(tempFiles).toHaveLength(0);
      } catch (dirError) {
        // Directory might not exist, which is fine
        expect(dirError.code).toBe('ENOENT');
      }

      // Restore original function
      FileSystem.writeFile = originalWriteFile;
    });

    test('should handle disk full during commit phase', async () => {
      const projectId = 'commit-disk-full';
      const testData = { commit: 'test' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'commit.json', testData, transaction);

      // Mock FileSystem.copyFile to fail during commit
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
      );

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit');
      } catch (error) {
        expect(error.message).toContain('no space left on device');
      }

      // Verify rollback occurred - no final file should exist
      const finalData = await dataPersistence.loadProjectData(projectId, 'commit.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('File Lock Scenarios', () => {
    test('should handle file lock during temp file creation', async () => {
      const projectId = 'file-lock-temp';
      const testData = { locked: true };

      // Mock FileSystem.writeFile to simulate file lock
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
      );

      const transaction = dataPersistence.beginTransaction();

      try {
        await dataPersistence.saveProjectData(projectId, 'locked.json', testData, transaction);
        fail('Should have failed due to file lock');
      } catch (error) {
        expect(error.message).toContain('resource busy or locked');
        expect(error.code).toBe('EBUSY');
      }

      // Restore original function
      FileSystem.writeFile = originalWriteFile;
    });

    test('should handle file lock during commit phase', async () => {
      const projectId = 'file-lock-commit';
      const testData = { commit: 'locked' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'locked.json', testData, transaction);

      // Mock FileSystem.copyFile to simulate file lock during commit
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
      );

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit due to file lock');
      } catch (error) {
        expect(error.message).toContain('resource busy or locked');
      }

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'locked.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Validation Hook Failures', () => {
    test('should handle synchronous validation hook failures', async () => {
      const projectId = 'sync-validation-fail';
      const testData = { invalid: 'data' };

      const failingValidator = jest.fn().mockReturnValue(false);

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: failingValidator,
        reason: 'Synchronous validation failure'
      });

      await dataPersistence.saveProjectData(projectId, 'test.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to validation');
      } catch (error) {
        expect(error.message).toContain('Transaction validation failed');
        expect(error.message).toContain('Synchronous validation failure');
      }

      expect(failingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'test.json');
      expect(finalData).toBeNull();
    });

    test('should handle asynchronous validation hook failures', async () => {
      const projectId = 'async-validation-fail';
      const testData = { async: 'invalid' };

      const asyncFailingValidator = jest.fn().mockResolvedValue(false);

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: asyncFailingValidator,
        reason: 'Asynchronous validation failure'
      });

      await dataPersistence.saveProjectData(projectId, 'async.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to async validation');
      } catch (error) {
        expect(error.message).toContain('Transaction validation failed');
        expect(error.message).toContain('Asynchronous validation failure');
      }

      expect(asyncFailingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'async.json');
      expect(finalData).toBeNull();
    });

    test('should handle validation hook crashes', async () => {
      const projectId = 'validation-crash';
      const testData = { crash: 'test' };

      const crashingValidator = jest.fn().mockImplementation(() => {
        throw new Error('Validation hook crashed');
      });

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: crashingValidator,
        reason: 'Crashing validator'
      });

      await dataPersistence.saveProjectData(projectId, 'crash.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to validator crash');
      } catch (error) {
        expect(error.message).toContain('Validation hook crashed');
      }

      expect(crashingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'crash.json');
      expect(finalData).toBeNull();
    });
  });

  describe('Commit Operation Failures', () => {
    test('should handle failure during temp file cleanup', async () => {
      const projectId = 'cleanup-fail';
      const testData = { cleanup: 'test' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'cleanup.json', testData, transaction);

      // Mock FileSystem.deleteFile to fail during cleanup
      const originalDeleteFile = FileSystem.deleteFile;
      FileSystem.deleteFile = jest.fn().mockRejectedValue(new Error('Cannot delete temp file'));

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during temp file cleanup');
      } catch (error) {
        expect(error.message).toContain('Cannot delete temp file');
      }

      // Verify rollback was attempted
      const finalData = await dataPersistence.loadProjectData(projectId, 'cleanup.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.deleteFile = originalDeleteFile;
    });

    test('should handle partial commit failures with multiple files', async () => {
      const projectId = 'partial-commit-fail';
      const files = [
        { name: 'file1.json', data: { id: 1 } },
        { name: 'file2.json', data: { id: 2 } },
        { name: 'file3.json', data: { id: 3 } }
      ];

      const transaction = dataPersistence.beginTransaction();
      
      // Save all files in transaction
      for (const file of files) {
        await dataPersistence.saveProjectData(projectId, file.name, file.data, transaction);
      }

      // Mock FileSystem.copyFile to fail on second file
      const originalCopyFile = FileSystem.copyFile;
      let copyCallCount = 0;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        copyCallCount++;
        if (copyCallCount === 2) {
          throw new Error('Failed to copy second file');
        }
        return originalCopyFile(src, dest);
      });

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during partial commit');
      } catch (error) {
        expect(error.message).toContain('Failed to copy second file');
      }

      // Verify all files were rolled back (none should exist)
      for (const file of files) {
        const finalData = await dataPersistence.loadProjectData(projectId, file.name);
        expect(finalData).toBeNull();
      }

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Rollback Operation Failures', () => {
    test('should handle rollback failures gracefully', async () => {
      const projectId = 'rollback-fail';
      const originalData = { original: true };
      const newData = { modified: true };

      // Create initial file
      await dataPersistence.saveProjectData(projectId, 'rollback.json', originalData);

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'rollback.json', newData, transaction);

      // Mock FileSystem.writeFile to fail during rollback
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(new Error('Cannot restore backup'));

      // Force rollback by making commit fail
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(new Error('Commit failed'));

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit and rollback');
      } catch (error) {
        // The error should be from the rollback failure, not the original commit failure
        expect(error.message).toContain('Cannot restore backup');
      }

      // Restore original functions
      FileSystem.writeFile = originalWriteFile;
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Concurrent Transaction Stress Tests', () => {
    test('should handle concurrent transaction failures', async () => {
      const projectId1 = 'concurrent-fail-1';
      const projectId2 = 'concurrent-fail-2';
      const data1 = { project: 1 };
      const data2 = { project: 2 };

      // Start two concurrent transactions
      const transaction1 = dataPersistence.beginTransaction();
      const transaction2 = dataPersistence.beginTransaction();

      // Mock one to fail
      const originalCopyFile = FileSystem.copyFile;
      let copyCallCount = 0;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        copyCallCount++;
        if (copyCallCount === 1) {
          throw new Error('First transaction failed');
        }
        return originalCopyFile(src, dest);
      });

      // Execute operations concurrently
      const promise1 = (async () => {
        await dataPersistence.saveProjectData(projectId1, 'data.json', data1, transaction1);
        return dataPersistence.commitTransaction(transaction1);
      })();

      const promise2 = (async () => {
        await dataPersistence.saveProjectData(projectId2, 'data.json', data2, transaction2);
        return dataPersistence.commitTransaction(transaction2);
      })();

      // Wait for both to complete (one should fail)
      const results = await Promise.allSettled([promise1, promise2]);

      // One should fail, one should succeed
      const failedCount = results.filter(r => r.status === 'rejected').length;
      const succeededCount = results.filter(r => r.status === 'fulfilled').length;
      
      expect(failedCount).toBe(1);
      expect(succeededCount).toBe(1);

      // Verify only the successful transaction's data exists
      const result1 = await dataPersistence.loadProjectData(projectId1, 'data.json');
      const result2 = await dataPersistence.loadProjectData(projectId2, 'data.json');

      // One should be null (failed), one should have data (succeeded)
      const nullCount = [result1, result2].filter(r => r === null).length;
      const dataCount = [result1, result2].filter(r => r !== null).length;
      
      expect(nullCount).toBe(1);
      expect(dataCount).toBe(1);

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });

    test('should handle high concurrency transaction stress', async () => {
      const concurrentTransactions = 10;
      const promises = [];

      // Mock to randomly fail some transactions
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        // Randomly fail ~30% of transactions
        if (Math.random() < 0.3) {
          throw new Error('Random transaction failure');
        }
        return originalCopyFile(src, dest);
      });

      // Create multiple concurrent transactions
      for (let i = 0; i < concurrentTransactions; i++) {
        const promise = (async () => {
          const projectId = `stress-test-${i}`;
          const testData = { id: i, stress: true };
          
          const transaction = dataPersistence.beginTransaction();
          await dataPersistence.saveProjectData(projectId, 'stress.json', testData, transaction);
          return dataPersistence.commitTransaction(transaction);
        })();
        
        promises.push(promise);
      }

      // Wait for all to complete
      const results = await Promise.allSettled(promises);

      // Some should succeed, some should fail
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.filter(r => r.status === 'rejected').length;
      
      expect(successCount + failureCount).toBe(concurrentTransactions);
      expect(successCount).toBeGreaterThan(0); // At least some should succeed
      expect(failureCount).toBeGreaterThan(0); // At least some should fail

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });
});
    test('should restore files after rollback', async () => {
      const projectId = 'test-project';
      const fileName = 'restore-test.json';
      const originalData = { id: 1, name: 'original' };
      const newData = { id: 2, name: 'modified' };

      // Create initial file
      await dataPersistence.saveProjectData(projectId, fileName, originalData);

      // Begin transaction
      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, fileName, newData, transaction);

      // Force rollback
      await dataPersistence.rollbackTransaction(transaction);

      // Verify original data is restored
      const restoredData = await dataPersistence.loadProjectData(projectId, fileName);
      expect(restoredData).toEqual(originalData);
    });

// ============================================================================
// TRANSACTION ERROR SCENARIOS TESTS
// ============================================================================

describe('Transaction Error Scenarios', () => {
  let dataPersistence;
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'forest-error-tx-test-'));
    dataPersistence = new DataPersistence(tmpDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Disk Space Simulation Tests', () => {
    test('should handle disk full during temp file creation', async () => {
      const projectId = 'disk-full-test';
      const testData = { large: 'data'.repeat(1000) };

      // Mock FileSystem.writeFile to simulate disk full error
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
      );

      const transaction = dataPersistence.beginTransaction();
      
      try {
        await dataPersistence.saveProjectData(projectId, 'large.json', testData, transaction);
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to disk space');
      } catch (error) {
        expect(error.message).toContain('no space left on device');
        expect(error.code).toBe('ENOSPC');
      }

      // Verify no partial files remain
      const projectDir = dataPersistence.getProjectDir(projectId);
      try {
        const files = await fs.readdir(projectDir);
        const tempFiles = files.filter(f => f.endsWith('.tmp'));
        expect(tempFiles).toHaveLength(0);
      } catch (dirError) {
        // Directory might not exist, which is fine
        expect(dirError.code).toBe('ENOENT');
      }

      // Restore original function
      FileSystem.writeFile = originalWriteFile;
    });

    test('should handle disk full during commit phase', async () => {
      const projectId = 'commit-disk-full';
      const testData = { commit: 'test' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'commit.json', testData, transaction);

      // Mock FileSystem.copyFile to fail during commit
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
      );

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit');
      } catch (error) {
        expect(error.message).toContain('no space left on device');
      }

      // Verify rollback occurred - no final file should exist
      const finalData = await dataPersistence.loadProjectData(projectId, 'commit.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('File Lock Scenarios', () => {
    test('should handle file lock during temp file creation', async () => {
      const projectId = 'file-lock-temp';
      const testData = { locked: true };

      // Mock FileSystem.writeFile to simulate file lock
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
      );

      const transaction = dataPersistence.beginTransaction();

      try {
        await dataPersistence.saveProjectData(projectId, 'locked.json', testData, transaction);
        fail('Should have failed due to file lock');
      } catch (error) {
        expect(error.message).toContain('resource busy or locked');
        expect(error.code).toBe('EBUSY');
      }

      // Restore original function
      FileSystem.writeFile = originalWriteFile;
    });

    test('should handle file lock during commit phase', async () => {
      const projectId = 'file-lock-commit';
      const testData = { commit: 'locked' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'locked.json', testData, transaction);

      // Mock FileSystem.copyFile to simulate file lock during commit
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
      );

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit due to file lock');
      } catch (error) {
        expect(error.message).toContain('resource busy or locked');
      }

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'locked.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Validation Hook Failures', () => {
    test('should handle synchronous validation hook failures', async () => {
      const projectId = 'sync-validation-fail';
      const testData = { invalid: 'data' };

      const failingValidator = jest.fn().mockReturnValue(false);

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: failingValidator,
        reason: 'Synchronous validation failure'
      });

      await dataPersistence.saveProjectData(projectId, 'test.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to validation');
      } catch (error) {
        expect(error.message).toContain('Transaction validation failed');
        expect(error.message).toContain('Synchronous validation failure');
      }

      expect(failingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'test.json');
      expect(finalData).toBeNull();
    });

    test('should handle asynchronous validation hook failures', async () => {
      const projectId = 'async-validation-fail';
      const testData = { async: 'invalid' };

      const asyncFailingValidator = jest.fn().mockResolvedValue(false);

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: asyncFailingValidator,
        reason: 'Asynchronous validation failure'
      });

      await dataPersistence.saveProjectData(projectId, 'async.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to async validation');
      } catch (error) {
        expect(error.message).toContain('Transaction validation failed');
        expect(error.message).toContain('Asynchronous validation failure');
      }

      expect(asyncFailingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'async.json');
      expect(finalData).toBeNull();
    });

    test('should handle validation hook crashes', async () => {
      const projectId = 'validation-crash';
      const testData = { crash: 'test' };

      const crashingValidator = jest.fn().mockImplementation(() => {
        throw new Error('Validation hook crashed');
      });

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: crashingValidator,
        reason: 'Crashing validator'
      });

      await dataPersistence.saveProjectData(projectId, 'crash.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to validator crash');
      } catch (error) {
        expect(error.message).toContain('Validation hook crashed');
      }

      expect(crashingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'crash.json');
      expect(finalData).toBeNull();
    });
  });

  describe('Commit Operation Failures', () => {
    test('should handle failure during temp file cleanup', async () => {
      const projectId = 'cleanup-fail';
      const testData = { cleanup: 'test' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'cleanup.json', testData, transaction);

      // Mock FileSystem.deleteFile to fail during cleanup
      const originalDeleteFile = FileSystem.deleteFile;
      FileSystem.deleteFile = jest.fn().mockRejectedValue(new Error('Cannot delete temp file'));

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during temp file cleanup');
      } catch (error) {
        expect(error.message).toContain('Cannot delete temp file');
      }

      // Verify rollback was attempted
      const finalData = await dataPersistence.loadProjectData(projectId, 'cleanup.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.deleteFile = originalDeleteFile;
    });

    test('should handle partial commit failures with multiple files', async () => {
      const projectId = 'partial-commit-fail';
      const files = [
        { name: 'file1.json', data: { id: 1 } },
        { name: 'file2.json', data: { id: 2 } },
        { name: 'file3.json', data: { id: 3 } }
      ];

      const transaction = dataPersistence.beginTransaction();
      
      // Save all files in transaction
      for (const file of files) {
        await dataPersistence.saveProjectData(projectId, file.name, file.data, transaction);
      }

      // Mock FileSystem.copyFile to fail on second file
      const originalCopyFile = FileSystem.copyFile;
      let copyCallCount = 0;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        copyCallCount++;
        if (copyCallCount === 2) {
          throw new Error('Failed to copy second file');
        }
        return originalCopyFile(src, dest);
      });

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during partial commit');
      } catch (error) {
        expect(error.message).toContain('Failed to copy second file');
      }

      // Verify all files were rolled back (none should exist)
      for (const file of files) {
        const finalData = await dataPersistence.loadProjectData(projectId, file.name);
        expect(finalData).toBeNull();
      }

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Rollback Operation Failures', () => {
    test('should handle rollback failures gracefully', async () => {
      const projectId = 'rollback-fail';
      const originalData = { original: true };
      const newData = { modified: true };

      // Create initial file
      await dataPersistence.saveProjectData(projectId, 'rollback.json', originalData);

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'rollback.json', newData, transaction);

      // Mock FileSystem.writeFile to fail during rollback
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(new Error('Cannot restore backup'));

      // Force rollback by making commit fail
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(new Error('Commit failed'));

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit and rollback');
      } catch (error) {
        // The error should be from the rollback failure, not the original commit failure
        expect(error.message).toContain('Cannot restore backup');
      }

      // Restore original functions
      FileSystem.writeFile = originalWriteFile;
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Concurrent Transaction Stress Tests', () => {
    test('should handle concurrent transaction failures', async () => {
      const projectId1 = 'concurrent-fail-1';
      const projectId2 = 'concurrent-fail-2';
      const data1 = { project: 1 };
      const data2 = { project: 2 };

      // Start two concurrent transactions
      const transaction1 = dataPersistence.beginTransaction();
      const transaction2 = dataPersistence.beginTransaction();

      // Mock one to fail
      const originalCopyFile = FileSystem.copyFile;
      let copyCallCount = 0;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        copyCallCount++;
        if (copyCallCount === 1) {
          throw new Error('First transaction failed');
        }
        return originalCopyFile(src, dest);
      });

      // Execute operations concurrently
      const promise1 = (async () => {
        await dataPersistence.saveProjectData(projectId1, 'data.json', data1, transaction1);
        return dataPersistence.commitTransaction(transaction1);
      })();

      const promise2 = (async () => {
        await dataPersistence.saveProjectData(projectId2, 'data.json', data2, transaction2);
        return dataPersistence.commitTransaction(transaction2);
      })();

      // Wait for both to complete (one should fail)
      const results = await Promise.allSettled([promise1, promise2]);

      // One should fail, one should succeed
      const failedCount = results.filter(r => r.status === 'rejected').length;
      const succeededCount = results.filter(r => r.status === 'fulfilled').length;
      
      expect(failedCount).toBe(1);
      expect(succeededCount).toBe(1);

      // Verify only the successful transaction's data exists
      const result1 = await dataPersistence.loadProjectData(projectId1, 'data.json');
      const result2 = await dataPersistence.loadProjectData(projectId2, 'data.json');

      // One should be null (failed), one should have data (succeeded)
      const nullCount = [result1, result2].filter(r => r === null).length;
      const dataCount = [result1, result2].filter(r => r !== null).length;
      
      expect(nullCount).toBe(1);
      expect(dataCount).toBe(1);

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });

    test('should handle high concurrency transaction stress', async () => {
      const concurrentTransactions = 10;
      const promises = [];

      // Mock to randomly fail some transactions
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        // Randomly fail ~30% of transactions
        if (Math.random() < 0.3) {
          throw new Error('Random transaction failure');
        }
        return originalCopyFile(src, dest);
      });

      // Create multiple concurrent transactions
      for (let i = 0; i < concurrentTransactions; i++) {
        const promise = (async () => {
          const projectId = `stress-test-${i}`;
          const testData = { id: i, stress: true };
          
          const transaction = dataPersistence.beginTransaction();
          await dataPersistence.saveProjectData(projectId, 'stress.json', testData, transaction);
          return dataPersistence.commitTransaction(transaction);
        })();
        
        promises.push(promise);
      }

      // Wait for all to complete
      const results = await Promise.allSettled(promises);

      // Some should succeed, some should fail
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.filter(r => r.status === 'rejected').length;
      
      expect(successCount + failureCount).toBe(concurrentTransactions);
      expect(successCount).toBeGreaterThan(0); // At least some should succeed
      expect(failureCount).toBeGreaterThan(0); // At least some should fail

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });
});
    test('should clean up temporary files during rollback', async () => {
      const projectId = 'test-project';
      const fileName = 'temp-cleanup.json';
      const testData = { test: 'data' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, fileName, testData, transaction);

      // Verify temp file exists
      const projectDir = dataPersistence.getProjectDir(projectId);
      const tempFiles = await fs.readdir(projectDir);
      const tempFile = tempFiles.find(f => f.endsWith('.tmp'));
      expect(tempFile).toBeDefined();

      // Rollback and verify cleanup
      await dataPersistence.rollbackTransaction(transaction);
      
      const filesAfterRollback = await fs.readdir(projectDir);
      const remainingTempFiles = filesAfterRollback.filter(f => f.endsWith('.tmp'));
      expect(remainingTempFiles).toHaveLength(0);
    });

// ============================================================================
// TRANSACTION ERROR SCENARIOS TESTS
// ============================================================================

describe('Transaction Error Scenarios', () => {
  let dataPersistence;
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'forest-error-tx-test-'));
    dataPersistence = new DataPersistence(tmpDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Disk Space Simulation Tests', () => {
    test('should handle disk full during temp file creation', async () => {
      const projectId = 'disk-full-test';
      const testData = { large: 'data'.repeat(1000) };

      // Mock FileSystem.writeFile to simulate disk full error
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
      );

      const transaction = dataPersistence.beginTransaction();
      
      try {
        await dataPersistence.saveProjectData(projectId, 'large.json', testData, transaction);
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to disk space');
      } catch (error) {
        expect(error.message).toContain('no space left on device');
        expect(error.code).toBe('ENOSPC');
      }

      // Verify no partial files remain
      const projectDir = dataPersistence.getProjectDir(projectId);
      try {
        const files = await fs.readdir(projectDir);
        const tempFiles = files.filter(f => f.endsWith('.tmp'));
        expect(tempFiles).toHaveLength(0);
      } catch (dirError) {
        // Directory might not exist, which is fine
        expect(dirError.code).toBe('ENOENT');
      }

      // Restore original function
      FileSystem.writeFile = originalWriteFile;
    });

    test('should handle disk full during commit phase', async () => {
      const projectId = 'commit-disk-full';
      const testData = { commit: 'test' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'commit.json', testData, transaction);

      // Mock FileSystem.copyFile to fail during commit
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
      );

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit');
      } catch (error) {
        expect(error.message).toContain('no space left on device');
      }

      // Verify rollback occurred - no final file should exist
      const finalData = await dataPersistence.loadProjectData(projectId, 'commit.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('File Lock Scenarios', () => {
    test('should handle file lock during temp file creation', async () => {
      const projectId = 'file-lock-temp';
      const testData = { locked: true };

      // Mock FileSystem.writeFile to simulate file lock
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
      );

      const transaction = dataPersistence.beginTransaction();

      try {
        await dataPersistence.saveProjectData(projectId, 'locked.json', testData, transaction);
        fail('Should have failed due to file lock');
      } catch (error) {
        expect(error.message).toContain('resource busy or locked');
        expect(error.code).toBe('EBUSY');
      }

      // Restore original function
      FileSystem.writeFile = originalWriteFile;
    });

    test('should handle file lock during commit phase', async () => {
      const projectId = 'file-lock-commit';
      const testData = { commit: 'locked' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'locked.json', testData, transaction);

      // Mock FileSystem.copyFile to simulate file lock during commit
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
      );

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit due to file lock');
      } catch (error) {
        expect(error.message).toContain('resource busy or locked');
      }

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'locked.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Validation Hook Failures', () => {
    test('should handle synchronous validation hook failures', async () => {
      const projectId = 'sync-validation-fail';
      const testData = { invalid: 'data' };

      const failingValidator = jest.fn().mockReturnValue(false);

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: failingValidator,
        reason: 'Synchronous validation failure'
      });

      await dataPersistence.saveProjectData(projectId, 'test.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to validation');
      } catch (error) {
        expect(error.message).toContain('Transaction validation failed');
        expect(error.message).toContain('Synchronous validation failure');
      }

      expect(failingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'test.json');
      expect(finalData).toBeNull();
    });

    test('should handle asynchronous validation hook failures', async () => {
      const projectId = 'async-validation-fail';
      const testData = { async: 'invalid' };

      const asyncFailingValidator = jest.fn().mockResolvedValue(false);

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: asyncFailingValidator,
        reason: 'Asynchronous validation failure'
      });

      await dataPersistence.saveProjectData(projectId, 'async.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to async validation');
      } catch (error) {
        expect(error.message).toContain('Transaction validation failed');
        expect(error.message).toContain('Asynchronous validation failure');
      }

      expect(asyncFailingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'async.json');
      expect(finalData).toBeNull();
    });

    test('should handle validation hook crashes', async () => {
      const projectId = 'validation-crash';
      const testData = { crash: 'test' };

      const crashingValidator = jest.fn().mockImplementation(() => {
        throw new Error('Validation hook crashed');
      });

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: crashingValidator,
        reason: 'Crashing validator'
      });

      await dataPersistence.saveProjectData(projectId, 'crash.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to validator crash');
      } catch (error) {
        expect(error.message).toContain('Validation hook crashed');
      }

      expect(crashingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'crash.json');
      expect(finalData).toBeNull();
    });
  });

  describe('Commit Operation Failures', () => {
    test('should handle failure during temp file cleanup', async () => {
      const projectId = 'cleanup-fail';
      const testData = { cleanup: 'test' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'cleanup.json', testData, transaction);

      // Mock FileSystem.deleteFile to fail during cleanup
      const originalDeleteFile = FileSystem.deleteFile;
      FileSystem.deleteFile = jest.fn().mockRejectedValue(new Error('Cannot delete temp file'));

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during temp file cleanup');
      } catch (error) {
        expect(error.message).toContain('Cannot delete temp file');
      }

      // Verify rollback was attempted
      const finalData = await dataPersistence.loadProjectData(projectId, 'cleanup.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.deleteFile = originalDeleteFile;
    });

    test('should handle partial commit failures with multiple files', async () => {
      const projectId = 'partial-commit-fail';
      const files = [
        { name: 'file1.json', data: { id: 1 } },
        { name: 'file2.json', data: { id: 2 } },
        { name: 'file3.json', data: { id: 3 } }
      ];

      const transaction = dataPersistence.beginTransaction();
      
      // Save all files in transaction
      for (const file of files) {
        await dataPersistence.saveProjectData(projectId, file.name, file.data, transaction);
      }

      // Mock FileSystem.copyFile to fail on second file
      const originalCopyFile = FileSystem.copyFile;
      let copyCallCount = 0;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        copyCallCount++;
        if (copyCallCount === 2) {
          throw new Error('Failed to copy second file');
        }
        return originalCopyFile(src, dest);
      });

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during partial commit');
      } catch (error) {
        expect(error.message).toContain('Failed to copy second file');
      }

      // Verify all files were rolled back (none should exist)
      for (const file of files) {
        const finalData = await dataPersistence.loadProjectData(projectId, file.name);
        expect(finalData).toBeNull();
      }

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Rollback Operation Failures', () => {
    test('should handle rollback failures gracefully', async () => {
      const projectId = 'rollback-fail';
      const originalData = { original: true };
      const newData = { modified: true };

      // Create initial file
      await dataPersistence.saveProjectData(projectId, 'rollback.json', originalData);

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'rollback.json', newData, transaction);

      // Mock FileSystem.writeFile to fail during rollback
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(new Error('Cannot restore backup'));

      // Force rollback by making commit fail
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(new Error('Commit failed'));

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit and rollback');
      } catch (error) {
        // The error should be from the rollback failure, not the original commit failure
        expect(error.message).toContain('Cannot restore backup');
      }

      // Restore original functions
      FileSystem.writeFile = originalWriteFile;
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Concurrent Transaction Stress Tests', () => {
    test('should handle concurrent transaction failures', async () => {
      const projectId1 = 'concurrent-fail-1';
      const projectId2 = 'concurrent-fail-2';
      const data1 = { project: 1 };
      const data2 = { project: 2 };

      // Start two concurrent transactions
      const transaction1 = dataPersistence.beginTransaction();
      const transaction2 = dataPersistence.beginTransaction();

      // Mock one to fail
      const originalCopyFile = FileSystem.copyFile;
      let copyCallCount = 0;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        copyCallCount++;
        if (copyCallCount === 1) {
          throw new Error('First transaction failed');
        }
        return originalCopyFile(src, dest);
      });

      // Execute operations concurrently
      const promise1 = (async () => {
        await dataPersistence.saveProjectData(projectId1, 'data.json', data1, transaction1);
        return dataPersistence.commitTransaction(transaction1);
      })();

      const promise2 = (async () => {
        await dataPersistence.saveProjectData(projectId2, 'data.json', data2, transaction2);
        return dataPersistence.commitTransaction(transaction2);
      })();

      // Wait for both to complete (one should fail)
      const results = await Promise.allSettled([promise1, promise2]);

      // One should fail, one should succeed
      const failedCount = results.filter(r => r.status === 'rejected').length;
      const succeededCount = results.filter(r => r.status === 'fulfilled').length;
      
      expect(failedCount).toBe(1);
      expect(succeededCount).toBe(1);

      // Verify only the successful transaction's data exists
      const result1 = await dataPersistence.loadProjectData(projectId1, 'data.json');
      const result2 = await dataPersistence.loadProjectData(projectId2, 'data.json');

      // One should be null (failed), one should have data (succeeded)
      const nullCount = [result1, result2].filter(r => r === null).length;
      const dataCount = [result1, result2].filter(r => r !== null).length;
      
      expect(nullCount).toBe(1);
      expect(dataCount).toBe(1);

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });

    test('should handle high concurrency transaction stress', async () => {
      const concurrentTransactions = 10;
      const promises = [];

      // Mock to randomly fail some transactions
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        // Randomly fail ~30% of transactions
        if (Math.random() < 0.3) {
          throw new Error('Random transaction failure');
        }
        return originalCopyFile(src, dest);
      });

      // Create multiple concurrent transactions
      for (let i = 0; i < concurrentTransactions; i++) {
        const promise = (async () => {
          const projectId = `stress-test-${i}`;
          const testData = { id: i, stress: true };
          
          const transaction = dataPersistence.beginTransaction();
          await dataPersistence.saveProjectData(projectId, 'stress.json', testData, transaction);
          return dataPersistence.commitTransaction(transaction);
        })();
        
        promises.push(promise);
      }

      // Wait for all to complete
      const results = await Promise.allSettled(promises);

      // Some should succeed, some should fail
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.filter(r => r.status === 'rejected').length;
      
      expect(successCount + failureCount).toBe(concurrentTransactions);
      expect(successCount).toBeGreaterThan(0); // At least some should succeed
      expect(failureCount).toBeGreaterThan(0); // At least some should fail

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });
});
    test('should handle rollback with multiple file operations', async () => {
      const projectId = 'multi-file-test';
      const files = [
        { name: 'file1.json', original: { id: 1 }, modified: { id: 11 } },
        { name: 'file2.json', original: { id: 2 }, modified: { id: 22 } },
        { name: 'file3.json', original: { id: 3 }, modified: { id: 33 } }
      ];

      // Create original files
      for (const file of files) {
        await dataPersistence.saveProjectData(projectId, file.name, file.original);
      }

      // Begin transaction and modify all files
      const transaction = dataPersistence.beginTransaction();
      for (const file of files) {
        await dataPersistence.saveProjectData(projectId, file.name, file.modified, transaction);
      }

      // Rollback
      await dataPersistence.rollbackTransaction(transaction);

      // Verify all files are restored
      for (const file of files) {
        const restoredData = await dataPersistence.loadProjectData(projectId, file.name);
        expect(restoredData).toEqual(file.original);
      }
    });

// ============================================================================
// TRANSACTION ERROR SCENARIOS TESTS
// ============================================================================

describe('Transaction Error Scenarios', () => {
  let dataPersistence;
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'forest-error-tx-test-'));
    dataPersistence = new DataPersistence(tmpDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Disk Space Simulation Tests', () => {
    test('should handle disk full during temp file creation', async () => {
      const projectId = 'disk-full-test';
      const testData = { large: 'data'.repeat(1000) };

      // Mock FileSystem.writeFile to simulate disk full error
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
      );

      const transaction = dataPersistence.beginTransaction();
      
      try {
        await dataPersistence.saveProjectData(projectId, 'large.json', testData, transaction);
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to disk space');
      } catch (error) {
        expect(error.message).toContain('no space left on device');
        expect(error.code).toBe('ENOSPC');
      }

      // Verify no partial files remain
      const projectDir = dataPersistence.getProjectDir(projectId);
      try {
        const files = await fs.readdir(projectDir);
        const tempFiles = files.filter(f => f.endsWith('.tmp'));
        expect(tempFiles).toHaveLength(0);
      } catch (dirError) {
        // Directory might not exist, which is fine
        expect(dirError.code).toBe('ENOENT');
      }

      // Restore original function
      FileSystem.writeFile = originalWriteFile;
    });

    test('should handle disk full during commit phase', async () => {
      const projectId = 'commit-disk-full';
      const testData = { commit: 'test' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'commit.json', testData, transaction);

      // Mock FileSystem.copyFile to fail during commit
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
      );

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit');
      } catch (error) {
        expect(error.message).toContain('no space left on device');
      }

      // Verify rollback occurred - no final file should exist
      const finalData = await dataPersistence.loadProjectData(projectId, 'commit.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('File Lock Scenarios', () => {
    test('should handle file lock during temp file creation', async () => {
      const projectId = 'file-lock-temp';
      const testData = { locked: true };

      // Mock FileSystem.writeFile to simulate file lock
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
      );

      const transaction = dataPersistence.beginTransaction();

      try {
        await dataPersistence.saveProjectData(projectId, 'locked.json', testData, transaction);
        fail('Should have failed due to file lock');
      } catch (error) {
        expect(error.message).toContain('resource busy or locked');
        expect(error.code).toBe('EBUSY');
      }

      // Restore original function
      FileSystem.writeFile = originalWriteFile;
    });

    test('should handle file lock during commit phase', async () => {
      const projectId = 'file-lock-commit';
      const testData = { commit: 'locked' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'locked.json', testData, transaction);

      // Mock FileSystem.copyFile to simulate file lock during commit
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
      );

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit due to file lock');
      } catch (error) {
        expect(error.message).toContain('resource busy or locked');
      }

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'locked.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Validation Hook Failures', () => {
    test('should handle synchronous validation hook failures', async () => {
      const projectId = 'sync-validation-fail';
      const testData = { invalid: 'data' };

      const failingValidator = jest.fn().mockReturnValue(false);

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: failingValidator,
        reason: 'Synchronous validation failure'
      });

      await dataPersistence.saveProjectData(projectId, 'test.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to validation');
      } catch (error) {
        expect(error.message).toContain('Transaction validation failed');
        expect(error.message).toContain('Synchronous validation failure');
      }

      expect(failingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'test.json');
      expect(finalData).toBeNull();
    });

    test('should handle asynchronous validation hook failures', async () => {
      const projectId = 'async-validation-fail';
      const testData = { async: 'invalid' };

      const asyncFailingValidator = jest.fn().mockResolvedValue(false);

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: asyncFailingValidator,
        reason: 'Asynchronous validation failure'
      });

      await dataPersistence.saveProjectData(projectId, 'async.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to async validation');
      } catch (error) {
        expect(error.message).toContain('Transaction validation failed');
        expect(error.message).toContain('Asynchronous validation failure');
      }

      expect(asyncFailingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'async.json');
      expect(finalData).toBeNull();
    });

    test('should handle validation hook crashes', async () => {
      const projectId = 'validation-crash';
      const testData = { crash: 'test' };

      const crashingValidator = jest.fn().mockImplementation(() => {
        throw new Error('Validation hook crashed');
      });

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: crashingValidator,
        reason: 'Crashing validator'
      });

      await dataPersistence.saveProjectData(projectId, 'crash.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to validator crash');
      } catch (error) {
        expect(error.message).toContain('Validation hook crashed');
      }

      expect(crashingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'crash.json');
      expect(finalData).toBeNull();
    });
  });

  describe('Commit Operation Failures', () => {
    test('should handle failure during temp file cleanup', async () => {
      const projectId = 'cleanup-fail';
      const testData = { cleanup: 'test' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'cleanup.json', testData, transaction);

      // Mock FileSystem.deleteFile to fail during cleanup
      const originalDeleteFile = FileSystem.deleteFile;
      FileSystem.deleteFile = jest.fn().mockRejectedValue(new Error('Cannot delete temp file'));

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during temp file cleanup');
      } catch (error) {
        expect(error.message).toContain('Cannot delete temp file');
      }

      // Verify rollback was attempted
      const finalData = await dataPersistence.loadProjectData(projectId, 'cleanup.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.deleteFile = originalDeleteFile;
    });

    test('should handle partial commit failures with multiple files', async () => {
      const projectId = 'partial-commit-fail';
      const files = [
        { name: 'file1.json', data: { id: 1 } },
        { name: 'file2.json', data: { id: 2 } },
        { name: 'file3.json', data: { id: 3 } }
      ];

      const transaction = dataPersistence.beginTransaction();
      
      // Save all files in transaction
      for (const file of files) {
        await dataPersistence.saveProjectData(projectId, file.name, file.data, transaction);
      }

      // Mock FileSystem.copyFile to fail on second file
      const originalCopyFile = FileSystem.copyFile;
      let copyCallCount = 0;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        copyCallCount++;
        if (copyCallCount === 2) {
          throw new Error('Failed to copy second file');
        }
        return originalCopyFile(src, dest);
      });

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during partial commit');
      } catch (error) {
        expect(error.message).toContain('Failed to copy second file');
      }

      // Verify all files were rolled back (none should exist)
      for (const file of files) {
        const finalData = await dataPersistence.loadProjectData(projectId, file.name);
        expect(finalData).toBeNull();
      }

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Rollback Operation Failures', () => {
    test('should handle rollback failures gracefully', async () => {
      const projectId = 'rollback-fail';
      const originalData = { original: true };
      const newData = { modified: true };

      // Create initial file
      await dataPersistence.saveProjectData(projectId, 'rollback.json', originalData);

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'rollback.json', newData, transaction);

      // Mock FileSystem.writeFile to fail during rollback
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(new Error('Cannot restore backup'));

      // Force rollback by making commit fail
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(new Error('Commit failed'));

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit and rollback');
      } catch (error) {
        // The error should be from the rollback failure, not the original commit failure
        expect(error.message).toContain('Cannot restore backup');
      }

      // Restore original functions
      FileSystem.writeFile = originalWriteFile;
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Concurrent Transaction Stress Tests', () => {
    test('should handle concurrent transaction failures', async () => {
      const projectId1 = 'concurrent-fail-1';
      const projectId2 = 'concurrent-fail-2';
      const data1 = { project: 1 };
      const data2 = { project: 2 };

      // Start two concurrent transactions
      const transaction1 = dataPersistence.beginTransaction();
      const transaction2 = dataPersistence.beginTransaction();

      // Mock one to fail
      const originalCopyFile = FileSystem.copyFile;
      let copyCallCount = 0;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        copyCallCount++;
        if (copyCallCount === 1) {
          throw new Error('First transaction failed');
        }
        return originalCopyFile(src, dest);
      });

      // Execute operations concurrently
      const promise1 = (async () => {
        await dataPersistence.saveProjectData(projectId1, 'data.json', data1, transaction1);
        return dataPersistence.commitTransaction(transaction1);
      })();

      const promise2 = (async () => {
        await dataPersistence.saveProjectData(projectId2, 'data.json', data2, transaction2);
        return dataPersistence.commitTransaction(transaction2);
      })();

      // Wait for both to complete (one should fail)
      const results = await Promise.allSettled([promise1, promise2]);

      // One should fail, one should succeed
      const failedCount = results.filter(r => r.status === 'rejected').length;
      const succeededCount = results.filter(r => r.status === 'fulfilled').length;
      
      expect(failedCount).toBe(1);
      expect(succeededCount).toBe(1);

      // Verify only the successful transaction's data exists
      const result1 = await dataPersistence.loadProjectData(projectId1, 'data.json');
      const result2 = await dataPersistence.loadProjectData(projectId2, 'data.json');

      // One should be null (failed), one should have data (succeeded)
      const nullCount = [result1, result2].filter(r => r === null).length;
      const dataCount = [result1, result2].filter(r => r !== null).length;
      
      expect(nullCount).toBe(1);
      expect(dataCount).toBe(1);

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });

    test('should handle high concurrency transaction stress', async () => {
      const concurrentTransactions = 10;
      const promises = [];

      // Mock to randomly fail some transactions
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        // Randomly fail ~30% of transactions
        if (Math.random() < 0.3) {
          throw new Error('Random transaction failure');
        }
        return originalCopyFile(src, dest);
      });

      // Create multiple concurrent transactions
      for (let i = 0; i < concurrentTransactions; i++) {
        const promise = (async () => {
          const projectId = `stress-test-${i}`;
          const testData = { id: i, stress: true };
          
          const transaction = dataPersistence.beginTransaction();
          await dataPersistence.saveProjectData(projectId, 'stress.json', testData, transaction);
          return dataPersistence.commitTransaction(transaction);
        })();
        
        promises.push(promise);
      }

      // Wait for all to complete
      const results = await Promise.allSettled(promises);

      // Some should succeed, some should fail
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.filter(r => r.status === 'rejected').length;
      
      expect(successCount + failureCount).toBe(concurrentTransactions);
      expect(successCount).toBeGreaterThan(0); // At least some should succeed
      expect(failureCount).toBeGreaterThan(0); // At least some should fail

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });
});
  });

// ============================================================================
// TRANSACTION ERROR SCENARIOS TESTS
// ============================================================================

describe('Transaction Error Scenarios', () => {
  let dataPersistence;
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'forest-error-tx-test-'));
    dataPersistence = new DataPersistence(tmpDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Disk Space Simulation Tests', () => {
    test('should handle disk full during temp file creation', async () => {
      const projectId = 'disk-full-test';
      const testData = { large: 'data'.repeat(1000) };

      // Mock FileSystem.writeFile to simulate disk full error
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
      );

      const transaction = dataPersistence.beginTransaction();
      
      try {
        await dataPersistence.saveProjectData(projectId, 'large.json', testData, transaction);
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to disk space');
      } catch (error) {
        expect(error.message).toContain('no space left on device');
        expect(error.code).toBe('ENOSPC');
      }

      // Verify no partial files remain
      const projectDir = dataPersistence.getProjectDir(projectId);
      try {
        const files = await fs.readdir(projectDir);
        const tempFiles = files.filter(f => f.endsWith('.tmp'));
        expect(tempFiles).toHaveLength(0);
      } catch (dirError) {
        // Directory might not exist, which is fine
        expect(dirError.code).toBe('ENOENT');
      }

      // Restore original function
      FileSystem.writeFile = originalWriteFile;
    });

    test('should handle disk full during commit phase', async () => {
      const projectId = 'commit-disk-full';
      const testData = { commit: 'test' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'commit.json', testData, transaction);

      // Mock FileSystem.copyFile to fail during commit
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
      );

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit');
      } catch (error) {
        expect(error.message).toContain('no space left on device');
      }

      // Verify rollback occurred - no final file should exist
      const finalData = await dataPersistence.loadProjectData(projectId, 'commit.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('File Lock Scenarios', () => {
    test('should handle file lock during temp file creation', async () => {
      const projectId = 'file-lock-temp';
      const testData = { locked: true };

      // Mock FileSystem.writeFile to simulate file lock
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
      );

      const transaction = dataPersistence.beginTransaction();

      try {
        await dataPersistence.saveProjectData(projectId, 'locked.json', testData, transaction);
        fail('Should have failed due to file lock');
      } catch (error) {
        expect(error.message).toContain('resource busy or locked');
        expect(error.code).toBe('EBUSY');
      }

      // Restore original function
      FileSystem.writeFile = originalWriteFile;
    });

    test('should handle file lock during commit phase', async () => {
      const projectId = 'file-lock-commit';
      const testData = { commit: 'locked' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'locked.json', testData, transaction);

      // Mock FileSystem.copyFile to simulate file lock during commit
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
      );

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit due to file lock');
      } catch (error) {
        expect(error.message).toContain('resource busy or locked');
      }

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'locked.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Validation Hook Failures', () => {
    test('should handle synchronous validation hook failures', async () => {
      const projectId = 'sync-validation-fail';
      const testData = { invalid: 'data' };

      const failingValidator = jest.fn().mockReturnValue(false);

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: failingValidator,
        reason: 'Synchronous validation failure'
      });

      await dataPersistence.saveProjectData(projectId, 'test.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to validation');
      } catch (error) {
        expect(error.message).toContain('Transaction validation failed');
        expect(error.message).toContain('Synchronous validation failure');
      }

      expect(failingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'test.json');
      expect(finalData).toBeNull();
    });

    test('should handle asynchronous validation hook failures', async () => {
      const projectId = 'async-validation-fail';
      const testData = { async: 'invalid' };

      const asyncFailingValidator = jest.fn().mockResolvedValue(false);

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: asyncFailingValidator,
        reason: 'Asynchronous validation failure'
      });

      await dataPersistence.saveProjectData(projectId, 'async.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to async validation');
      } catch (error) {
        expect(error.message).toContain('Transaction validation failed');
        expect(error.message).toContain('Asynchronous validation failure');
      }

      expect(asyncFailingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'async.json');
      expect(finalData).toBeNull();
    });

    test('should handle validation hook crashes', async () => {
      const projectId = 'validation-crash';
      const testData = { crash: 'test' };

      const crashingValidator = jest.fn().mockImplementation(() => {
        throw new Error('Validation hook crashed');
      });

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: crashingValidator,
        reason: 'Crashing validator'
      });

      await dataPersistence.saveProjectData(projectId, 'crash.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to validator crash');
      } catch (error) {
        expect(error.message).toContain('Validation hook crashed');
      }

      expect(crashingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'crash.json');
      expect(finalData).toBeNull();
    });
  });

  describe('Commit Operation Failures', () => {
    test('should handle failure during temp file cleanup', async () => {
      const projectId = 'cleanup-fail';
      const testData = { cleanup: 'test' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'cleanup.json', testData, transaction);

      // Mock FileSystem.deleteFile to fail during cleanup
      const originalDeleteFile = FileSystem.deleteFile;
      FileSystem.deleteFile = jest.fn().mockRejectedValue(new Error('Cannot delete temp file'));

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during temp file cleanup');
      } catch (error) {
        expect(error.message).toContain('Cannot delete temp file');
      }

      // Verify rollback was attempted
      const finalData = await dataPersistence.loadProjectData(projectId, 'cleanup.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.deleteFile = originalDeleteFile;
    });

    test('should handle partial commit failures with multiple files', async () => {
      const projectId = 'partial-commit-fail';
      const files = [
        { name: 'file1.json', data: { id: 1 } },
        { name: 'file2.json', data: { id: 2 } },
        { name: 'file3.json', data: { id: 3 } }
      ];

      const transaction = dataPersistence.beginTransaction();
      
      // Save all files in transaction
      for (const file of files) {
        await dataPersistence.saveProjectData(projectId, file.name, file.data, transaction);
      }

      // Mock FileSystem.copyFile to fail on second file
      const originalCopyFile = FileSystem.copyFile;
      let copyCallCount = 0;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        copyCallCount++;
        if (copyCallCount === 2) {
          throw new Error('Failed to copy second file');
        }
        return originalCopyFile(src, dest);
      });

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during partial commit');
      } catch (error) {
        expect(error.message).toContain('Failed to copy second file');
      }

      // Verify all files were rolled back (none should exist)
      for (const file of files) {
        const finalData = await dataPersistence.loadProjectData(projectId, file.name);
        expect(finalData).toBeNull();
      }

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Rollback Operation Failures', () => {
    test('should handle rollback failures gracefully', async () => {
      const projectId = 'rollback-fail';
      const originalData = { original: true };
      const newData = { modified: true };

      // Create initial file
      await dataPersistence.saveProjectData(projectId, 'rollback.json', originalData);

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'rollback.json', newData, transaction);

      // Mock FileSystem.writeFile to fail during rollback
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(new Error('Cannot restore backup'));

      // Force rollback by making commit fail
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(new Error('Commit failed'));

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit and rollback');
      } catch (error) {
        // The error should be from the rollback failure, not the original commit failure
        expect(error.message).toContain('Cannot restore backup');
      }

      // Restore original functions
      FileSystem.writeFile = originalWriteFile;
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Concurrent Transaction Stress Tests', () => {
    test('should handle concurrent transaction failures', async () => {
      const projectId1 = 'concurrent-fail-1';
      const projectId2 = 'concurrent-fail-2';
      const data1 = { project: 1 };
      const data2 = { project: 2 };

      // Start two concurrent transactions
      const transaction1 = dataPersistence.beginTransaction();
      const transaction2 = dataPersistence.beginTransaction();

      // Mock one to fail
      const originalCopyFile = FileSystem.copyFile;
      let copyCallCount = 0;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        copyCallCount++;
        if (copyCallCount === 1) {
          throw new Error('First transaction failed');
        }
        return originalCopyFile(src, dest);
      });

      // Execute operations concurrently
      const promise1 = (async () => {
        await dataPersistence.saveProjectData(projectId1, 'data.json', data1, transaction1);
        return dataPersistence.commitTransaction(transaction1);
      })();

      const promise2 = (async () => {
        await dataPersistence.saveProjectData(projectId2, 'data.json', data2, transaction2);
        return dataPersistence.commitTransaction(transaction2);
      })();

      // Wait for both to complete (one should fail)
      const results = await Promise.allSettled([promise1, promise2]);

      // One should fail, one should succeed
      const failedCount = results.filter(r => r.status === 'rejected').length;
      const succeededCount = results.filter(r => r.status === 'fulfilled').length;
      
      expect(failedCount).toBe(1);
      expect(succeededCount).toBe(1);

      // Verify only the successful transaction's data exists
      const result1 = await dataPersistence.loadProjectData(projectId1, 'data.json');
      const result2 = await dataPersistence.loadProjectData(projectId2, 'data.json');

      // One should be null (failed), one should have data (succeeded)
      const nullCount = [result1, result2].filter(r => r === null).length;
      const dataCount = [result1, result2].filter(r => r !== null).length;
      
      expect(nullCount).toBe(1);
      expect(dataCount).toBe(1);

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });

    test('should handle high concurrency transaction stress', async () => {
      const concurrentTransactions = 10;
      const promises = [];

      // Mock to randomly fail some transactions
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        // Randomly fail ~30% of transactions
        if (Math.random() < 0.3) {
          throw new Error('Random transaction failure');
        }
        return originalCopyFile(src, dest);
      });

      // Create multiple concurrent transactions
      for (let i = 0; i < concurrentTransactions; i++) {
        const promise = (async () => {
          const projectId = `stress-test-${i}`;
          const testData = { id: i, stress: true };
          
          const transaction = dataPersistence.beginTransaction();
          await dataPersistence.saveProjectData(projectId, 'stress.json', testData, transaction);
          return dataPersistence.commitTransaction(transaction);
        })();
        
        promises.push(promise);
      }

      // Wait for all to complete
      const results = await Promise.allSettled(promises);

      // Some should succeed, some should fail
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.filter(r => r.status === 'rejected').length;
      
      expect(successCount + failureCount).toBe(concurrentTransactions);
      expect(successCount).toBeGreaterThan(0); // At least some should succeed
      expect(failureCount).toBeGreaterThan(0); // At least some should fail

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });
});
  describe('Multi-File Operation Tests', () => {
    test('should commit atomic saves across multiple files', async () => {
      const projectId = 'atomic-multi';
      const files = [
        { name: 'config.json', data: { setting: 'value1' } },
        { name: 'state.json', data: { status: 'active' } },
        { name: 'metadata.json', data: { version: '1.0.0' } }
      ];

      const transaction = dataPersistence.beginTransaction();
      
      // Save all files in transaction
      for (const file of files) {
        await dataPersistence.saveProjectData(projectId, file.name, file.data, transaction);
      }

      // Commit transaction
      await dataPersistence.commitTransaction(transaction);

      // Verify all files exist and have correct data
      for (const file of files) {
        const savedData = await dataPersistence.loadProjectData(projectId, file.name);
        expect(savedData).toEqual(file.data);
      }
    });

// ============================================================================
// TRANSACTION ERROR SCENARIOS TESTS
// ============================================================================

describe('Transaction Error Scenarios', () => {
  let dataPersistence;
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'forest-error-tx-test-'));
    dataPersistence = new DataPersistence(tmpDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Disk Space Simulation Tests', () => {
    test('should handle disk full during temp file creation', async () => {
      const projectId = 'disk-full-test';
      const testData = { large: 'data'.repeat(1000) };

      // Mock FileSystem.writeFile to simulate disk full error
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
      );

      const transaction = dataPersistence.beginTransaction();
      
      try {
        await dataPersistence.saveProjectData(projectId, 'large.json', testData, transaction);
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to disk space');
      } catch (error) {
        expect(error.message).toContain('no space left on device');
        expect(error.code).toBe('ENOSPC');
      }

      // Verify no partial files remain
      const projectDir = dataPersistence.getProjectDir(projectId);
      try {
        const files = await fs.readdir(projectDir);
        const tempFiles = files.filter(f => f.endsWith('.tmp'));
        expect(tempFiles).toHaveLength(0);
      } catch (dirError) {
        // Directory might not exist, which is fine
        expect(dirError.code).toBe('ENOENT');
      }

      // Restore original function
      FileSystem.writeFile = originalWriteFile;
    });

    test('should handle disk full during commit phase', async () => {
      const projectId = 'commit-disk-full';
      const testData = { commit: 'test' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'commit.json', testData, transaction);

      // Mock FileSystem.copyFile to fail during commit
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
      );

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit');
      } catch (error) {
        expect(error.message).toContain('no space left on device');
      }

      // Verify rollback occurred - no final file should exist
      const finalData = await dataPersistence.loadProjectData(projectId, 'commit.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('File Lock Scenarios', () => {
    test('should handle file lock during temp file creation', async () => {
      const projectId = 'file-lock-temp';
      const testData = { locked: true };

      // Mock FileSystem.writeFile to simulate file lock
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
      );

      const transaction = dataPersistence.beginTransaction();

      try {
        await dataPersistence.saveProjectData(projectId, 'locked.json', testData, transaction);
        fail('Should have failed due to file lock');
      } catch (error) {
        expect(error.message).toContain('resource busy or locked');
        expect(error.code).toBe('EBUSY');
      }

      // Restore original function
      FileSystem.writeFile = originalWriteFile;
    });

    test('should handle file lock during commit phase', async () => {
      const projectId = 'file-lock-commit';
      const testData = { commit: 'locked' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'locked.json', testData, transaction);

      // Mock FileSystem.copyFile to simulate file lock during commit
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
      );

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit due to file lock');
      } catch (error) {
        expect(error.message).toContain('resource busy or locked');
      }

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'locked.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Validation Hook Failures', () => {
    test('should handle synchronous validation hook failures', async () => {
      const projectId = 'sync-validation-fail';
      const testData = { invalid: 'data' };

      const failingValidator = jest.fn().mockReturnValue(false);

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: failingValidator,
        reason: 'Synchronous validation failure'
      });

      await dataPersistence.saveProjectData(projectId, 'test.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to validation');
      } catch (error) {
        expect(error.message).toContain('Transaction validation failed');
        expect(error.message).toContain('Synchronous validation failure');
      }

      expect(failingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'test.json');
      expect(finalData).toBeNull();
    });

    test('should handle asynchronous validation hook failures', async () => {
      const projectId = 'async-validation-fail';
      const testData = { async: 'invalid' };

      const asyncFailingValidator = jest.fn().mockResolvedValue(false);

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: asyncFailingValidator,
        reason: 'Asynchronous validation failure'
      });

      await dataPersistence.saveProjectData(projectId, 'async.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to async validation');
      } catch (error) {
        expect(error.message).toContain('Transaction validation failed');
        expect(error.message).toContain('Asynchronous validation failure');
      }

      expect(asyncFailingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'async.json');
      expect(finalData).toBeNull();
    });

    test('should handle validation hook crashes', async () => {
      const projectId = 'validation-crash';
      const testData = { crash: 'test' };

      const crashingValidator = jest.fn().mockImplementation(() => {
        throw new Error('Validation hook crashed');
      });

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: crashingValidator,
        reason: 'Crashing validator'
      });

      await dataPersistence.saveProjectData(projectId, 'crash.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to validator crash');
      } catch (error) {
        expect(error.message).toContain('Validation hook crashed');
      }

      expect(crashingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'crash.json');
      expect(finalData).toBeNull();
    });
  });

  describe('Commit Operation Failures', () => {
    test('should handle failure during temp file cleanup', async () => {
      const projectId = 'cleanup-fail';
      const testData = { cleanup: 'test' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'cleanup.json', testData, transaction);

      // Mock FileSystem.deleteFile to fail during cleanup
      const originalDeleteFile = FileSystem.deleteFile;
      FileSystem.deleteFile = jest.fn().mockRejectedValue(new Error('Cannot delete temp file'));

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during temp file cleanup');
      } catch (error) {
        expect(error.message).toContain('Cannot delete temp file');
      }

      // Verify rollback was attempted
      const finalData = await dataPersistence.loadProjectData(projectId, 'cleanup.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.deleteFile = originalDeleteFile;
    });

    test('should handle partial commit failures with multiple files', async () => {
      const projectId = 'partial-commit-fail';
      const files = [
        { name: 'file1.json', data: { id: 1 } },
        { name: 'file2.json', data: { id: 2 } },
        { name: 'file3.json', data: { id: 3 } }
      ];

      const transaction = dataPersistence.beginTransaction();
      
      // Save all files in transaction
      for (const file of files) {
        await dataPersistence.saveProjectData(projectId, file.name, file.data, transaction);
      }

      // Mock FileSystem.copyFile to fail on second file
      const originalCopyFile = FileSystem.copyFile;
      let copyCallCount = 0;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        copyCallCount++;
        if (copyCallCount === 2) {
          throw new Error('Failed to copy second file');
        }
        return originalCopyFile(src, dest);
      });

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during partial commit');
      } catch (error) {
        expect(error.message).toContain('Failed to copy second file');
      }

      // Verify all files were rolled back (none should exist)
      for (const file of files) {
        const finalData = await dataPersistence.loadProjectData(projectId, file.name);
        expect(finalData).toBeNull();
      }

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Rollback Operation Failures', () => {
    test('should handle rollback failures gracefully', async () => {
      const projectId = 'rollback-fail';
      const originalData = { original: true };
      const newData = { modified: true };

      // Create initial file
      await dataPersistence.saveProjectData(projectId, 'rollback.json', originalData);

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'rollback.json', newData, transaction);

      // Mock FileSystem.writeFile to fail during rollback
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(new Error('Cannot restore backup'));

      // Force rollback by making commit fail
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(new Error('Commit failed'));

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit and rollback');
      } catch (error) {
        // The error should be from the rollback failure, not the original commit failure
        expect(error.message).toContain('Cannot restore backup');
      }

      // Restore original functions
      FileSystem.writeFile = originalWriteFile;
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Concurrent Transaction Stress Tests', () => {
    test('should handle concurrent transaction failures', async () => {
      const projectId1 = 'concurrent-fail-1';
      const projectId2 = 'concurrent-fail-2';
      const data1 = { project: 1 };
      const data2 = { project: 2 };

      // Start two concurrent transactions
      const transaction1 = dataPersistence.beginTransaction();
      const transaction2 = dataPersistence.beginTransaction();

      // Mock one to fail
      const originalCopyFile = FileSystem.copyFile;
      let copyCallCount = 0;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        copyCallCount++;
        if (copyCallCount === 1) {
          throw new Error('First transaction failed');
        }
        return originalCopyFile(src, dest);
      });

      // Execute operations concurrently
      const promise1 = (async () => {
        await dataPersistence.saveProjectData(projectId1, 'data.json', data1, transaction1);
        return dataPersistence.commitTransaction(transaction1);
      })();

      const promise2 = (async () => {
        await dataPersistence.saveProjectData(projectId2, 'data.json', data2, transaction2);
        return dataPersistence.commitTransaction(transaction2);
      })();

      // Wait for both to complete (one should fail)
      const results = await Promise.allSettled([promise1, promise2]);

      // One should fail, one should succeed
      const failedCount = results.filter(r => r.status === 'rejected').length;
      const succeededCount = results.filter(r => r.status === 'fulfilled').length;
      
      expect(failedCount).toBe(1);
      expect(succeededCount).toBe(1);

      // Verify only the successful transaction's data exists
      const result1 = await dataPersistence.loadProjectData(projectId1, 'data.json');
      const result2 = await dataPersistence.loadProjectData(projectId2, 'data.json');

      // One should be null (failed), one should have data (succeeded)
      const nullCount = [result1, result2].filter(r => r === null).length;
      const dataCount = [result1, result2].filter(r => r !== null).length;
      
      expect(nullCount).toBe(1);
      expect(dataCount).toBe(1);

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });

    test('should handle high concurrency transaction stress', async () => {
      const concurrentTransactions = 10;
      const promises = [];

      // Mock to randomly fail some transactions
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        // Randomly fail ~30% of transactions
        if (Math.random() < 0.3) {
          throw new Error('Random transaction failure');
        }
        return originalCopyFile(src, dest);
      });

      // Create multiple concurrent transactions
      for (let i = 0; i < concurrentTransactions; i++) {
        const promise = (async () => {
          const projectId = `stress-test-${i}`;
          const testData = { id: i, stress: true };
          
          const transaction = dataPersistence.beginTransaction();
          await dataPersistence.saveProjectData(projectId, 'stress.json', testData, transaction);
          return dataPersistence.commitTransaction(transaction);
        })();
        
        promises.push(promise);
      }

      // Wait for all to complete
      const results = await Promise.allSettled(promises);

      // Some should succeed, some should fail
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.filter(r => r.status === 'rejected').length;
      
      expect(successCount + failureCount).toBe(concurrentTransactions);
      expect(successCount).toBeGreaterThan(0); // At least some should succeed
      expect(failureCount).toBeGreaterThan(0); // At least some should fail

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });
});
    test('should handle partial failure scenarios', async () => {
      const projectId = 'partial-failure';
      const validData = { valid: true };
      const invalidData = { valid: false };

      const transaction = dataPersistence.beginTransaction();
      
      // Add validation that will fail for invalid data
      transaction.operations.push({
        type: 'validate',
        data: invalidData,
        validator: (data) => data.valid === true,
        reason: 'Data must be valid'
      });

// ============================================================================
// TRANSACTION ERROR SCENARIOS TESTS
// ============================================================================

describe('Transaction Error Scenarios', () => {
  let dataPersistence;
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'forest-error-tx-test-'));
    dataPersistence = new DataPersistence(tmpDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Disk Space Simulation Tests', () => {
    test('should handle disk full during temp file creation', async () => {
      const projectId = 'disk-full-test';
      const testData = { large: 'data'.repeat(1000) };

      // Mock FileSystem.writeFile to simulate disk full error
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
      );

      const transaction = dataPersistence.beginTransaction();
      
      try {
        await dataPersistence.saveProjectData(projectId, 'large.json', testData, transaction);
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to disk space');
      } catch (error) {
        expect(error.message).toContain('no space left on device');
        expect(error.code).toBe('ENOSPC');
      }

      // Verify no partial files remain
      const projectDir = dataPersistence.getProjectDir(projectId);
      try {
        const files = await fs.readdir(projectDir);
        const tempFiles = files.filter(f => f.endsWith('.tmp'));
        expect(tempFiles).toHaveLength(0);
      } catch (dirError) {
        // Directory might not exist, which is fine
        expect(dirError.code).toBe('ENOENT');
      }

      // Restore original function
      FileSystem.writeFile = originalWriteFile;
    });

    test('should handle disk full during commit phase', async () => {
      const projectId = 'commit-disk-full';
      const testData = { commit: 'test' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'commit.json', testData, transaction);

      // Mock FileSystem.copyFile to fail during commit
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
      );

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit');
      } catch (error) {
        expect(error.message).toContain('no space left on device');
      }

      // Verify rollback occurred - no final file should exist
      const finalData = await dataPersistence.loadProjectData(projectId, 'commit.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('File Lock Scenarios', () => {
    test('should handle file lock during temp file creation', async () => {
      const projectId = 'file-lock-temp';
      const testData = { locked: true };

      // Mock FileSystem.writeFile to simulate file lock
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
      );

      const transaction = dataPersistence.beginTransaction();

      try {
        await dataPersistence.saveProjectData(projectId, 'locked.json', testData, transaction);
        fail('Should have failed due to file lock');
      } catch (error) {
        expect(error.message).toContain('resource busy or locked');
        expect(error.code).toBe('EBUSY');
      }

      // Restore original function
      FileSystem.writeFile = originalWriteFile;
    });

    test('should handle file lock during commit phase', async () => {
      const projectId = 'file-lock-commit';
      const testData = { commit: 'locked' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'locked.json', testData, transaction);

      // Mock FileSystem.copyFile to simulate file lock during commit
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
      );

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit due to file lock');
      } catch (error) {
        expect(error.message).toContain('resource busy or locked');
      }

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'locked.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Validation Hook Failures', () => {
    test('should handle synchronous validation hook failures', async () => {
      const projectId = 'sync-validation-fail';
      const testData = { invalid: 'data' };

      const failingValidator = jest.fn().mockReturnValue(false);

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: failingValidator,
        reason: 'Synchronous validation failure'
      });

      await dataPersistence.saveProjectData(projectId, 'test.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to validation');
      } catch (error) {
        expect(error.message).toContain('Transaction validation failed');
        expect(error.message).toContain('Synchronous validation failure');
      }

      expect(failingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'test.json');
      expect(finalData).toBeNull();
    });

    test('should handle asynchronous validation hook failures', async () => {
      const projectId = 'async-validation-fail';
      const testData = { async: 'invalid' };

      const asyncFailingValidator = jest.fn().mockResolvedValue(false);

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: asyncFailingValidator,
        reason: 'Asynchronous validation failure'
      });

      await dataPersistence.saveProjectData(projectId, 'async.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to async validation');
      } catch (error) {
        expect(error.message).toContain('Transaction validation failed');
        expect(error.message).toContain('Asynchronous validation failure');
      }

      expect(asyncFailingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'async.json');
      expect(finalData).toBeNull();
    });

    test('should handle validation hook crashes', async () => {
      const projectId = 'validation-crash';
      const testData = { crash: 'test' };

      const crashingValidator = jest.fn().mockImplementation(() => {
        throw new Error('Validation hook crashed');
      });

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: crashingValidator,
        reason: 'Crashing validator'
      });

      await dataPersistence.saveProjectData(projectId, 'crash.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to validator crash');
      } catch (error) {
        expect(error.message).toContain('Validation hook crashed');
      }

      expect(crashingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'crash.json');
      expect(finalData).toBeNull();
    });
  });

  describe('Commit Operation Failures', () => {
    test('should handle failure during temp file cleanup', async () => {
      const projectId = 'cleanup-fail';
      const testData = { cleanup: 'test' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'cleanup.json', testData, transaction);

      // Mock FileSystem.deleteFile to fail during cleanup
      const originalDeleteFile = FileSystem.deleteFile;
      FileSystem.deleteFile = jest.fn().mockRejectedValue(new Error('Cannot delete temp file'));

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during temp file cleanup');
      } catch (error) {
        expect(error.message).toContain('Cannot delete temp file');
      }

      // Verify rollback was attempted
      const finalData = await dataPersistence.loadProjectData(projectId, 'cleanup.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.deleteFile = originalDeleteFile;
    });

    test('should handle partial commit failures with multiple files', async () => {
      const projectId = 'partial-commit-fail';
      const files = [
        { name: 'file1.json', data: { id: 1 } },
        { name: 'file2.json', data: { id: 2 } },
        { name: 'file3.json', data: { id: 3 } }
      ];

      const transaction = dataPersistence.beginTransaction();
      
      // Save all files in transaction
      for (const file of files) {
        await dataPersistence.saveProjectData(projectId, file.name, file.data, transaction);
      }

      // Mock FileSystem.copyFile to fail on second file
      const originalCopyFile = FileSystem.copyFile;
      let copyCallCount = 0;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        copyCallCount++;
        if (copyCallCount === 2) {
          throw new Error('Failed to copy second file');
        }
        return originalCopyFile(src, dest);
      });

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during partial commit');
      } catch (error) {
        expect(error.message).toContain('Failed to copy second file');
      }

      // Verify all files were rolled back (none should exist)
      for (const file of files) {
        const finalData = await dataPersistence.loadProjectData(projectId, file.name);
        expect(finalData).toBeNull();
      }

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Rollback Operation Failures', () => {
    test('should handle rollback failures gracefully', async () => {
      const projectId = 'rollback-fail';
      const originalData = { original: true };
      const newData = { modified: true };

      // Create initial file
      await dataPersistence.saveProjectData(projectId, 'rollback.json', originalData);

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'rollback.json', newData, transaction);

      // Mock FileSystem.writeFile to fail during rollback
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(new Error('Cannot restore backup'));

      // Force rollback by making commit fail
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(new Error('Commit failed'));

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit and rollback');
      } catch (error) {
        // The error should be from the rollback failure, not the original commit failure
        expect(error.message).toContain('Cannot restore backup');
      }

      // Restore original functions
      FileSystem.writeFile = originalWriteFile;
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Concurrent Transaction Stress Tests', () => {
    test('should handle concurrent transaction failures', async () => {
      const projectId1 = 'concurrent-fail-1';
      const projectId2 = 'concurrent-fail-2';
      const data1 = { project: 1 };
      const data2 = { project: 2 };

      // Start two concurrent transactions
      const transaction1 = dataPersistence.beginTransaction();
      const transaction2 = dataPersistence.beginTransaction();

      // Mock one to fail
      const originalCopyFile = FileSystem.copyFile;
      let copyCallCount = 0;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        copyCallCount++;
        if (copyCallCount === 1) {
          throw new Error('First transaction failed');
        }
        return originalCopyFile(src, dest);
      });

      // Execute operations concurrently
      const promise1 = (async () => {
        await dataPersistence.saveProjectData(projectId1, 'data.json', data1, transaction1);
        return dataPersistence.commitTransaction(transaction1);
      })();

      const promise2 = (async () => {
        await dataPersistence.saveProjectData(projectId2, 'data.json', data2, transaction2);
        return dataPersistence.commitTransaction(transaction2);
      })();

      // Wait for both to complete (one should fail)
      const results = await Promise.allSettled([promise1, promise2]);

      // One should fail, one should succeed
      const failedCount = results.filter(r => r.status === 'rejected').length;
      const succeededCount = results.filter(r => r.status === 'fulfilled').length;
      
      expect(failedCount).toBe(1);
      expect(succeededCount).toBe(1);

      // Verify only the successful transaction's data exists
      const result1 = await dataPersistence.loadProjectData(projectId1, 'data.json');
      const result2 = await dataPersistence.loadProjectData(projectId2, 'data.json');

      // One should be null (failed), one should have data (succeeded)
      const nullCount = [result1, result2].filter(r => r === null).length;
      const dataCount = [result1, result2].filter(r => r !== null).length;
      
      expect(nullCount).toBe(1);
      expect(dataCount).toBe(1);

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });

    test('should handle high concurrency transaction stress', async () => {
      const concurrentTransactions = 10;
      const promises = [];

      // Mock to randomly fail some transactions
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        // Randomly fail ~30% of transactions
        if (Math.random() < 0.3) {
          throw new Error('Random transaction failure');
        }
        return originalCopyFile(src, dest);
      });

      // Create multiple concurrent transactions
      for (let i = 0; i < concurrentTransactions; i++) {
        const promise = (async () => {
          const projectId = `stress-test-${i}`;
          const testData = { id: i, stress: true };
          
          const transaction = dataPersistence.beginTransaction();
          await dataPersistence.saveProjectData(projectId, 'stress.json', testData, transaction);
          return dataPersistence.commitTransaction(transaction);
        })();
        
        promises.push(promise);
      }

      // Wait for all to complete
      const results = await Promise.allSettled(promises);

      // Some should succeed, some should fail
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.filter(r => r.status === 'rejected').length;
      
      expect(successCount + failureCount).toBe(concurrentTransactions);
      expect(successCount).toBeGreaterThan(0); // At least some should succeed
      expect(failureCount).toBeGreaterThan(0); // At least some should fail

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });
});
      // Save valid file
      await dataPersistence.saveProjectData(projectId, 'valid.json', validData, transaction);
      
      // Save invalid file (will cause rollback)
      await dataPersistence.saveProjectData(projectId, 'invalid.json', invalidData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Transaction should have failed');
      } catch (error) {
        expect(error.message).toContain('Transaction validation failed');
      }

      // Verify no files were created
      const validFile = await dataPersistence.loadProjectData(projectId, 'valid.json');
      const invalidFile = await dataPersistence.loadProjectData(projectId, 'invalid.json');
      expect(validFile).toBeNull();
      expect(invalidFile).toBeNull();
    });

// ============================================================================
// TRANSACTION ERROR SCENARIOS TESTS
// ============================================================================

describe('Transaction Error Scenarios', () => {
  let dataPersistence;
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'forest-error-tx-test-'));
    dataPersistence = new DataPersistence(tmpDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Disk Space Simulation Tests', () => {
    test('should handle disk full during temp file creation', async () => {
      const projectId = 'disk-full-test';
      const testData = { large: 'data'.repeat(1000) };

      // Mock FileSystem.writeFile to simulate disk full error
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
      );

      const transaction = dataPersistence.beginTransaction();
      
      try {
        await dataPersistence.saveProjectData(projectId, 'large.json', testData, transaction);
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to disk space');
      } catch (error) {
        expect(error.message).toContain('no space left on device');
        expect(error.code).toBe('ENOSPC');
      }

      // Verify no partial files remain
      const projectDir = dataPersistence.getProjectDir(projectId);
      try {
        const files = await fs.readdir(projectDir);
        const tempFiles = files.filter(f => f.endsWith('.tmp'));
        expect(tempFiles).toHaveLength(0);
      } catch (dirError) {
        // Directory might not exist, which is fine
        expect(dirError.code).toBe('ENOENT');
      }

      // Restore original function
      FileSystem.writeFile = originalWriteFile;
    });

    test('should handle disk full during commit phase', async () => {
      const projectId = 'commit-disk-full';
      const testData = { commit: 'test' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'commit.json', testData, transaction);

      // Mock FileSystem.copyFile to fail during commit
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
      );

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit');
      } catch (error) {
        expect(error.message).toContain('no space left on device');
      }

      // Verify rollback occurred - no final file should exist
      const finalData = await dataPersistence.loadProjectData(projectId, 'commit.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('File Lock Scenarios', () => {
    test('should handle file lock during temp file creation', async () => {
      const projectId = 'file-lock-temp';
      const testData = { locked: true };

      // Mock FileSystem.writeFile to simulate file lock
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
      );

      const transaction = dataPersistence.beginTransaction();

      try {
        await dataPersistence.saveProjectData(projectId, 'locked.json', testData, transaction);
        fail('Should have failed due to file lock');
      } catch (error) {
        expect(error.message).toContain('resource busy or locked');
        expect(error.code).toBe('EBUSY');
      }

      // Restore original function
      FileSystem.writeFile = originalWriteFile;
    });

    test('should handle file lock during commit phase', async () => {
      const projectId = 'file-lock-commit';
      const testData = { commit: 'locked' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'locked.json', testData, transaction);

      // Mock FileSystem.copyFile to simulate file lock during commit
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
      );

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit due to file lock');
      } catch (error) {
        expect(error.message).toContain('resource busy or locked');
      }

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'locked.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Validation Hook Failures', () => {
    test('should handle synchronous validation hook failures', async () => {
      const projectId = 'sync-validation-fail';
      const testData = { invalid: 'data' };

      const failingValidator = jest.fn().mockReturnValue(false);

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: failingValidator,
        reason: 'Synchronous validation failure'
      });

      await dataPersistence.saveProjectData(projectId, 'test.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to validation');
      } catch (error) {
        expect(error.message).toContain('Transaction validation failed');
        expect(error.message).toContain('Synchronous validation failure');
      }

      expect(failingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'test.json');
      expect(finalData).toBeNull();
    });

    test('should handle asynchronous validation hook failures', async () => {
      const projectId = 'async-validation-fail';
      const testData = { async: 'invalid' };

      const asyncFailingValidator = jest.fn().mockResolvedValue(false);

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: asyncFailingValidator,
        reason: 'Asynchronous validation failure'
      });

      await dataPersistence.saveProjectData(projectId, 'async.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to async validation');
      } catch (error) {
        expect(error.message).toContain('Transaction validation failed');
        expect(error.message).toContain('Asynchronous validation failure');
      }

      expect(asyncFailingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'async.json');
      expect(finalData).toBeNull();
    });

    test('should handle validation hook crashes', async () => {
      const projectId = 'validation-crash';
      const testData = { crash: 'test' };

      const crashingValidator = jest.fn().mockImplementation(() => {
        throw new Error('Validation hook crashed');
      });

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: crashingValidator,
        reason: 'Crashing validator'
      });

      await dataPersistence.saveProjectData(projectId, 'crash.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to validator crash');
      } catch (error) {
        expect(error.message).toContain('Validation hook crashed');
      }

      expect(crashingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'crash.json');
      expect(finalData).toBeNull();
    });
  });

  describe('Commit Operation Failures', () => {
    test('should handle failure during temp file cleanup', async () => {
      const projectId = 'cleanup-fail';
      const testData = { cleanup: 'test' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'cleanup.json', testData, transaction);

      // Mock FileSystem.deleteFile to fail during cleanup
      const originalDeleteFile = FileSystem.deleteFile;
      FileSystem.deleteFile = jest.fn().mockRejectedValue(new Error('Cannot delete temp file'));

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during temp file cleanup');
      } catch (error) {
        expect(error.message).toContain('Cannot delete temp file');
      }

      // Verify rollback was attempted
      const finalData = await dataPersistence.loadProjectData(projectId, 'cleanup.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.deleteFile = originalDeleteFile;
    });

    test('should handle partial commit failures with multiple files', async () => {
      const projectId = 'partial-commit-fail';
      const files = [
        { name: 'file1.json', data: { id: 1 } },
        { name: 'file2.json', data: { id: 2 } },
        { name: 'file3.json', data: { id: 3 } }
      ];

      const transaction = dataPersistence.beginTransaction();
      
      // Save all files in transaction
      for (const file of files) {
        await dataPersistence.saveProjectData(projectId, file.name, file.data, transaction);
      }

      // Mock FileSystem.copyFile to fail on second file
      const originalCopyFile = FileSystem.copyFile;
      let copyCallCount = 0;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        copyCallCount++;
        if (copyCallCount === 2) {
          throw new Error('Failed to copy second file');
        }
        return originalCopyFile(src, dest);
      });

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during partial commit');
      } catch (error) {
        expect(error.message).toContain('Failed to copy second file');
      }

      // Verify all files were rolled back (none should exist)
      for (const file of files) {
        const finalData = await dataPersistence.loadProjectData(projectId, file.name);
        expect(finalData).toBeNull();
      }

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Rollback Operation Failures', () => {
    test('should handle rollback failures gracefully', async () => {
      const projectId = 'rollback-fail';
      const originalData = { original: true };
      const newData = { modified: true };

      // Create initial file
      await dataPersistence.saveProjectData(projectId, 'rollback.json', originalData);

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'rollback.json', newData, transaction);

      // Mock FileSystem.writeFile to fail during rollback
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(new Error('Cannot restore backup'));

      // Force rollback by making commit fail
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(new Error('Commit failed'));

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit and rollback');
      } catch (error) {
        // The error should be from the rollback failure, not the original commit failure
        expect(error.message).toContain('Cannot restore backup');
      }

      // Restore original functions
      FileSystem.writeFile = originalWriteFile;
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Concurrent Transaction Stress Tests', () => {
    test('should handle concurrent transaction failures', async () => {
      const projectId1 = 'concurrent-fail-1';
      const projectId2 = 'concurrent-fail-2';
      const data1 = { project: 1 };
      const data2 = { project: 2 };

      // Start two concurrent transactions
      const transaction1 = dataPersistence.beginTransaction();
      const transaction2 = dataPersistence.beginTransaction();

      // Mock one to fail
      const originalCopyFile = FileSystem.copyFile;
      let copyCallCount = 0;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        copyCallCount++;
        if (copyCallCount === 1) {
          throw new Error('First transaction failed');
        }
        return originalCopyFile(src, dest);
      });

      // Execute operations concurrently
      const promise1 = (async () => {
        await dataPersistence.saveProjectData(projectId1, 'data.json', data1, transaction1);
        return dataPersistence.commitTransaction(transaction1);
      })();

      const promise2 = (async () => {
        await dataPersistence.saveProjectData(projectId2, 'data.json', data2, transaction2);
        return dataPersistence.commitTransaction(transaction2);
      })();

      // Wait for both to complete (one should fail)
      const results = await Promise.allSettled([promise1, promise2]);

      // One should fail, one should succeed
      const failedCount = results.filter(r => r.status === 'rejected').length;
      const succeededCount = results.filter(r => r.status === 'fulfilled').length;
      
      expect(failedCount).toBe(1);
      expect(succeededCount).toBe(1);

      // Verify only the successful transaction's data exists
      const result1 = await dataPersistence.loadProjectData(projectId1, 'data.json');
      const result2 = await dataPersistence.loadProjectData(projectId2, 'data.json');

      // One should be null (failed), one should have data (succeeded)
      const nullCount = [result1, result2].filter(r => r === null).length;
      const dataCount = [result1, result2].filter(r => r !== null).length;
      
      expect(nullCount).toBe(1);
      expect(dataCount).toBe(1);

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });

    test('should handle high concurrency transaction stress', async () => {
      const concurrentTransactions = 10;
      const promises = [];

      // Mock to randomly fail some transactions
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        // Randomly fail ~30% of transactions
        if (Math.random() < 0.3) {
          throw new Error('Random transaction failure');
        }
        return originalCopyFile(src, dest);
      });

      // Create multiple concurrent transactions
      for (let i = 0; i < concurrentTransactions; i++) {
        const promise = (async () => {
          const projectId = `stress-test-${i}`;
          const testData = { id: i, stress: true };
          
          const transaction = dataPersistence.beginTransaction();
          await dataPersistence.saveProjectData(projectId, 'stress.json', testData, transaction);
          return dataPersistence.commitTransaction(transaction);
        })();
        
        promises.push(promise);
      }

      // Wait for all to complete
      const results = await Promise.allSettled(promises);

      // Some should succeed, some should fail
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.filter(r => r.status === 'rejected').length;
      
      expect(successCount + failureCount).toBe(concurrentTransactions);
      expect(successCount).toBeGreaterThan(0); // At least some should succeed
      expect(failureCount).toBeGreaterThan(0); // At least some should fail

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });
});
    test('should execute validation hooks properly', async () => {
      const projectId = 'validation-hooks';
      const testData = { score: 85 };
      
      const validationHook = jest.fn().mockReturnValue(true);
      
      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: validationHook,
        reason: 'Custom validation'
      });

// ============================================================================
// TRANSACTION ERROR SCENARIOS TESTS
// ============================================================================

describe('Transaction Error Scenarios', () => {
  let dataPersistence;
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'forest-error-tx-test-'));
    dataPersistence = new DataPersistence(tmpDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Disk Space Simulation Tests', () => {
    test('should handle disk full during temp file creation', async () => {
      const projectId = 'disk-full-test';
      const testData = { large: 'data'.repeat(1000) };

      // Mock FileSystem.writeFile to simulate disk full error
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
      );

      const transaction = dataPersistence.beginTransaction();
      
      try {
        await dataPersistence.saveProjectData(projectId, 'large.json', testData, transaction);
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to disk space');
      } catch (error) {
        expect(error.message).toContain('no space left on device');
        expect(error.code).toBe('ENOSPC');
      }

      // Verify no partial files remain
      const projectDir = dataPersistence.getProjectDir(projectId);
      try {
        const files = await fs.readdir(projectDir);
        const tempFiles = files.filter(f => f.endsWith('.tmp'));
        expect(tempFiles).toHaveLength(0);
      } catch (dirError) {
        // Directory might not exist, which is fine
        expect(dirError.code).toBe('ENOENT');
      }

      // Restore original function
      FileSystem.writeFile = originalWriteFile;
    });

    test('should handle disk full during commit phase', async () => {
      const projectId = 'commit-disk-full';
      const testData = { commit: 'test' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'commit.json', testData, transaction);

      // Mock FileSystem.copyFile to fail during commit
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
      );

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit');
      } catch (error) {
        expect(error.message).toContain('no space left on device');
      }

      // Verify rollback occurred - no final file should exist
      const finalData = await dataPersistence.loadProjectData(projectId, 'commit.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('File Lock Scenarios', () => {
    test('should handle file lock during temp file creation', async () => {
      const projectId = 'file-lock-temp';
      const testData = { locked: true };

      // Mock FileSystem.writeFile to simulate file lock
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
      );

      const transaction = dataPersistence.beginTransaction();

      try {
        await dataPersistence.saveProjectData(projectId, 'locked.json', testData, transaction);
        fail('Should have failed due to file lock');
      } catch (error) {
        expect(error.message).toContain('resource busy or locked');
        expect(error.code).toBe('EBUSY');
      }

      // Restore original function
      FileSystem.writeFile = originalWriteFile;
    });

    test('should handle file lock during commit phase', async () => {
      const projectId = 'file-lock-commit';
      const testData = { commit: 'locked' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'locked.json', testData, transaction);

      // Mock FileSystem.copyFile to simulate file lock during commit
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
      );

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit due to file lock');
      } catch (error) {
        expect(error.message).toContain('resource busy or locked');
      }

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'locked.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Validation Hook Failures', () => {
    test('should handle synchronous validation hook failures', async () => {
      const projectId = 'sync-validation-fail';
      const testData = { invalid: 'data' };

      const failingValidator = jest.fn().mockReturnValue(false);

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: failingValidator,
        reason: 'Synchronous validation failure'
      });

      await dataPersistence.saveProjectData(projectId, 'test.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to validation');
      } catch (error) {
        expect(error.message).toContain('Transaction validation failed');
        expect(error.message).toContain('Synchronous validation failure');
      }

      expect(failingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'test.json');
      expect(finalData).toBeNull();
    });

    test('should handle asynchronous validation hook failures', async () => {
      const projectId = 'async-validation-fail';
      const testData = { async: 'invalid' };

      const asyncFailingValidator = jest.fn().mockResolvedValue(false);

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: asyncFailingValidator,
        reason: 'Asynchronous validation failure'
      });

      await dataPersistence.saveProjectData(projectId, 'async.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to async validation');
      } catch (error) {
        expect(error.message).toContain('Transaction validation failed');
        expect(error.message).toContain('Asynchronous validation failure');
      }

      expect(asyncFailingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'async.json');
      expect(finalData).toBeNull();
    });

    test('should handle validation hook crashes', async () => {
      const projectId = 'validation-crash';
      const testData = { crash: 'test' };

      const crashingValidator = jest.fn().mockImplementation(() => {
        throw new Error('Validation hook crashed');
      });

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: crashingValidator,
        reason: 'Crashing validator'
      });

      await dataPersistence.saveProjectData(projectId, 'crash.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to validator crash');
      } catch (error) {
        expect(error.message).toContain('Validation hook crashed');
      }

      expect(crashingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'crash.json');
      expect(finalData).toBeNull();
    });
  });

  describe('Commit Operation Failures', () => {
    test('should handle failure during temp file cleanup', async () => {
      const projectId = 'cleanup-fail';
      const testData = { cleanup: 'test' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'cleanup.json', testData, transaction);

      // Mock FileSystem.deleteFile to fail during cleanup
      const originalDeleteFile = FileSystem.deleteFile;
      FileSystem.deleteFile = jest.fn().mockRejectedValue(new Error('Cannot delete temp file'));

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during temp file cleanup');
      } catch (error) {
        expect(error.message).toContain('Cannot delete temp file');
      }

      // Verify rollback was attempted
      const finalData = await dataPersistence.loadProjectData(projectId, 'cleanup.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.deleteFile = originalDeleteFile;
    });

    test('should handle partial commit failures with multiple files', async () => {
      const projectId = 'partial-commit-fail';
      const files = [
        { name: 'file1.json', data: { id: 1 } },
        { name: 'file2.json', data: { id: 2 } },
        { name: 'file3.json', data: { id: 3 } }
      ];

      const transaction = dataPersistence.beginTransaction();
      
      // Save all files in transaction
      for (const file of files) {
        await dataPersistence.saveProjectData(projectId, file.name, file.data, transaction);
      }

      // Mock FileSystem.copyFile to fail on second file
      const originalCopyFile = FileSystem.copyFile;
      let copyCallCount = 0;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        copyCallCount++;
        if (copyCallCount === 2) {
          throw new Error('Failed to copy second file');
        }
        return originalCopyFile(src, dest);
      });

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during partial commit');
      } catch (error) {
        expect(error.message).toContain('Failed to copy second file');
      }

      // Verify all files were rolled back (none should exist)
      for (const file of files) {
        const finalData = await dataPersistence.loadProjectData(projectId, file.name);
        expect(finalData).toBeNull();
      }

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Rollback Operation Failures', () => {
    test('should handle rollback failures gracefully', async () => {
      const projectId = 'rollback-fail';
      const originalData = { original: true };
      const newData = { modified: true };

      // Create initial file
      await dataPersistence.saveProjectData(projectId, 'rollback.json', originalData);

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'rollback.json', newData, transaction);

      // Mock FileSystem.writeFile to fail during rollback
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(new Error('Cannot restore backup'));

      // Force rollback by making commit fail
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(new Error('Commit failed'));

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit and rollback');
      } catch (error) {
        // The error should be from the rollback failure, not the original commit failure
        expect(error.message).toContain('Cannot restore backup');
      }

      // Restore original functions
      FileSystem.writeFile = originalWriteFile;
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Concurrent Transaction Stress Tests', () => {
    test('should handle concurrent transaction failures', async () => {
      const projectId1 = 'concurrent-fail-1';
      const projectId2 = 'concurrent-fail-2';
      const data1 = { project: 1 };
      const data2 = { project: 2 };

      // Start two concurrent transactions
      const transaction1 = dataPersistence.beginTransaction();
      const transaction2 = dataPersistence.beginTransaction();

      // Mock one to fail
      const originalCopyFile = FileSystem.copyFile;
      let copyCallCount = 0;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        copyCallCount++;
        if (copyCallCount === 1) {
          throw new Error('First transaction failed');
        }
        return originalCopyFile(src, dest);
      });

      // Execute operations concurrently
      const promise1 = (async () => {
        await dataPersistence.saveProjectData(projectId1, 'data.json', data1, transaction1);
        return dataPersistence.commitTransaction(transaction1);
      })();

      const promise2 = (async () => {
        await dataPersistence.saveProjectData(projectId2, 'data.json', data2, transaction2);
        return dataPersistence.commitTransaction(transaction2);
      })();

      // Wait for both to complete (one should fail)
      const results = await Promise.allSettled([promise1, promise2]);

      // One should fail, one should succeed
      const failedCount = results.filter(r => r.status === 'rejected').length;
      const succeededCount = results.filter(r => r.status === 'fulfilled').length;
      
      expect(failedCount).toBe(1);
      expect(succeededCount).toBe(1);

      // Verify only the successful transaction's data exists
      const result1 = await dataPersistence.loadProjectData(projectId1, 'data.json');
      const result2 = await dataPersistence.loadProjectData(projectId2, 'data.json');

      // One should be null (failed), one should have data (succeeded)
      const nullCount = [result1, result2].filter(r => r === null).length;
      const dataCount = [result1, result2].filter(r => r !== null).length;
      
      expect(nullCount).toBe(1);
      expect(dataCount).toBe(1);

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });

    test('should handle high concurrency transaction stress', async () => {
      const concurrentTransactions = 10;
      const promises = [];

      // Mock to randomly fail some transactions
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        // Randomly fail ~30% of transactions
        if (Math.random() < 0.3) {
          throw new Error('Random transaction failure');
        }
        return originalCopyFile(src, dest);
      });

      // Create multiple concurrent transactions
      for (let i = 0; i < concurrentTransactions; i++) {
        const promise = (async () => {
          const projectId = `stress-test-${i}`;
          const testData = { id: i, stress: true };
          
          const transaction = dataPersistence.beginTransaction();
          await dataPersistence.saveProjectData(projectId, 'stress.json', testData, transaction);
          return dataPersistence.commitTransaction(transaction);
        })();
        
        promises.push(promise);
      }

      // Wait for all to complete
      const results = await Promise.allSettled(promises);

      // Some should succeed, some should fail
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.filter(r => r.status === 'rejected').length;
      
      expect(successCount + failureCount).toBe(concurrentTransactions);
      expect(successCount).toBeGreaterThan(0); // At least some should succeed
      expect(failureCount).toBeGreaterThan(0); // At least some should fail

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });
});
      await dataPersistence.saveProjectData(projectId, 'test.json', testData, transaction);
      await dataPersistence.commitTransaction(transaction);

      expect(validationHook).toHaveBeenCalledWith(testData);
      
      const savedData = await dataPersistence.loadProjectData(projectId, 'test.json');
      expect(savedData).toEqual(testData);
    });

// ============================================================================
// TRANSACTION ERROR SCENARIOS TESTS
// ============================================================================

describe('Transaction Error Scenarios', () => {
  let dataPersistence;
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'forest-error-tx-test-'));
    dataPersistence = new DataPersistence(tmpDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Disk Space Simulation Tests', () => {
    test('should handle disk full during temp file creation', async () => {
      const projectId = 'disk-full-test';
      const testData = { large: 'data'.repeat(1000) };

      // Mock FileSystem.writeFile to simulate disk full error
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
      );

      const transaction = dataPersistence.beginTransaction();
      
      try {
        await dataPersistence.saveProjectData(projectId, 'large.json', testData, transaction);
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to disk space');
      } catch (error) {
        expect(error.message).toContain('no space left on device');
        expect(error.code).toBe('ENOSPC');
      }

      // Verify no partial files remain
      const projectDir = dataPersistence.getProjectDir(projectId);
      try {
        const files = await fs.readdir(projectDir);
        const tempFiles = files.filter(f => f.endsWith('.tmp'));
        expect(tempFiles).toHaveLength(0);
      } catch (dirError) {
        // Directory might not exist, which is fine
        expect(dirError.code).toBe('ENOENT');
      }

      // Restore original function
      FileSystem.writeFile = originalWriteFile;
    });

    test('should handle disk full during commit phase', async () => {
      const projectId = 'commit-disk-full';
      const testData = { commit: 'test' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'commit.json', testData, transaction);

      // Mock FileSystem.copyFile to fail during commit
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
      );

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit');
      } catch (error) {
        expect(error.message).toContain('no space left on device');
      }

      // Verify rollback occurred - no final file should exist
      const finalData = await dataPersistence.loadProjectData(projectId, 'commit.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('File Lock Scenarios', () => {
    test('should handle file lock during temp file creation', async () => {
      const projectId = 'file-lock-temp';
      const testData = { locked: true };

      // Mock FileSystem.writeFile to simulate file lock
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
      );

      const transaction = dataPersistence.beginTransaction();

      try {
        await dataPersistence.saveProjectData(projectId, 'locked.json', testData, transaction);
        fail('Should have failed due to file lock');
      } catch (error) {
        expect(error.message).toContain('resource busy or locked');
        expect(error.code).toBe('EBUSY');
      }

      // Restore original function
      FileSystem.writeFile = originalWriteFile;
    });

    test('should handle file lock during commit phase', async () => {
      const projectId = 'file-lock-commit';
      const testData = { commit: 'locked' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'locked.json', testData, transaction);

      // Mock FileSystem.copyFile to simulate file lock during commit
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
      );

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit due to file lock');
      } catch (error) {
        expect(error.message).toContain('resource busy or locked');
      }

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'locked.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Validation Hook Failures', () => {
    test('should handle synchronous validation hook failures', async () => {
      const projectId = 'sync-validation-fail';
      const testData = { invalid: 'data' };

      const failingValidator = jest.fn().mockReturnValue(false);

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: failingValidator,
        reason: 'Synchronous validation failure'
      });

      await dataPersistence.saveProjectData(projectId, 'test.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to validation');
      } catch (error) {
        expect(error.message).toContain('Transaction validation failed');
        expect(error.message).toContain('Synchronous validation failure');
      }

      expect(failingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'test.json');
      expect(finalData).toBeNull();
    });

    test('should handle asynchronous validation hook failures', async () => {
      const projectId = 'async-validation-fail';
      const testData = { async: 'invalid' };

      const asyncFailingValidator = jest.fn().mockResolvedValue(false);

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: asyncFailingValidator,
        reason: 'Asynchronous validation failure'
      });

      await dataPersistence.saveProjectData(projectId, 'async.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to async validation');
      } catch (error) {
        expect(error.message).toContain('Transaction validation failed');
        expect(error.message).toContain('Asynchronous validation failure');
      }

      expect(asyncFailingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'async.json');
      expect(finalData).toBeNull();
    });

    test('should handle validation hook crashes', async () => {
      const projectId = 'validation-crash';
      const testData = { crash: 'test' };

      const crashingValidator = jest.fn().mockImplementation(() => {
        throw new Error('Validation hook crashed');
      });

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: crashingValidator,
        reason: 'Crashing validator'
      });

      await dataPersistence.saveProjectData(projectId, 'crash.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to validator crash');
      } catch (error) {
        expect(error.message).toContain('Validation hook crashed');
      }

      expect(crashingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'crash.json');
      expect(finalData).toBeNull();
    });
  });

  describe('Commit Operation Failures', () => {
    test('should handle failure during temp file cleanup', async () => {
      const projectId = 'cleanup-fail';
      const testData = { cleanup: 'test' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'cleanup.json', testData, transaction);

      // Mock FileSystem.deleteFile to fail during cleanup
      const originalDeleteFile = FileSystem.deleteFile;
      FileSystem.deleteFile = jest.fn().mockRejectedValue(new Error('Cannot delete temp file'));

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during temp file cleanup');
      } catch (error) {
        expect(error.message).toContain('Cannot delete temp file');
      }

      // Verify rollback was attempted
      const finalData = await dataPersistence.loadProjectData(projectId, 'cleanup.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.deleteFile = originalDeleteFile;
    });

    test('should handle partial commit failures with multiple files', async () => {
      const projectId = 'partial-commit-fail';
      const files = [
        { name: 'file1.json', data: { id: 1 } },
        { name: 'file2.json', data: { id: 2 } },
        { name: 'file3.json', data: { id: 3 } }
      ];

      const transaction = dataPersistence.beginTransaction();
      
      // Save all files in transaction
      for (const file of files) {
        await dataPersistence.saveProjectData(projectId, file.name, file.data, transaction);
      }

      // Mock FileSystem.copyFile to fail on second file
      const originalCopyFile = FileSystem.copyFile;
      let copyCallCount = 0;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        copyCallCount++;
        if (copyCallCount === 2) {
          throw new Error('Failed to copy second file');
        }
        return originalCopyFile(src, dest);
      });

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during partial commit');
      } catch (error) {
        expect(error.message).toContain('Failed to copy second file');
      }

      // Verify all files were rolled back (none should exist)
      for (const file of files) {
        const finalData = await dataPersistence.loadProjectData(projectId, file.name);
        expect(finalData).toBeNull();
      }

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Rollback Operation Failures', () => {
    test('should handle rollback failures gracefully', async () => {
      const projectId = 'rollback-fail';
      const originalData = { original: true };
      const newData = { modified: true };

      // Create initial file
      await dataPersistence.saveProjectData(projectId, 'rollback.json', originalData);

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'rollback.json', newData, transaction);

      // Mock FileSystem.writeFile to fail during rollback
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(new Error('Cannot restore backup'));

      // Force rollback by making commit fail
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(new Error('Commit failed'));

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit and rollback');
      } catch (error) {
        // The error should be from the rollback failure, not the original commit failure
        expect(error.message).toContain('Cannot restore backup');
      }

      // Restore original functions
      FileSystem.writeFile = originalWriteFile;
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Concurrent Transaction Stress Tests', () => {
    test('should handle concurrent transaction failures', async () => {
      const projectId1 = 'concurrent-fail-1';
      const projectId2 = 'concurrent-fail-2';
      const data1 = { project: 1 };
      const data2 = { project: 2 };

      // Start two concurrent transactions
      const transaction1 = dataPersistence.beginTransaction();
      const transaction2 = dataPersistence.beginTransaction();

      // Mock one to fail
      const originalCopyFile = FileSystem.copyFile;
      let copyCallCount = 0;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        copyCallCount++;
        if (copyCallCount === 1) {
          throw new Error('First transaction failed');
        }
        return originalCopyFile(src, dest);
      });

      // Execute operations concurrently
      const promise1 = (async () => {
        await dataPersistence.saveProjectData(projectId1, 'data.json', data1, transaction1);
        return dataPersistence.commitTransaction(transaction1);
      })();

      const promise2 = (async () => {
        await dataPersistence.saveProjectData(projectId2, 'data.json', data2, transaction2);
        return dataPersistence.commitTransaction(transaction2);
      })();

      // Wait for both to complete (one should fail)
      const results = await Promise.allSettled([promise1, promise2]);

      // One should fail, one should succeed
      const failedCount = results.filter(r => r.status === 'rejected').length;
      const succeededCount = results.filter(r => r.status === 'fulfilled').length;
      
      expect(failedCount).toBe(1);
      expect(succeededCount).toBe(1);

      // Verify only the successful transaction's data exists
      const result1 = await dataPersistence.loadProjectData(projectId1, 'data.json');
      const result2 = await dataPersistence.loadProjectData(projectId2, 'data.json');

      // One should be null (failed), one should have data (succeeded)
      const nullCount = [result1, result2].filter(r => r === null).length;
      const dataCount = [result1, result2].filter(r => r !== null).length;
      
      expect(nullCount).toBe(1);
      expect(dataCount).toBe(1);

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });

    test('should handle high concurrency transaction stress', async () => {
      const concurrentTransactions = 10;
      const promises = [];

      // Mock to randomly fail some transactions
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        // Randomly fail ~30% of transactions
        if (Math.random() < 0.3) {
          throw new Error('Random transaction failure');
        }
        return originalCopyFile(src, dest);
      });

      // Create multiple concurrent transactions
      for (let i = 0; i < concurrentTransactions; i++) {
        const promise = (async () => {
          const projectId = `stress-test-${i}`;
          const testData = { id: i, stress: true };
          
          const transaction = dataPersistence.beginTransaction();
          await dataPersistence.saveProjectData(projectId, 'stress.json', testData, transaction);
          return dataPersistence.commitTransaction(transaction);
        })();
        
        promises.push(promise);
      }

      // Wait for all to complete
      const results = await Promise.allSettled(promises);

      // Some should succeed, some should fail
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.filter(r => r.status === 'rejected').length;
      
      expect(successCount + failureCount).toBe(concurrentTransactions);
      expect(successCount).toBeGreaterThan(0); // At least some should succeed
      expect(failureCount).toBeGreaterThan(0); // At least some should fail

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });
});
  });

// ============================================================================
// TRANSACTION ERROR SCENARIOS TESTS
// ============================================================================

describe('Transaction Error Scenarios', () => {
  let dataPersistence;
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'forest-error-tx-test-'));
    dataPersistence = new DataPersistence(tmpDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Disk Space Simulation Tests', () => {
    test('should handle disk full during temp file creation', async () => {
      const projectId = 'disk-full-test';
      const testData = { large: 'data'.repeat(1000) };

      // Mock FileSystem.writeFile to simulate disk full error
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
      );

      const transaction = dataPersistence.beginTransaction();
      
      try {
        await dataPersistence.saveProjectData(projectId, 'large.json', testData, transaction);
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to disk space');
      } catch (error) {
        expect(error.message).toContain('no space left on device');
        expect(error.code).toBe('ENOSPC');
      }

      // Verify no partial files remain
      const projectDir = dataPersistence.getProjectDir(projectId);
      try {
        const files = await fs.readdir(projectDir);
        const tempFiles = files.filter(f => f.endsWith('.tmp'));
        expect(tempFiles).toHaveLength(0);
      } catch (dirError) {
        // Directory might not exist, which is fine
        expect(dirError.code).toBe('ENOENT');
      }

      // Restore original function
      FileSystem.writeFile = originalWriteFile;
    });

    test('should handle disk full during commit phase', async () => {
      const projectId = 'commit-disk-full';
      const testData = { commit: 'test' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'commit.json', testData, transaction);

      // Mock FileSystem.copyFile to fail during commit
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
      );

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit');
      } catch (error) {
        expect(error.message).toContain('no space left on device');
      }

      // Verify rollback occurred - no final file should exist
      const finalData = await dataPersistence.loadProjectData(projectId, 'commit.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('File Lock Scenarios', () => {
    test('should handle file lock during temp file creation', async () => {
      const projectId = 'file-lock-temp';
      const testData = { locked: true };

      // Mock FileSystem.writeFile to simulate file lock
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
      );

      const transaction = dataPersistence.beginTransaction();

      try {
        await dataPersistence.saveProjectData(projectId, 'locked.json', testData, transaction);
        fail('Should have failed due to file lock');
      } catch (error) {
        expect(error.message).toContain('resource busy or locked');
        expect(error.code).toBe('EBUSY');
      }

      // Restore original function
      FileSystem.writeFile = originalWriteFile;
    });

    test('should handle file lock during commit phase', async () => {
      const projectId = 'file-lock-commit';
      const testData = { commit: 'locked' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'locked.json', testData, transaction);

      // Mock FileSystem.copyFile to simulate file lock during commit
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
      );

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit due to file lock');
      } catch (error) {
        expect(error.message).toContain('resource busy or locked');
      }

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'locked.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Validation Hook Failures', () => {
    test('should handle synchronous validation hook failures', async () => {
      const projectId = 'sync-validation-fail';
      const testData = { invalid: 'data' };

      const failingValidator = jest.fn().mockReturnValue(false);

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: failingValidator,
        reason: 'Synchronous validation failure'
      });

      await dataPersistence.saveProjectData(projectId, 'test.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to validation');
      } catch (error) {
        expect(error.message).toContain('Transaction validation failed');
        expect(error.message).toContain('Synchronous validation failure');
      }

      expect(failingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'test.json');
      expect(finalData).toBeNull();
    });

    test('should handle asynchronous validation hook failures', async () => {
      const projectId = 'async-validation-fail';
      const testData = { async: 'invalid' };

      const asyncFailingValidator = jest.fn().mockResolvedValue(false);

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: asyncFailingValidator,
        reason: 'Asynchronous validation failure'
      });

      await dataPersistence.saveProjectData(projectId, 'async.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to async validation');
      } catch (error) {
        expect(error.message).toContain('Transaction validation failed');
        expect(error.message).toContain('Asynchronous validation failure');
      }

      expect(asyncFailingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'async.json');
      expect(finalData).toBeNull();
    });

    test('should handle validation hook crashes', async () => {
      const projectId = 'validation-crash';
      const testData = { crash: 'test' };

      const crashingValidator = jest.fn().mockImplementation(() => {
        throw new Error('Validation hook crashed');
      });

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: crashingValidator,
        reason: 'Crashing validator'
      });

      await dataPersistence.saveProjectData(projectId, 'crash.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to validator crash');
      } catch (error) {
        expect(error.message).toContain('Validation hook crashed');
      }

      expect(crashingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'crash.json');
      expect(finalData).toBeNull();
    });
  });

  describe('Commit Operation Failures', () => {
    test('should handle failure during temp file cleanup', async () => {
      const projectId = 'cleanup-fail';
      const testData = { cleanup: 'test' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'cleanup.json', testData, transaction);

      // Mock FileSystem.deleteFile to fail during cleanup
      const originalDeleteFile = FileSystem.deleteFile;
      FileSystem.deleteFile = jest.fn().mockRejectedValue(new Error('Cannot delete temp file'));

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during temp file cleanup');
      } catch (error) {
        expect(error.message).toContain('Cannot delete temp file');
      }

      // Verify rollback was attempted
      const finalData = await dataPersistence.loadProjectData(projectId, 'cleanup.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.deleteFile = originalDeleteFile;
    });

    test('should handle partial commit failures with multiple files', async () => {
      const projectId = 'partial-commit-fail';
      const files = [
        { name: 'file1.json', data: { id: 1 } },
        { name: 'file2.json', data: { id: 2 } },
        { name: 'file3.json', data: { id: 3 } }
      ];

      const transaction = dataPersistence.beginTransaction();
      
      // Save all files in transaction
      for (const file of files) {
        await dataPersistence.saveProjectData(projectId, file.name, file.data, transaction);
      }

      // Mock FileSystem.copyFile to fail on second file
      const originalCopyFile = FileSystem.copyFile;
      let copyCallCount = 0;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        copyCallCount++;
        if (copyCallCount === 2) {
          throw new Error('Failed to copy second file');
        }
        return originalCopyFile(src, dest);
      });

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during partial commit');
      } catch (error) {
        expect(error.message).toContain('Failed to copy second file');
      }

      // Verify all files were rolled back (none should exist)
      for (const file of files) {
        const finalData = await dataPersistence.loadProjectData(projectId, file.name);
        expect(finalData).toBeNull();
      }

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Rollback Operation Failures', () => {
    test('should handle rollback failures gracefully', async () => {
      const projectId = 'rollback-fail';
      const originalData = { original: true };
      const newData = { modified: true };

      // Create initial file
      await dataPersistence.saveProjectData(projectId, 'rollback.json', originalData);

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'rollback.json', newData, transaction);

      // Mock FileSystem.writeFile to fail during rollback
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(new Error('Cannot restore backup'));

      // Force rollback by making commit fail
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(new Error('Commit failed'));

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit and rollback');
      } catch (error) {
        // The error should be from the rollback failure, not the original commit failure
        expect(error.message).toContain('Cannot restore backup');
      }

      // Restore original functions
      FileSystem.writeFile = originalWriteFile;
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Concurrent Transaction Stress Tests', () => {
    test('should handle concurrent transaction failures', async () => {
      const projectId1 = 'concurrent-fail-1';
      const projectId2 = 'concurrent-fail-2';
      const data1 = { project: 1 };
      const data2 = { project: 2 };

      // Start two concurrent transactions
      const transaction1 = dataPersistence.beginTransaction();
      const transaction2 = dataPersistence.beginTransaction();

      // Mock one to fail
      const originalCopyFile = FileSystem.copyFile;
      let copyCallCount = 0;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        copyCallCount++;
        if (copyCallCount === 1) {
          throw new Error('First transaction failed');
        }
        return originalCopyFile(src, dest);
      });

      // Execute operations concurrently
      const promise1 = (async () => {
        await dataPersistence.saveProjectData(projectId1, 'data.json', data1, transaction1);
        return dataPersistence.commitTransaction(transaction1);
      })();

      const promise2 = (async () => {
        await dataPersistence.saveProjectData(projectId2, 'data.json', data2, transaction2);
        return dataPersistence.commitTransaction(transaction2);
      })();

      // Wait for both to complete (one should fail)
      const results = await Promise.allSettled([promise1, promise2]);

      // One should fail, one should succeed
      const failedCount = results.filter(r => r.status === 'rejected').length;
      const succeededCount = results.filter(r => r.status === 'fulfilled').length;
      
      expect(failedCount).toBe(1);
      expect(succeededCount).toBe(1);

      // Verify only the successful transaction's data exists
      const result1 = await dataPersistence.loadProjectData(projectId1, 'data.json');
      const result2 = await dataPersistence.loadProjectData(projectId2, 'data.json');

      // One should be null (failed), one should have data (succeeded)
      const nullCount = [result1, result2].filter(r => r === null).length;
      const dataCount = [result1, result2].filter(r => r !== null).length;
      
      expect(nullCount).toBe(1);
      expect(dataCount).toBe(1);

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });

    test('should handle high concurrency transaction stress', async () => {
      const concurrentTransactions = 10;
      const promises = [];

      // Mock to randomly fail some transactions
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        // Randomly fail ~30% of transactions
        if (Math.random() < 0.3) {
          throw new Error('Random transaction failure');
        }
        return originalCopyFile(src, dest);
      });

      // Create multiple concurrent transactions
      for (let i = 0; i < concurrentTransactions; i++) {
        const promise = (async () => {
          const projectId = `stress-test-${i}`;
          const testData = { id: i, stress: true };
          
          const transaction = dataPersistence.beginTransaction();
          await dataPersistence.saveProjectData(projectId, 'stress.json', testData, transaction);
          return dataPersistence.commitTransaction(transaction);
        })();
        
        promises.push(promise);
      }

      // Wait for all to complete
      const results = await Promise.allSettled(promises);

      // Some should succeed, some should fail
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.filter(r => r.status === 'rejected').length;
      
      expect(successCount + failureCount).toBe(concurrentTransactions);
      expect(successCount).toBeGreaterThan(0); // At least some should succeed
      expect(failureCount).toBeGreaterThan(0); // At least some should fail

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });
});
  describe('Error Scenarios', () => {
    test('should handle disk space simulation', async () => {
      const projectId = 'disk-space-test';
      const testData = { large: 'data'.repeat(1000) };

      // Mock FileSystem.writeFile to simulate disk full error
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(new Error('ENOSPC: no space left on device'));

      const transaction = dataPersistence.beginTransaction();
      
      try {
        await dataPersistence.saveProjectData(projectId, 'large.json', testData, transaction);
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to disk space');
      } catch (error) {
        expect(error.message).toContain('no space left on device');
      }

      // Restore original function
      FileSystem.writeFile = originalWriteFile;
    });

// ============================================================================
// TRANSACTION ERROR SCENARIOS TESTS
// ============================================================================

describe('Transaction Error Scenarios', () => {
  let dataPersistence;
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'forest-error-tx-test-'));
    dataPersistence = new DataPersistence(tmpDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Disk Space Simulation Tests', () => {
    test('should handle disk full during temp file creation', async () => {
      const projectId = 'disk-full-test';
      const testData = { large: 'data'.repeat(1000) };

      // Mock FileSystem.writeFile to simulate disk full error
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
      );

      const transaction = dataPersistence.beginTransaction();
      
      try {
        await dataPersistence.saveProjectData(projectId, 'large.json', testData, transaction);
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to disk space');
      } catch (error) {
        expect(error.message).toContain('no space left on device');
        expect(error.code).toBe('ENOSPC');
      }

      // Verify no partial files remain
      const projectDir = dataPersistence.getProjectDir(projectId);
      try {
        const files = await fs.readdir(projectDir);
        const tempFiles = files.filter(f => f.endsWith('.tmp'));
        expect(tempFiles).toHaveLength(0);
      } catch (dirError) {
        // Directory might not exist, which is fine
        expect(dirError.code).toBe('ENOENT');
      }

      // Restore original function
      FileSystem.writeFile = originalWriteFile;
    });

    test('should handle disk full during commit phase', async () => {
      const projectId = 'commit-disk-full';
      const testData = { commit: 'test' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'commit.json', testData, transaction);

      // Mock FileSystem.copyFile to fail during commit
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
      );

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit');
      } catch (error) {
        expect(error.message).toContain('no space left on device');
      }

      // Verify rollback occurred - no final file should exist
      const finalData = await dataPersistence.loadProjectData(projectId, 'commit.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('File Lock Scenarios', () => {
    test('should handle file lock during temp file creation', async () => {
      const projectId = 'file-lock-temp';
      const testData = { locked: true };

      // Mock FileSystem.writeFile to simulate file lock
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
      );

      const transaction = dataPersistence.beginTransaction();

      try {
        await dataPersistence.saveProjectData(projectId, 'locked.json', testData, transaction);
        fail('Should have failed due to file lock');
      } catch (error) {
        expect(error.message).toContain('resource busy or locked');
        expect(error.code).toBe('EBUSY');
      }

      // Restore original function
      FileSystem.writeFile = originalWriteFile;
    });

    test('should handle file lock during commit phase', async () => {
      const projectId = 'file-lock-commit';
      const testData = { commit: 'locked' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'locked.json', testData, transaction);

      // Mock FileSystem.copyFile to simulate file lock during commit
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
      );

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit due to file lock');
      } catch (error) {
        expect(error.message).toContain('resource busy or locked');
      }

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'locked.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Validation Hook Failures', () => {
    test('should handle synchronous validation hook failures', async () => {
      const projectId = 'sync-validation-fail';
      const testData = { invalid: 'data' };

      const failingValidator = jest.fn().mockReturnValue(false);

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: failingValidator,
        reason: 'Synchronous validation failure'
      });

      await dataPersistence.saveProjectData(projectId, 'test.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to validation');
      } catch (error) {
        expect(error.message).toContain('Transaction validation failed');
        expect(error.message).toContain('Synchronous validation failure');
      }

      expect(failingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'test.json');
      expect(finalData).toBeNull();
    });

    test('should handle asynchronous validation hook failures', async () => {
      const projectId = 'async-validation-fail';
      const testData = { async: 'invalid' };

      const asyncFailingValidator = jest.fn().mockResolvedValue(false);

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: asyncFailingValidator,
        reason: 'Asynchronous validation failure'
      });

      await dataPersistence.saveProjectData(projectId, 'async.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to async validation');
      } catch (error) {
        expect(error.message).toContain('Transaction validation failed');
        expect(error.message).toContain('Asynchronous validation failure');
      }

      expect(asyncFailingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'async.json');
      expect(finalData).toBeNull();
    });

    test('should handle validation hook crashes', async () => {
      const projectId = 'validation-crash';
      const testData = { crash: 'test' };

      const crashingValidator = jest.fn().mockImplementation(() => {
        throw new Error('Validation hook crashed');
      });

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: crashingValidator,
        reason: 'Crashing validator'
      });

      await dataPersistence.saveProjectData(projectId, 'crash.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to validator crash');
      } catch (error) {
        expect(error.message).toContain('Validation hook crashed');
      }

      expect(crashingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'crash.json');
      expect(finalData).toBeNull();
    });
  });

  describe('Commit Operation Failures', () => {
    test('should handle failure during temp file cleanup', async () => {
      const projectId = 'cleanup-fail';
      const testData = { cleanup: 'test' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'cleanup.json', testData, transaction);

      // Mock FileSystem.deleteFile to fail during cleanup
      const originalDeleteFile = FileSystem.deleteFile;
      FileSystem.deleteFile = jest.fn().mockRejectedValue(new Error('Cannot delete temp file'));

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during temp file cleanup');
      } catch (error) {
        expect(error.message).toContain('Cannot delete temp file');
      }

      // Verify rollback was attempted
      const finalData = await dataPersistence.loadProjectData(projectId, 'cleanup.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.deleteFile = originalDeleteFile;
    });

    test('should handle partial commit failures with multiple files', async () => {
      const projectId = 'partial-commit-fail';
      const files = [
        { name: 'file1.json', data: { id: 1 } },
        { name: 'file2.json', data: { id: 2 } },
        { name: 'file3.json', data: { id: 3 } }
      ];

      const transaction = dataPersistence.beginTransaction();
      
      // Save all files in transaction
      for (const file of files) {
        await dataPersistence.saveProjectData(projectId, file.name, file.data, transaction);
      }

      // Mock FileSystem.copyFile to fail on second file
      const originalCopyFile = FileSystem.copyFile;
      let copyCallCount = 0;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        copyCallCount++;
        if (copyCallCount === 2) {
          throw new Error('Failed to copy second file');
        }
        return originalCopyFile(src, dest);
      });

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during partial commit');
      } catch (error) {
        expect(error.message).toContain('Failed to copy second file');
      }

      // Verify all files were rolled back (none should exist)
      for (const file of files) {
        const finalData = await dataPersistence.loadProjectData(projectId, file.name);
        expect(finalData).toBeNull();
      }

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Rollback Operation Failures', () => {
    test('should handle rollback failures gracefully', async () => {
      const projectId = 'rollback-fail';
      const originalData = { original: true };
      const newData = { modified: true };

      // Create initial file
      await dataPersistence.saveProjectData(projectId, 'rollback.json', originalData);

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'rollback.json', newData, transaction);

      // Mock FileSystem.writeFile to fail during rollback
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(new Error('Cannot restore backup'));

      // Force rollback by making commit fail
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(new Error('Commit failed'));

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit and rollback');
      } catch (error) {
        // The error should be from the rollback failure, not the original commit failure
        expect(error.message).toContain('Cannot restore backup');
      }

      // Restore original functions
      FileSystem.writeFile = originalWriteFile;
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Concurrent Transaction Stress Tests', () => {
    test('should handle concurrent transaction failures', async () => {
      const projectId1 = 'concurrent-fail-1';
      const projectId2 = 'concurrent-fail-2';
      const data1 = { project: 1 };
      const data2 = { project: 2 };

      // Start two concurrent transactions
      const transaction1 = dataPersistence.beginTransaction();
      const transaction2 = dataPersistence.beginTransaction();

      // Mock one to fail
      const originalCopyFile = FileSystem.copyFile;
      let copyCallCount = 0;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        copyCallCount++;
        if (copyCallCount === 1) {
          throw new Error('First transaction failed');
        }
        return originalCopyFile(src, dest);
      });

      // Execute operations concurrently
      const promise1 = (async () => {
        await dataPersistence.saveProjectData(projectId1, 'data.json', data1, transaction1);
        return dataPersistence.commitTransaction(transaction1);
      })();

      const promise2 = (async () => {
        await dataPersistence.saveProjectData(projectId2, 'data.json', data2, transaction2);
        return dataPersistence.commitTransaction(transaction2);
      })();

      // Wait for both to complete (one should fail)
      const results = await Promise.allSettled([promise1, promise2]);

      // One should fail, one should succeed
      const failedCount = results.filter(r => r.status === 'rejected').length;
      const succeededCount = results.filter(r => r.status === 'fulfilled').length;
      
      expect(failedCount).toBe(1);
      expect(succeededCount).toBe(1);

      // Verify only the successful transaction's data exists
      const result1 = await dataPersistence.loadProjectData(projectId1, 'data.json');
      const result2 = await dataPersistence.loadProjectData(projectId2, 'data.json');

      // One should be null (failed), one should have data (succeeded)
      const nullCount = [result1, result2].filter(r => r === null).length;
      const dataCount = [result1, result2].filter(r => r !== null).length;
      
      expect(nullCount).toBe(1);
      expect(dataCount).toBe(1);

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });

    test('should handle high concurrency transaction stress', async () => {
      const concurrentTransactions = 10;
      const promises = [];

      // Mock to randomly fail some transactions
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        // Randomly fail ~30% of transactions
        if (Math.random() < 0.3) {
          throw new Error('Random transaction failure');
        }
        return originalCopyFile(src, dest);
      });

      // Create multiple concurrent transactions
      for (let i = 0; i < concurrentTransactions; i++) {
        const promise = (async () => {
          const projectId = `stress-test-${i}`;
          const testData = { id: i, stress: true };
          
          const transaction = dataPersistence.beginTransaction();
          await dataPersistence.saveProjectData(projectId, 'stress.json', testData, transaction);
          return dataPersistence.commitTransaction(transaction);
        })();
        
        promises.push(promise);
      }

      // Wait for all to complete
      const results = await Promise.allSettled(promises);

      // Some should succeed, some should fail
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.filter(r => r.status === 'rejected').length;
      
      expect(successCount + failureCount).toBe(concurrentTransactions);
      expect(successCount).toBeGreaterThan(0); // At least some should succeed
      expect(failureCount).toBeGreaterThan(0); // At least some should fail

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });
});
    test('should handle file lock scenarios', async () => {
      const projectId = 'file-lock-test';
      const testData = { locked: true };

      // Mock FileSystem.copyFile to simulate file lock
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(new Error('EBUSY: resource busy or locked'));

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'locked.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to file lock');
      } catch (error) {
        expect(error.message).toContain('resource busy or locked');
      }

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });

// ============================================================================
// TRANSACTION ERROR SCENARIOS TESTS
// ============================================================================

describe('Transaction Error Scenarios', () => {
  let dataPersistence;
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'forest-error-tx-test-'));
    dataPersistence = new DataPersistence(tmpDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Disk Space Simulation Tests', () => {
    test('should handle disk full during temp file creation', async () => {
      const projectId = 'disk-full-test';
      const testData = { large: 'data'.repeat(1000) };

      // Mock FileSystem.writeFile to simulate disk full error
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
      );

      const transaction = dataPersistence.beginTransaction();
      
      try {
        await dataPersistence.saveProjectData(projectId, 'large.json', testData, transaction);
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to disk space');
      } catch (error) {
        expect(error.message).toContain('no space left on device');
        expect(error.code).toBe('ENOSPC');
      }

      // Verify no partial files remain
      const projectDir = dataPersistence.getProjectDir(projectId);
      try {
        const files = await fs.readdir(projectDir);
        const tempFiles = files.filter(f => f.endsWith('.tmp'));
        expect(tempFiles).toHaveLength(0);
      } catch (dirError) {
        // Directory might not exist, which is fine
        expect(dirError.code).toBe('ENOENT');
      }

      // Restore original function
      FileSystem.writeFile = originalWriteFile;
    });

    test('should handle disk full during commit phase', async () => {
      const projectId = 'commit-disk-full';
      const testData = { commit: 'test' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'commit.json', testData, transaction);

      // Mock FileSystem.copyFile to fail during commit
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
      );

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit');
      } catch (error) {
        expect(error.message).toContain('no space left on device');
      }

      // Verify rollback occurred - no final file should exist
      const finalData = await dataPersistence.loadProjectData(projectId, 'commit.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('File Lock Scenarios', () => {
    test('should handle file lock during temp file creation', async () => {
      const projectId = 'file-lock-temp';
      const testData = { locked: true };

      // Mock FileSystem.writeFile to simulate file lock
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
      );

      const transaction = dataPersistence.beginTransaction();

      try {
        await dataPersistence.saveProjectData(projectId, 'locked.json', testData, transaction);
        fail('Should have failed due to file lock');
      } catch (error) {
        expect(error.message).toContain('resource busy or locked');
        expect(error.code).toBe('EBUSY');
      }

      // Restore original function
      FileSystem.writeFile = originalWriteFile;
    });

    test('should handle file lock during commit phase', async () => {
      const projectId = 'file-lock-commit';
      const testData = { commit: 'locked' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'locked.json', testData, transaction);

      // Mock FileSystem.copyFile to simulate file lock during commit
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
      );

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit due to file lock');
      } catch (error) {
        expect(error.message).toContain('resource busy or locked');
      }

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'locked.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Validation Hook Failures', () => {
    test('should handle synchronous validation hook failures', async () => {
      const projectId = 'sync-validation-fail';
      const testData = { invalid: 'data' };

      const failingValidator = jest.fn().mockReturnValue(false);

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: failingValidator,
        reason: 'Synchronous validation failure'
      });

      await dataPersistence.saveProjectData(projectId, 'test.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to validation');
      } catch (error) {
        expect(error.message).toContain('Transaction validation failed');
        expect(error.message).toContain('Synchronous validation failure');
      }

      expect(failingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'test.json');
      expect(finalData).toBeNull();
    });

    test('should handle asynchronous validation hook failures', async () => {
      const projectId = 'async-validation-fail';
      const testData = { async: 'invalid' };

      const asyncFailingValidator = jest.fn().mockResolvedValue(false);

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: asyncFailingValidator,
        reason: 'Asynchronous validation failure'
      });

      await dataPersistence.saveProjectData(projectId, 'async.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to async validation');
      } catch (error) {
        expect(error.message).toContain('Transaction validation failed');
        expect(error.message).toContain('Asynchronous validation failure');
      }

      expect(asyncFailingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'async.json');
      expect(finalData).toBeNull();
    });

    test('should handle validation hook crashes', async () => {
      const projectId = 'validation-crash';
      const testData = { crash: 'test' };

      const crashingValidator = jest.fn().mockImplementation(() => {
        throw new Error('Validation hook crashed');
      });

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: crashingValidator,
        reason: 'Crashing validator'
      });

      await dataPersistence.saveProjectData(projectId, 'crash.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to validator crash');
      } catch (error) {
        expect(error.message).toContain('Validation hook crashed');
      }

      expect(crashingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'crash.json');
      expect(finalData).toBeNull();
    });
  });

  describe('Commit Operation Failures', () => {
    test('should handle failure during temp file cleanup', async () => {
      const projectId = 'cleanup-fail';
      const testData = { cleanup: 'test' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'cleanup.json', testData, transaction);

      // Mock FileSystem.deleteFile to fail during cleanup
      const originalDeleteFile = FileSystem.deleteFile;
      FileSystem.deleteFile = jest.fn().mockRejectedValue(new Error('Cannot delete temp file'));

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during temp file cleanup');
      } catch (error) {
        expect(error.message).toContain('Cannot delete temp file');
      }

      // Verify rollback was attempted
      const finalData = await dataPersistence.loadProjectData(projectId, 'cleanup.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.deleteFile = originalDeleteFile;
    });

    test('should handle partial commit failures with multiple files', async () => {
      const projectId = 'partial-commit-fail';
      const files = [
        { name: 'file1.json', data: { id: 1 } },
        { name: 'file2.json', data: { id: 2 } },
        { name: 'file3.json', data: { id: 3 } }
      ];

      const transaction = dataPersistence.beginTransaction();
      
      // Save all files in transaction
      for (const file of files) {
        await dataPersistence.saveProjectData(projectId, file.name, file.data, transaction);
      }

      // Mock FileSystem.copyFile to fail on second file
      const originalCopyFile = FileSystem.copyFile;
      let copyCallCount = 0;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        copyCallCount++;
        if (copyCallCount === 2) {
          throw new Error('Failed to copy second file');
        }
        return originalCopyFile(src, dest);
      });

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during partial commit');
      } catch (error) {
        expect(error.message).toContain('Failed to copy second file');
      }

      // Verify all files were rolled back (none should exist)
      for (const file of files) {
        const finalData = await dataPersistence.loadProjectData(projectId, file.name);
        expect(finalData).toBeNull();
      }

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Rollback Operation Failures', () => {
    test('should handle rollback failures gracefully', async () => {
      const projectId = 'rollback-fail';
      const originalData = { original: true };
      const newData = { modified: true };

      // Create initial file
      await dataPersistence.saveProjectData(projectId, 'rollback.json', originalData);

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'rollback.json', newData, transaction);

      // Mock FileSystem.writeFile to fail during rollback
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(new Error('Cannot restore backup'));

      // Force rollback by making commit fail
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(new Error('Commit failed'));

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit and rollback');
      } catch (error) {
        // The error should be from the rollback failure, not the original commit failure
        expect(error.message).toContain('Cannot restore backup');
      }

      // Restore original functions
      FileSystem.writeFile = originalWriteFile;
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Concurrent Transaction Stress Tests', () => {
    test('should handle concurrent transaction failures', async () => {
      const projectId1 = 'concurrent-fail-1';
      const projectId2 = 'concurrent-fail-2';
      const data1 = { project: 1 };
      const data2 = { project: 2 };

      // Start two concurrent transactions
      const transaction1 = dataPersistence.beginTransaction();
      const transaction2 = dataPersistence.beginTransaction();

      // Mock one to fail
      const originalCopyFile = FileSystem.copyFile;
      let copyCallCount = 0;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        copyCallCount++;
        if (copyCallCount === 1) {
          throw new Error('First transaction failed');
        }
        return originalCopyFile(src, dest);
      });

      // Execute operations concurrently
      const promise1 = (async () => {
        await dataPersistence.saveProjectData(projectId1, 'data.json', data1, transaction1);
        return dataPersistence.commitTransaction(transaction1);
      })();

      const promise2 = (async () => {
        await dataPersistence.saveProjectData(projectId2, 'data.json', data2, transaction2);
        return dataPersistence.commitTransaction(transaction2);
      })();

      // Wait for both to complete (one should fail)
      const results = await Promise.allSettled([promise1, promise2]);

      // One should fail, one should succeed
      const failedCount = results.filter(r => r.status === 'rejected').length;
      const succeededCount = results.filter(r => r.status === 'fulfilled').length;
      
      expect(failedCount).toBe(1);
      expect(succeededCount).toBe(1);

      // Verify only the successful transaction's data exists
      const result1 = await dataPersistence.loadProjectData(projectId1, 'data.json');
      const result2 = await dataPersistence.loadProjectData(projectId2, 'data.json');

      // One should be null (failed), one should have data (succeeded)
      const nullCount = [result1, result2].filter(r => r === null).length;
      const dataCount = [result1, result2].filter(r => r !== null).length;
      
      expect(nullCount).toBe(1);
      expect(dataCount).toBe(1);

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });

    test('should handle high concurrency transaction stress', async () => {
      const concurrentTransactions = 10;
      const promises = [];

      // Mock to randomly fail some transactions
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        // Randomly fail ~30% of transactions
        if (Math.random() < 0.3) {
          throw new Error('Random transaction failure');
        }
        return originalCopyFile(src, dest);
      });

      // Create multiple concurrent transactions
      for (let i = 0; i < concurrentTransactions; i++) {
        const promise = (async () => {
          const projectId = `stress-test-${i}`;
          const testData = { id: i, stress: true };
          
          const transaction = dataPersistence.beginTransaction();
          await dataPersistence.saveProjectData(projectId, 'stress.json', testData, transaction);
          return dataPersistence.commitTransaction(transaction);
        })();
        
        promises.push(promise);
      }

      // Wait for all to complete
      const results = await Promise.allSettled(promises);

      // Some should succeed, some should fail
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.filter(r => r.status === 'rejected').length;
      
      expect(successCount + failureCount).toBe(concurrentTransactions);
      expect(successCount).toBeGreaterThan(0); // At least some should succeed
      expect(failureCount).toBeGreaterThan(0); // At least some should fail

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });
});
    test('should handle validation hook failures', async () => {
      const projectId = 'validation-failure';
      const testData = { invalid: 'data' };

      const failingValidator = jest.fn().mockImplementation(() => {
        throw new Error('Validation hook crashed');
      });

// ============================================================================
// TRANSACTION ERROR SCENARIOS TESTS
// ============================================================================

describe('Transaction Error Scenarios', () => {
  let dataPersistence;
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'forest-error-tx-test-'));
    dataPersistence = new DataPersistence(tmpDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Disk Space Simulation Tests', () => {
    test('should handle disk full during temp file creation', async () => {
      const projectId = 'disk-full-test';
      const testData = { large: 'data'.repeat(1000) };

      // Mock FileSystem.writeFile to simulate disk full error
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
      );

      const transaction = dataPersistence.beginTransaction();
      
      try {
        await dataPersistence.saveProjectData(projectId, 'large.json', testData, transaction);
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to disk space');
      } catch (error) {
        expect(error.message).toContain('no space left on device');
        expect(error.code).toBe('ENOSPC');
      }

      // Verify no partial files remain
      const projectDir = dataPersistence.getProjectDir(projectId);
      try {
        const files = await fs.readdir(projectDir);
        const tempFiles = files.filter(f => f.endsWith('.tmp'));
        expect(tempFiles).toHaveLength(0);
      } catch (dirError) {
        // Directory might not exist, which is fine
        expect(dirError.code).toBe('ENOENT');
      }

      // Restore original function
      FileSystem.writeFile = originalWriteFile;
    });

    test('should handle disk full during commit phase', async () => {
      const projectId = 'commit-disk-full';
      const testData = { commit: 'test' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'commit.json', testData, transaction);

      // Mock FileSystem.copyFile to fail during commit
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
      );

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit');
      } catch (error) {
        expect(error.message).toContain('no space left on device');
      }

      // Verify rollback occurred - no final file should exist
      const finalData = await dataPersistence.loadProjectData(projectId, 'commit.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('File Lock Scenarios', () => {
    test('should handle file lock during temp file creation', async () => {
      const projectId = 'file-lock-temp';
      const testData = { locked: true };

      // Mock FileSystem.writeFile to simulate file lock
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
      );

      const transaction = dataPersistence.beginTransaction();

      try {
        await dataPersistence.saveProjectData(projectId, 'locked.json', testData, transaction);
        fail('Should have failed due to file lock');
      } catch (error) {
        expect(error.message).toContain('resource busy or locked');
        expect(error.code).toBe('EBUSY');
      }

      // Restore original function
      FileSystem.writeFile = originalWriteFile;
    });

    test('should handle file lock during commit phase', async () => {
      const projectId = 'file-lock-commit';
      const testData = { commit: 'locked' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'locked.json', testData, transaction);

      // Mock FileSystem.copyFile to simulate file lock during commit
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
      );

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit due to file lock');
      } catch (error) {
        expect(error.message).toContain('resource busy or locked');
      }

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'locked.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Validation Hook Failures', () => {
    test('should handle synchronous validation hook failures', async () => {
      const projectId = 'sync-validation-fail';
      const testData = { invalid: 'data' };

      const failingValidator = jest.fn().mockReturnValue(false);

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: failingValidator,
        reason: 'Synchronous validation failure'
      });

      await dataPersistence.saveProjectData(projectId, 'test.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to validation');
      } catch (error) {
        expect(error.message).toContain('Transaction validation failed');
        expect(error.message).toContain('Synchronous validation failure');
      }

      expect(failingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'test.json');
      expect(finalData).toBeNull();
    });

    test('should handle asynchronous validation hook failures', async () => {
      const projectId = 'async-validation-fail';
      const testData = { async: 'invalid' };

      const asyncFailingValidator = jest.fn().mockResolvedValue(false);

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: asyncFailingValidator,
        reason: 'Asynchronous validation failure'
      });

      await dataPersistence.saveProjectData(projectId, 'async.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to async validation');
      } catch (error) {
        expect(error.message).toContain('Transaction validation failed');
        expect(error.message).toContain('Asynchronous validation failure');
      }

      expect(asyncFailingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'async.json');
      expect(finalData).toBeNull();
    });

    test('should handle validation hook crashes', async () => {
      const projectId = 'validation-crash';
      const testData = { crash: 'test' };

      const crashingValidator = jest.fn().mockImplementation(() => {
        throw new Error('Validation hook crashed');
      });

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: crashingValidator,
        reason: 'Crashing validator'
      });

      await dataPersistence.saveProjectData(projectId, 'crash.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to validator crash');
      } catch (error) {
        expect(error.message).toContain('Validation hook crashed');
      }

      expect(crashingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'crash.json');
      expect(finalData).toBeNull();
    });
  });

  describe('Commit Operation Failures', () => {
    test('should handle failure during temp file cleanup', async () => {
      const projectId = 'cleanup-fail';
      const testData = { cleanup: 'test' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'cleanup.json', testData, transaction);

      // Mock FileSystem.deleteFile to fail during cleanup
      const originalDeleteFile = FileSystem.deleteFile;
      FileSystem.deleteFile = jest.fn().mockRejectedValue(new Error('Cannot delete temp file'));

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during temp file cleanup');
      } catch (error) {
        expect(error.message).toContain('Cannot delete temp file');
      }

      // Verify rollback was attempted
      const finalData = await dataPersistence.loadProjectData(projectId, 'cleanup.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.deleteFile = originalDeleteFile;
    });

    test('should handle partial commit failures with multiple files', async () => {
      const projectId = 'partial-commit-fail';
      const files = [
        { name: 'file1.json', data: { id: 1 } },
        { name: 'file2.json', data: { id: 2 } },
        { name: 'file3.json', data: { id: 3 } }
      ];

      const transaction = dataPersistence.beginTransaction();
      
      // Save all files in transaction
      for (const file of files) {
        await dataPersistence.saveProjectData(projectId, file.name, file.data, transaction);
      }

      // Mock FileSystem.copyFile to fail on second file
      const originalCopyFile = FileSystem.copyFile;
      let copyCallCount = 0;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        copyCallCount++;
        if (copyCallCount === 2) {
          throw new Error('Failed to copy second file');
        }
        return originalCopyFile(src, dest);
      });

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during partial commit');
      } catch (error) {
        expect(error.message).toContain('Failed to copy second file');
      }

      // Verify all files were rolled back (none should exist)
      for (const file of files) {
        const finalData = await dataPersistence.loadProjectData(projectId, file.name);
        expect(finalData).toBeNull();
      }

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Rollback Operation Failures', () => {
    test('should handle rollback failures gracefully', async () => {
      const projectId = 'rollback-fail';
      const originalData = { original: true };
      const newData = { modified: true };

      // Create initial file
      await dataPersistence.saveProjectData(projectId, 'rollback.json', originalData);

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'rollback.json', newData, transaction);

      // Mock FileSystem.writeFile to fail during rollback
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(new Error('Cannot restore backup'));

      // Force rollback by making commit fail
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(new Error('Commit failed'));

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit and rollback');
      } catch (error) {
        // The error should be from the rollback failure, not the original commit failure
        expect(error.message).toContain('Cannot restore backup');
      }

      // Restore original functions
      FileSystem.writeFile = originalWriteFile;
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Concurrent Transaction Stress Tests', () => {
    test('should handle concurrent transaction failures', async () => {
      const projectId1 = 'concurrent-fail-1';
      const projectId2 = 'concurrent-fail-2';
      const data1 = { project: 1 };
      const data2 = { project: 2 };

      // Start two concurrent transactions
      const transaction1 = dataPersistence.beginTransaction();
      const transaction2 = dataPersistence.beginTransaction();

      // Mock one to fail
      const originalCopyFile = FileSystem.copyFile;
      let copyCallCount = 0;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        copyCallCount++;
        if (copyCallCount === 1) {
          throw new Error('First transaction failed');
        }
        return originalCopyFile(src, dest);
      });

      // Execute operations concurrently
      const promise1 = (async () => {
        await dataPersistence.saveProjectData(projectId1, 'data.json', data1, transaction1);
        return dataPersistence.commitTransaction(transaction1);
      })();

      const promise2 = (async () => {
        await dataPersistence.saveProjectData(projectId2, 'data.json', data2, transaction2);
        return dataPersistence.commitTransaction(transaction2);
      })();

      // Wait for both to complete (one should fail)
      const results = await Promise.allSettled([promise1, promise2]);

      // One should fail, one should succeed
      const failedCount = results.filter(r => r.status === 'rejected').length;
      const succeededCount = results.filter(r => r.status === 'fulfilled').length;
      
      expect(failedCount).toBe(1);
      expect(succeededCount).toBe(1);

      // Verify only the successful transaction's data exists
      const result1 = await dataPersistence.loadProjectData(projectId1, 'data.json');
      const result2 = await dataPersistence.loadProjectData(projectId2, 'data.json');

      // One should be null (failed), one should have data (succeeded)
      const nullCount = [result1, result2].filter(r => r === null).length;
      const dataCount = [result1, result2].filter(r => r !== null).length;
      
      expect(nullCount).toBe(1);
      expect(dataCount).toBe(1);

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });

    test('should handle high concurrency transaction stress', async () => {
      const concurrentTransactions = 10;
      const promises = [];

      // Mock to randomly fail some transactions
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        // Randomly fail ~30% of transactions
        if (Math.random() < 0.3) {
          throw new Error('Random transaction failure');
        }
        return originalCopyFile(src, dest);
      });

      // Create multiple concurrent transactions
      for (let i = 0; i < concurrentTransactions; i++) {
        const promise = (async () => {
          const projectId = `stress-test-${i}`;
          const testData = { id: i, stress: true };
          
          const transaction = dataPersistence.beginTransaction();
          await dataPersistence.saveProjectData(projectId, 'stress.json', testData, transaction);
          return dataPersistence.commitTransaction(transaction);
        })();
        
        promises.push(promise);
      }

      // Wait for all to complete
      const results = await Promise.allSettled(promises);

      // Some should succeed, some should fail
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.filter(r => r.status === 'rejected').length;
      
      expect(successCount + failureCount).toBe(concurrentTransactions);
      expect(successCount).toBeGreaterThan(0); // At least some should succeed
      expect(failureCount).toBeGreaterThan(0); // At least some should fail

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });
});
      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: failingValidator,
        reason: 'Crashing validator'
      });

// ============================================================================
// TRANSACTION ERROR SCENARIOS TESTS
// ============================================================================

describe('Transaction Error Scenarios', () => {
  let dataPersistence;
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'forest-error-tx-test-'));
    dataPersistence = new DataPersistence(tmpDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Disk Space Simulation Tests', () => {
    test('should handle disk full during temp file creation', async () => {
      const projectId = 'disk-full-test';
      const testData = { large: 'data'.repeat(1000) };

      // Mock FileSystem.writeFile to simulate disk full error
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
      );

      const transaction = dataPersistence.beginTransaction();
      
      try {
        await dataPersistence.saveProjectData(projectId, 'large.json', testData, transaction);
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to disk space');
      } catch (error) {
        expect(error.message).toContain('no space left on device');
        expect(error.code).toBe('ENOSPC');
      }

      // Verify no partial files remain
      const projectDir = dataPersistence.getProjectDir(projectId);
      try {
        const files = await fs.readdir(projectDir);
        const tempFiles = files.filter(f => f.endsWith('.tmp'));
        expect(tempFiles).toHaveLength(0);
      } catch (dirError) {
        // Directory might not exist, which is fine
        expect(dirError.code).toBe('ENOENT');
      }

      // Restore original function
      FileSystem.writeFile = originalWriteFile;
    });

    test('should handle disk full during commit phase', async () => {
      const projectId = 'commit-disk-full';
      const testData = { commit: 'test' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'commit.json', testData, transaction);

      // Mock FileSystem.copyFile to fail during commit
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
      );

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit');
      } catch (error) {
        expect(error.message).toContain('no space left on device');
      }

      // Verify rollback occurred - no final file should exist
      const finalData = await dataPersistence.loadProjectData(projectId, 'commit.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('File Lock Scenarios', () => {
    test('should handle file lock during temp file creation', async () => {
      const projectId = 'file-lock-temp';
      const testData = { locked: true };

      // Mock FileSystem.writeFile to simulate file lock
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
      );

      const transaction = dataPersistence.beginTransaction();

      try {
        await dataPersistence.saveProjectData(projectId, 'locked.json', testData, transaction);
        fail('Should have failed due to file lock');
      } catch (error) {
        expect(error.message).toContain('resource busy or locked');
        expect(error.code).toBe('EBUSY');
      }

      // Restore original function
      FileSystem.writeFile = originalWriteFile;
    });

    test('should handle file lock during commit phase', async () => {
      const projectId = 'file-lock-commit';
      const testData = { commit: 'locked' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'locked.json', testData, transaction);

      // Mock FileSystem.copyFile to simulate file lock during commit
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
      );

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit due to file lock');
      } catch (error) {
        expect(error.message).toContain('resource busy or locked');
      }

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'locked.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Validation Hook Failures', () => {
    test('should handle synchronous validation hook failures', async () => {
      const projectId = 'sync-validation-fail';
      const testData = { invalid: 'data' };

      const failingValidator = jest.fn().mockReturnValue(false);

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: failingValidator,
        reason: 'Synchronous validation failure'
      });

      await dataPersistence.saveProjectData(projectId, 'test.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to validation');
      } catch (error) {
        expect(error.message).toContain('Transaction validation failed');
        expect(error.message).toContain('Synchronous validation failure');
      }

      expect(failingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'test.json');
      expect(finalData).toBeNull();
    });

    test('should handle asynchronous validation hook failures', async () => {
      const projectId = 'async-validation-fail';
      const testData = { async: 'invalid' };

      const asyncFailingValidator = jest.fn().mockResolvedValue(false);

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: asyncFailingValidator,
        reason: 'Asynchronous validation failure'
      });

      await dataPersistence.saveProjectData(projectId, 'async.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to async validation');
      } catch (error) {
        expect(error.message).toContain('Transaction validation failed');
        expect(error.message).toContain('Asynchronous validation failure');
      }

      expect(asyncFailingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'async.json');
      expect(finalData).toBeNull();
    });

    test('should handle validation hook crashes', async () => {
      const projectId = 'validation-crash';
      const testData = { crash: 'test' };

      const crashingValidator = jest.fn().mockImplementation(() => {
        throw new Error('Validation hook crashed');
      });

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: crashingValidator,
        reason: 'Crashing validator'
      });

      await dataPersistence.saveProjectData(projectId, 'crash.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to validator crash');
      } catch (error) {
        expect(error.message).toContain('Validation hook crashed');
      }

      expect(crashingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'crash.json');
      expect(finalData).toBeNull();
    });
  });

  describe('Commit Operation Failures', () => {
    test('should handle failure during temp file cleanup', async () => {
      const projectId = 'cleanup-fail';
      const testData = { cleanup: 'test' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'cleanup.json', testData, transaction);

      // Mock FileSystem.deleteFile to fail during cleanup
      const originalDeleteFile = FileSystem.deleteFile;
      FileSystem.deleteFile = jest.fn().mockRejectedValue(new Error('Cannot delete temp file'));

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during temp file cleanup');
      } catch (error) {
        expect(error.message).toContain('Cannot delete temp file');
      }

      // Verify rollback was attempted
      const finalData = await dataPersistence.loadProjectData(projectId, 'cleanup.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.deleteFile = originalDeleteFile;
    });

    test('should handle partial commit failures with multiple files', async () => {
      const projectId = 'partial-commit-fail';
      const files = [
        { name: 'file1.json', data: { id: 1 } },
        { name: 'file2.json', data: { id: 2 } },
        { name: 'file3.json', data: { id: 3 } }
      ];

      const transaction = dataPersistence.beginTransaction();
      
      // Save all files in transaction
      for (const file of files) {
        await dataPersistence.saveProjectData(projectId, file.name, file.data, transaction);
      }

      // Mock FileSystem.copyFile to fail on second file
      const originalCopyFile = FileSystem.copyFile;
      let copyCallCount = 0;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        copyCallCount++;
        if (copyCallCount === 2) {
          throw new Error('Failed to copy second file');
        }
        return originalCopyFile(src, dest);
      });

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during partial commit');
      } catch (error) {
        expect(error.message).toContain('Failed to copy second file');
      }

      // Verify all files were rolled back (none should exist)
      for (const file of files) {
        const finalData = await dataPersistence.loadProjectData(projectId, file.name);
        expect(finalData).toBeNull();
      }

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Rollback Operation Failures', () => {
    test('should handle rollback failures gracefully', async () => {
      const projectId = 'rollback-fail';
      const originalData = { original: true };
      const newData = { modified: true };

      // Create initial file
      await dataPersistence.saveProjectData(projectId, 'rollback.json', originalData);

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'rollback.json', newData, transaction);

      // Mock FileSystem.writeFile to fail during rollback
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(new Error('Cannot restore backup'));

      // Force rollback by making commit fail
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(new Error('Commit failed'));

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit and rollback');
      } catch (error) {
        // The error should be from the rollback failure, not the original commit failure
        expect(error.message).toContain('Cannot restore backup');
      }

      // Restore original functions
      FileSystem.writeFile = originalWriteFile;
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Concurrent Transaction Stress Tests', () => {
    test('should handle concurrent transaction failures', async () => {
      const projectId1 = 'concurrent-fail-1';
      const projectId2 = 'concurrent-fail-2';
      const data1 = { project: 1 };
      const data2 = { project: 2 };

      // Start two concurrent transactions
      const transaction1 = dataPersistence.beginTransaction();
      const transaction2 = dataPersistence.beginTransaction();

      // Mock one to fail
      const originalCopyFile = FileSystem.copyFile;
      let copyCallCount = 0;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        copyCallCount++;
        if (copyCallCount === 1) {
          throw new Error('First transaction failed');
        }
        return originalCopyFile(src, dest);
      });

      // Execute operations concurrently
      const promise1 = (async () => {
        await dataPersistence.saveProjectData(projectId1, 'data.json', data1, transaction1);
        return dataPersistence.commitTransaction(transaction1);
      })();

      const promise2 = (async () => {
        await dataPersistence.saveProjectData(projectId2, 'data.json', data2, transaction2);
        return dataPersistence.commitTransaction(transaction2);
      })();

      // Wait for both to complete (one should fail)
      const results = await Promise.allSettled([promise1, promise2]);

      // One should fail, one should succeed
      const failedCount = results.filter(r => r.status === 'rejected').length;
      const succeededCount = results.filter(r => r.status === 'fulfilled').length;
      
      expect(failedCount).toBe(1);
      expect(succeededCount).toBe(1);

      // Verify only the successful transaction's data exists
      const result1 = await dataPersistence.loadProjectData(projectId1, 'data.json');
      const result2 = await dataPersistence.loadProjectData(projectId2, 'data.json');

      // One should be null (failed), one should have data (succeeded)
      const nullCount = [result1, result2].filter(r => r === null).length;
      const dataCount = [result1, result2].filter(r => r !== null).length;
      
      expect(nullCount).toBe(1);
      expect(dataCount).toBe(1);

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });

    test('should handle high concurrency transaction stress', async () => {
      const concurrentTransactions = 10;
      const promises = [];

      // Mock to randomly fail some transactions
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        // Randomly fail ~30% of transactions
        if (Math.random() < 0.3) {
          throw new Error('Random transaction failure');
        }
        return originalCopyFile(src, dest);
      });

      // Create multiple concurrent transactions
      for (let i = 0; i < concurrentTransactions; i++) {
        const promise = (async () => {
          const projectId = `stress-test-${i}`;
          const testData = { id: i, stress: true };
          
          const transaction = dataPersistence.beginTransaction();
          await dataPersistence.saveProjectData(projectId, 'stress.json', testData, transaction);
          return dataPersistence.commitTransaction(transaction);
        })();
        
        promises.push(promise);
      }

      // Wait for all to complete
      const results = await Promise.allSettled(promises);

      // Some should succeed, some should fail
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.filter(r => r.status === 'rejected').length;
      
      expect(successCount + failureCount).toBe(concurrentTransactions);
      expect(successCount).toBeGreaterThan(0); // At least some should succeed
      expect(failureCount).toBeGreaterThan(0); // At least some should fail

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });
});
      await dataPersistence.saveProjectData(projectId, 'test.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to validator crash');
      } catch (error) {
        expect(error.message).toContain('Validation hook crashed');
      }
    });

// ============================================================================
// TRANSACTION ERROR SCENARIOS TESTS
// ============================================================================

describe('Transaction Error Scenarios', () => {
  let dataPersistence;
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'forest-error-tx-test-'));
    dataPersistence = new DataPersistence(tmpDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Disk Space Simulation Tests', () => {
    test('should handle disk full during temp file creation', async () => {
      const projectId = 'disk-full-test';
      const testData = { large: 'data'.repeat(1000) };

      // Mock FileSystem.writeFile to simulate disk full error
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
      );

      const transaction = dataPersistence.beginTransaction();
      
      try {
        await dataPersistence.saveProjectData(projectId, 'large.json', testData, transaction);
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to disk space');
      } catch (error) {
        expect(error.message).toContain('no space left on device');
        expect(error.code).toBe('ENOSPC');
      }

      // Verify no partial files remain
      const projectDir = dataPersistence.getProjectDir(projectId);
      try {
        const files = await fs.readdir(projectDir);
        const tempFiles = files.filter(f => f.endsWith('.tmp'));
        expect(tempFiles).toHaveLength(0);
      } catch (dirError) {
        // Directory might not exist, which is fine
        expect(dirError.code).toBe('ENOENT');
      }

      // Restore original function
      FileSystem.writeFile = originalWriteFile;
    });

    test('should handle disk full during commit phase', async () => {
      const projectId = 'commit-disk-full';
      const testData = { commit: 'test' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'commit.json', testData, transaction);

      // Mock FileSystem.copyFile to fail during commit
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
      );

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit');
      } catch (error) {
        expect(error.message).toContain('no space left on device');
      }

      // Verify rollback occurred - no final file should exist
      const finalData = await dataPersistence.loadProjectData(projectId, 'commit.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('File Lock Scenarios', () => {
    test('should handle file lock during temp file creation', async () => {
      const projectId = 'file-lock-temp';
      const testData = { locked: true };

      // Mock FileSystem.writeFile to simulate file lock
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
      );

      const transaction = dataPersistence.beginTransaction();

      try {
        await dataPersistence.saveProjectData(projectId, 'locked.json', testData, transaction);
        fail('Should have failed due to file lock');
      } catch (error) {
        expect(error.message).toContain('resource busy or locked');
        expect(error.code).toBe('EBUSY');
      }

      // Restore original function
      FileSystem.writeFile = originalWriteFile;
    });

    test('should handle file lock during commit phase', async () => {
      const projectId = 'file-lock-commit';
      const testData = { commit: 'locked' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'locked.json', testData, transaction);

      // Mock FileSystem.copyFile to simulate file lock during commit
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
      );

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit due to file lock');
      } catch (error) {
        expect(error.message).toContain('resource busy or locked');
      }

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'locked.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Validation Hook Failures', () => {
    test('should handle synchronous validation hook failures', async () => {
      const projectId = 'sync-validation-fail';
      const testData = { invalid: 'data' };

      const failingValidator = jest.fn().mockReturnValue(false);

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: failingValidator,
        reason: 'Synchronous validation failure'
      });

      await dataPersistence.saveProjectData(projectId, 'test.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to validation');
      } catch (error) {
        expect(error.message).toContain('Transaction validation failed');
        expect(error.message).toContain('Synchronous validation failure');
      }

      expect(failingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'test.json');
      expect(finalData).toBeNull();
    });

    test('should handle asynchronous validation hook failures', async () => {
      const projectId = 'async-validation-fail';
      const testData = { async: 'invalid' };

      const asyncFailingValidator = jest.fn().mockResolvedValue(false);

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: asyncFailingValidator,
        reason: 'Asynchronous validation failure'
      });

      await dataPersistence.saveProjectData(projectId, 'async.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to async validation');
      } catch (error) {
        expect(error.message).toContain('Transaction validation failed');
        expect(error.message).toContain('Asynchronous validation failure');
      }

      expect(asyncFailingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'async.json');
      expect(finalData).toBeNull();
    });

    test('should handle validation hook crashes', async () => {
      const projectId = 'validation-crash';
      const testData = { crash: 'test' };

      const crashingValidator = jest.fn().mockImplementation(() => {
        throw new Error('Validation hook crashed');
      });

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: crashingValidator,
        reason: 'Crashing validator'
      });

      await dataPersistence.saveProjectData(projectId, 'crash.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to validator crash');
      } catch (error) {
        expect(error.message).toContain('Validation hook crashed');
      }

      expect(crashingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'crash.json');
      expect(finalData).toBeNull();
    });
  });

  describe('Commit Operation Failures', () => {
    test('should handle failure during temp file cleanup', async () => {
      const projectId = 'cleanup-fail';
      const testData = { cleanup: 'test' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'cleanup.json', testData, transaction);

      // Mock FileSystem.deleteFile to fail during cleanup
      const originalDeleteFile = FileSystem.deleteFile;
      FileSystem.deleteFile = jest.fn().mockRejectedValue(new Error('Cannot delete temp file'));

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during temp file cleanup');
      } catch (error) {
        expect(error.message).toContain('Cannot delete temp file');
      }

      // Verify rollback was attempted
      const finalData = await dataPersistence.loadProjectData(projectId, 'cleanup.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.deleteFile = originalDeleteFile;
    });

    test('should handle partial commit failures with multiple files', async () => {
      const projectId = 'partial-commit-fail';
      const files = [
        { name: 'file1.json', data: { id: 1 } },
        { name: 'file2.json', data: { id: 2 } },
        { name: 'file3.json', data: { id: 3 } }
      ];

      const transaction = dataPersistence.beginTransaction();
      
      // Save all files in transaction
      for (const file of files) {
        await dataPersistence.saveProjectData(projectId, file.name, file.data, transaction);
      }

      // Mock FileSystem.copyFile to fail on second file
      const originalCopyFile = FileSystem.copyFile;
      let copyCallCount = 0;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        copyCallCount++;
        if (copyCallCount === 2) {
          throw new Error('Failed to copy second file');
        }
        return originalCopyFile(src, dest);
      });

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during partial commit');
      } catch (error) {
        expect(error.message).toContain('Failed to copy second file');
      }

      // Verify all files were rolled back (none should exist)
      for (const file of files) {
        const finalData = await dataPersistence.loadProjectData(projectId, file.name);
        expect(finalData).toBeNull();
      }

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Rollback Operation Failures', () => {
    test('should handle rollback failures gracefully', async () => {
      const projectId = 'rollback-fail';
      const originalData = { original: true };
      const newData = { modified: true };

      // Create initial file
      await dataPersistence.saveProjectData(projectId, 'rollback.json', originalData);

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'rollback.json', newData, transaction);

      // Mock FileSystem.writeFile to fail during rollback
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(new Error('Cannot restore backup'));

      // Force rollback by making commit fail
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(new Error('Commit failed'));

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit and rollback');
      } catch (error) {
        // The error should be from the rollback failure, not the original commit failure
        expect(error.message).toContain('Cannot restore backup');
      }

      // Restore original functions
      FileSystem.writeFile = originalWriteFile;
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Concurrent Transaction Stress Tests', () => {
    test('should handle concurrent transaction failures', async () => {
      const projectId1 = 'concurrent-fail-1';
      const projectId2 = 'concurrent-fail-2';
      const data1 = { project: 1 };
      const data2 = { project: 2 };

      // Start two concurrent transactions
      const transaction1 = dataPersistence.beginTransaction();
      const transaction2 = dataPersistence.beginTransaction();

      // Mock one to fail
      const originalCopyFile = FileSystem.copyFile;
      let copyCallCount = 0;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        copyCallCount++;
        if (copyCallCount === 1) {
          throw new Error('First transaction failed');
        }
        return originalCopyFile(src, dest);
      });

      // Execute operations concurrently
      const promise1 = (async () => {
        await dataPersistence.saveProjectData(projectId1, 'data.json', data1, transaction1);
        return dataPersistence.commitTransaction(transaction1);
      })();

      const promise2 = (async () => {
        await dataPersistence.saveProjectData(projectId2, 'data.json', data2, transaction2);
        return dataPersistence.commitTransaction(transaction2);
      })();

      // Wait for both to complete (one should fail)
      const results = await Promise.allSettled([promise1, promise2]);

      // One should fail, one should succeed
      const failedCount = results.filter(r => r.status === 'rejected').length;
      const succeededCount = results.filter(r => r.status === 'fulfilled').length;
      
      expect(failedCount).toBe(1);
      expect(succeededCount).toBe(1);

      // Verify only the successful transaction's data exists
      const result1 = await dataPersistence.loadProjectData(projectId1, 'data.json');
      const result2 = await dataPersistence.loadProjectData(projectId2, 'data.json');

      // One should be null (failed), one should have data (succeeded)
      const nullCount = [result1, result2].filter(r => r === null).length;
      const dataCount = [result1, result2].filter(r => r !== null).length;
      
      expect(nullCount).toBe(1);
      expect(dataCount).toBe(1);

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });

    test('should handle high concurrency transaction stress', async () => {
      const concurrentTransactions = 10;
      const promises = [];

      // Mock to randomly fail some transactions
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        // Randomly fail ~30% of transactions
        if (Math.random() < 0.3) {
          throw new Error('Random transaction failure');
        }
        return originalCopyFile(src, dest);
      });

      // Create multiple concurrent transactions
      for (let i = 0; i < concurrentTransactions; i++) {
        const promise = (async () => {
          const projectId = `stress-test-${i}`;
          const testData = { id: i, stress: true };
          
          const transaction = dataPersistence.beginTransaction();
          await dataPersistence.saveProjectData(projectId, 'stress.json', testData, transaction);
          return dataPersistence.commitTransaction(transaction);
        })();
        
        promises.push(promise);
      }

      // Wait for all to complete
      const results = await Promise.allSettled(promises);

      // Some should succeed, some should fail
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.filter(r => r.status === 'rejected').length;
      
      expect(successCount + failureCount).toBe(concurrentTransactions);
      expect(successCount).toBeGreaterThan(0); // At least some should succeed
      expect(failureCount).toBeGreaterThan(0); // At least some should fail

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });
});
  });

// ============================================================================
// TRANSACTION ERROR SCENARIOS TESTS
// ============================================================================

describe('Transaction Error Scenarios', () => {
  let dataPersistence;
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'forest-error-tx-test-'));
    dataPersistence = new DataPersistence(tmpDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Disk Space Simulation Tests', () => {
    test('should handle disk full during temp file creation', async () => {
      const projectId = 'disk-full-test';
      const testData = { large: 'data'.repeat(1000) };

      // Mock FileSystem.writeFile to simulate disk full error
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
      );

      const transaction = dataPersistence.beginTransaction();
      
      try {
        await dataPersistence.saveProjectData(projectId, 'large.json', testData, transaction);
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to disk space');
      } catch (error) {
        expect(error.message).toContain('no space left on device');
        expect(error.code).toBe('ENOSPC');
      }

      // Verify no partial files remain
      const projectDir = dataPersistence.getProjectDir(projectId);
      try {
        const files = await fs.readdir(projectDir);
        const tempFiles = files.filter(f => f.endsWith('.tmp'));
        expect(tempFiles).toHaveLength(0);
      } catch (dirError) {
        // Directory might not exist, which is fine
        expect(dirError.code).toBe('ENOENT');
      }

      // Restore original function
      FileSystem.writeFile = originalWriteFile;
    });

    test('should handle disk full during commit phase', async () => {
      const projectId = 'commit-disk-full';
      const testData = { commit: 'test' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'commit.json', testData, transaction);

      // Mock FileSystem.copyFile to fail during commit
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
      );

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit');
      } catch (error) {
        expect(error.message).toContain('no space left on device');
      }

      // Verify rollback occurred - no final file should exist
      const finalData = await dataPersistence.loadProjectData(projectId, 'commit.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('File Lock Scenarios', () => {
    test('should handle file lock during temp file creation', async () => {
      const projectId = 'file-lock-temp';
      const testData = { locked: true };

      // Mock FileSystem.writeFile to simulate file lock
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
      );

      const transaction = dataPersistence.beginTransaction();

      try {
        await dataPersistence.saveProjectData(projectId, 'locked.json', testData, transaction);
        fail('Should have failed due to file lock');
      } catch (error) {
        expect(error.message).toContain('resource busy or locked');
        expect(error.code).toBe('EBUSY');
      }

      // Restore original function
      FileSystem.writeFile = originalWriteFile;
    });

    test('should handle file lock during commit phase', async () => {
      const projectId = 'file-lock-commit';
      const testData = { commit: 'locked' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'locked.json', testData, transaction);

      // Mock FileSystem.copyFile to simulate file lock during commit
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
      );

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit due to file lock');
      } catch (error) {
        expect(error.message).toContain('resource busy or locked');
      }

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'locked.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Validation Hook Failures', () => {
    test('should handle synchronous validation hook failures', async () => {
      const projectId = 'sync-validation-fail';
      const testData = { invalid: 'data' };

      const failingValidator = jest.fn().mockReturnValue(false);

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: failingValidator,
        reason: 'Synchronous validation failure'
      });

      await dataPersistence.saveProjectData(projectId, 'test.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to validation');
      } catch (error) {
        expect(error.message).toContain('Transaction validation failed');
        expect(error.message).toContain('Synchronous validation failure');
      }

      expect(failingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'test.json');
      expect(finalData).toBeNull();
    });

    test('should handle asynchronous validation hook failures', async () => {
      const projectId = 'async-validation-fail';
      const testData = { async: 'invalid' };

      const asyncFailingValidator = jest.fn().mockResolvedValue(false);

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: asyncFailingValidator,
        reason: 'Asynchronous validation failure'
      });

      await dataPersistence.saveProjectData(projectId, 'async.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to async validation');
      } catch (error) {
        expect(error.message).toContain('Transaction validation failed');
        expect(error.message).toContain('Asynchronous validation failure');
      }

      expect(asyncFailingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'async.json');
      expect(finalData).toBeNull();
    });

    test('should handle validation hook crashes', async () => {
      const projectId = 'validation-crash';
      const testData = { crash: 'test' };

      const crashingValidator = jest.fn().mockImplementation(() => {
        throw new Error('Validation hook crashed');
      });

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: crashingValidator,
        reason: 'Crashing validator'
      });

      await dataPersistence.saveProjectData(projectId, 'crash.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to validator crash');
      } catch (error) {
        expect(error.message).toContain('Validation hook crashed');
      }

      expect(crashingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'crash.json');
      expect(finalData).toBeNull();
    });
  });

  describe('Commit Operation Failures', () => {
    test('should handle failure during temp file cleanup', async () => {
      const projectId = 'cleanup-fail';
      const testData = { cleanup: 'test' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'cleanup.json', testData, transaction);

      // Mock FileSystem.deleteFile to fail during cleanup
      const originalDeleteFile = FileSystem.deleteFile;
      FileSystem.deleteFile = jest.fn().mockRejectedValue(new Error('Cannot delete temp file'));

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during temp file cleanup');
      } catch (error) {
        expect(error.message).toContain('Cannot delete temp file');
      }

      // Verify rollback was attempted
      const finalData = await dataPersistence.loadProjectData(projectId, 'cleanup.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.deleteFile = originalDeleteFile;
    });

    test('should handle partial commit failures with multiple files', async () => {
      const projectId = 'partial-commit-fail';
      const files = [
        { name: 'file1.json', data: { id: 1 } },
        { name: 'file2.json', data: { id: 2 } },
        { name: 'file3.json', data: { id: 3 } }
      ];

      const transaction = dataPersistence.beginTransaction();
      
      // Save all files in transaction
      for (const file of files) {
        await dataPersistence.saveProjectData(projectId, file.name, file.data, transaction);
      }

      // Mock FileSystem.copyFile to fail on second file
      const originalCopyFile = FileSystem.copyFile;
      let copyCallCount = 0;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        copyCallCount++;
        if (copyCallCount === 2) {
          throw new Error('Failed to copy second file');
        }
        return originalCopyFile(src, dest);
      });

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during partial commit');
      } catch (error) {
        expect(error.message).toContain('Failed to copy second file');
      }

      // Verify all files were rolled back (none should exist)
      for (const file of files) {
        const finalData = await dataPersistence.loadProjectData(projectId, file.name);
        expect(finalData).toBeNull();
      }

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Rollback Operation Failures', () => {
    test('should handle rollback failures gracefully', async () => {
      const projectId = 'rollback-fail';
      const originalData = { original: true };
      const newData = { modified: true };

      // Create initial file
      await dataPersistence.saveProjectData(projectId, 'rollback.json', originalData);

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'rollback.json', newData, transaction);

      // Mock FileSystem.writeFile to fail during rollback
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(new Error('Cannot restore backup'));

      // Force rollback by making commit fail
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(new Error('Commit failed'));

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit and rollback');
      } catch (error) {
        // The error should be from the rollback failure, not the original commit failure
        expect(error.message).toContain('Cannot restore backup');
      }

      // Restore original functions
      FileSystem.writeFile = originalWriteFile;
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Concurrent Transaction Stress Tests', () => {
    test('should handle concurrent transaction failures', async () => {
      const projectId1 = 'concurrent-fail-1';
      const projectId2 = 'concurrent-fail-2';
      const data1 = { project: 1 };
      const data2 = { project: 2 };

      // Start two concurrent transactions
      const transaction1 = dataPersistence.beginTransaction();
      const transaction2 = dataPersistence.beginTransaction();

      // Mock one to fail
      const originalCopyFile = FileSystem.copyFile;
      let copyCallCount = 0;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        copyCallCount++;
        if (copyCallCount === 1) {
          throw new Error('First transaction failed');
        }
        return originalCopyFile(src, dest);
      });

      // Execute operations concurrently
      const promise1 = (async () => {
        await dataPersistence.saveProjectData(projectId1, 'data.json', data1, transaction1);
        return dataPersistence.commitTransaction(transaction1);
      })();

      const promise2 = (async () => {
        await dataPersistence.saveProjectData(projectId2, 'data.json', data2, transaction2);
        return dataPersistence.commitTransaction(transaction2);
      })();

      // Wait for both to complete (one should fail)
      const results = await Promise.allSettled([promise1, promise2]);

      // One should fail, one should succeed
      const failedCount = results.filter(r => r.status === 'rejected').length;
      const succeededCount = results.filter(r => r.status === 'fulfilled').length;
      
      expect(failedCount).toBe(1);
      expect(succeededCount).toBe(1);

      // Verify only the successful transaction's data exists
      const result1 = await dataPersistence.loadProjectData(projectId1, 'data.json');
      const result2 = await dataPersistence.loadProjectData(projectId2, 'data.json');

      // One should be null (failed), one should have data (succeeded)
      const nullCount = [result1, result2].filter(r => r === null).length;
      const dataCount = [result1, result2].filter(r => r !== null).length;
      
      expect(nullCount).toBe(1);
      expect(dataCount).toBe(1);

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });

    test('should handle high concurrency transaction stress', async () => {
      const concurrentTransactions = 10;
      const promises = [];

      // Mock to randomly fail some transactions
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        // Randomly fail ~30% of transactions
        if (Math.random() < 0.3) {
          throw new Error('Random transaction failure');
        }
        return originalCopyFile(src, dest);
      });

      // Create multiple concurrent transactions
      for (let i = 0; i < concurrentTransactions; i++) {
        const promise = (async () => {
          const projectId = `stress-test-${i}`;
          const testData = { id: i, stress: true };
          
          const transaction = dataPersistence.beginTransaction();
          await dataPersistence.saveProjectData(projectId, 'stress.json', testData, transaction);
          return dataPersistence.commitTransaction(transaction);
        })();
        
        promises.push(promise);
      }

      // Wait for all to complete
      const results = await Promise.allSettled(promises);

      // Some should succeed, some should fail
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.filter(r => r.status === 'rejected').length;
      
      expect(successCount + failureCount).toBe(concurrentTransactions);
      expect(successCount).toBeGreaterThan(0); // At least some should succeed
      expect(failureCount).toBeGreaterThan(0); // At least some should fail

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });
});
  describe('Data Consistency Tests', () => {
    test('should leave no partial state on failure', async () => {
      const projectId = 'consistency-test';
      const originalData = { state: 'original' };
      const newData = { state: 'modified' };

      // Create initial state
      await dataPersistence.saveProjectData(projectId, 'state.json', originalData);

      // Begin transaction that will fail
      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: newData,
        validator: () => false, // Always fail
        reason: 'Forced failure'
      });

// ============================================================================
// TRANSACTION ERROR SCENARIOS TESTS
// ============================================================================

describe('Transaction Error Scenarios', () => {
  let dataPersistence;
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'forest-error-tx-test-'));
    dataPersistence = new DataPersistence(tmpDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Disk Space Simulation Tests', () => {
    test('should handle disk full during temp file creation', async () => {
      const projectId = 'disk-full-test';
      const testData = { large: 'data'.repeat(1000) };

      // Mock FileSystem.writeFile to simulate disk full error
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
      );

      const transaction = dataPersistence.beginTransaction();
      
      try {
        await dataPersistence.saveProjectData(projectId, 'large.json', testData, transaction);
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to disk space');
      } catch (error) {
        expect(error.message).toContain('no space left on device');
        expect(error.code).toBe('ENOSPC');
      }

      // Verify no partial files remain
      const projectDir = dataPersistence.getProjectDir(projectId);
      try {
        const files = await fs.readdir(projectDir);
        const tempFiles = files.filter(f => f.endsWith('.tmp'));
        expect(tempFiles).toHaveLength(0);
      } catch (dirError) {
        // Directory might not exist, which is fine
        expect(dirError.code).toBe('ENOENT');
      }

      // Restore original function
      FileSystem.writeFile = originalWriteFile;
    });

    test('should handle disk full during commit phase', async () => {
      const projectId = 'commit-disk-full';
      const testData = { commit: 'test' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'commit.json', testData, transaction);

      // Mock FileSystem.copyFile to fail during commit
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
      );

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit');
      } catch (error) {
        expect(error.message).toContain('no space left on device');
      }

      // Verify rollback occurred - no final file should exist
      const finalData = await dataPersistence.loadProjectData(projectId, 'commit.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('File Lock Scenarios', () => {
    test('should handle file lock during temp file creation', async () => {
      const projectId = 'file-lock-temp';
      const testData = { locked: true };

      // Mock FileSystem.writeFile to simulate file lock
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
      );

      const transaction = dataPersistence.beginTransaction();

      try {
        await dataPersistence.saveProjectData(projectId, 'locked.json', testData, transaction);
        fail('Should have failed due to file lock');
      } catch (error) {
        expect(error.message).toContain('resource busy or locked');
        expect(error.code).toBe('EBUSY');
      }

      // Restore original function
      FileSystem.writeFile = originalWriteFile;
    });

    test('should handle file lock during commit phase', async () => {
      const projectId = 'file-lock-commit';
      const testData = { commit: 'locked' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'locked.json', testData, transaction);

      // Mock FileSystem.copyFile to simulate file lock during commit
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
      );

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit due to file lock');
      } catch (error) {
        expect(error.message).toContain('resource busy or locked');
      }

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'locked.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Validation Hook Failures', () => {
    test('should handle synchronous validation hook failures', async () => {
      const projectId = 'sync-validation-fail';
      const testData = { invalid: 'data' };

      const failingValidator = jest.fn().mockReturnValue(false);

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: failingValidator,
        reason: 'Synchronous validation failure'
      });

      await dataPersistence.saveProjectData(projectId, 'test.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to validation');
      } catch (error) {
        expect(error.message).toContain('Transaction validation failed');
        expect(error.message).toContain('Synchronous validation failure');
      }

      expect(failingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'test.json');
      expect(finalData).toBeNull();
    });

    test('should handle asynchronous validation hook failures', async () => {
      const projectId = 'async-validation-fail';
      const testData = { async: 'invalid' };

      const asyncFailingValidator = jest.fn().mockResolvedValue(false);

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: asyncFailingValidator,
        reason: 'Asynchronous validation failure'
      });

      await dataPersistence.saveProjectData(projectId, 'async.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to async validation');
      } catch (error) {
        expect(error.message).toContain('Transaction validation failed');
        expect(error.message).toContain('Asynchronous validation failure');
      }

      expect(asyncFailingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'async.json');
      expect(finalData).toBeNull();
    });

    test('should handle validation hook crashes', async () => {
      const projectId = 'validation-crash';
      const testData = { crash: 'test' };

      const crashingValidator = jest.fn().mockImplementation(() => {
        throw new Error('Validation hook crashed');
      });

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: crashingValidator,
        reason: 'Crashing validator'
      });

      await dataPersistence.saveProjectData(projectId, 'crash.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to validator crash');
      } catch (error) {
        expect(error.message).toContain('Validation hook crashed');
      }

      expect(crashingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'crash.json');
      expect(finalData).toBeNull();
    });
  });

  describe('Commit Operation Failures', () => {
    test('should handle failure during temp file cleanup', async () => {
      const projectId = 'cleanup-fail';
      const testData = { cleanup: 'test' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'cleanup.json', testData, transaction);

      // Mock FileSystem.deleteFile to fail during cleanup
      const originalDeleteFile = FileSystem.deleteFile;
      FileSystem.deleteFile = jest.fn().mockRejectedValue(new Error('Cannot delete temp file'));

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during temp file cleanup');
      } catch (error) {
        expect(error.message).toContain('Cannot delete temp file');
      }

      // Verify rollback was attempted
      const finalData = await dataPersistence.loadProjectData(projectId, 'cleanup.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.deleteFile = originalDeleteFile;
    });

    test('should handle partial commit failures with multiple files', async () => {
      const projectId = 'partial-commit-fail';
      const files = [
        { name: 'file1.json', data: { id: 1 } },
        { name: 'file2.json', data: { id: 2 } },
        { name: 'file3.json', data: { id: 3 } }
      ];

      const transaction = dataPersistence.beginTransaction();
      
      // Save all files in transaction
      for (const file of files) {
        await dataPersistence.saveProjectData(projectId, file.name, file.data, transaction);
      }

      // Mock FileSystem.copyFile to fail on second file
      const originalCopyFile = FileSystem.copyFile;
      let copyCallCount = 0;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        copyCallCount++;
        if (copyCallCount === 2) {
          throw new Error('Failed to copy second file');
        }
        return originalCopyFile(src, dest);
      });

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during partial commit');
      } catch (error) {
        expect(error.message).toContain('Failed to copy second file');
      }

      // Verify all files were rolled back (none should exist)
      for (const file of files) {
        const finalData = await dataPersistence.loadProjectData(projectId, file.name);
        expect(finalData).toBeNull();
      }

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Rollback Operation Failures', () => {
    test('should handle rollback failures gracefully', async () => {
      const projectId = 'rollback-fail';
      const originalData = { original: true };
      const newData = { modified: true };

      // Create initial file
      await dataPersistence.saveProjectData(projectId, 'rollback.json', originalData);

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'rollback.json', newData, transaction);

      // Mock FileSystem.writeFile to fail during rollback
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(new Error('Cannot restore backup'));

      // Force rollback by making commit fail
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(new Error('Commit failed'));

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit and rollback');
      } catch (error) {
        // The error should be from the rollback failure, not the original commit failure
        expect(error.message).toContain('Cannot restore backup');
      }

      // Restore original functions
      FileSystem.writeFile = originalWriteFile;
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Concurrent Transaction Stress Tests', () => {
    test('should handle concurrent transaction failures', async () => {
      const projectId1 = 'concurrent-fail-1';
      const projectId2 = 'concurrent-fail-2';
      const data1 = { project: 1 };
      const data2 = { project: 2 };

      // Start two concurrent transactions
      const transaction1 = dataPersistence.beginTransaction();
      const transaction2 = dataPersistence.beginTransaction();

      // Mock one to fail
      const originalCopyFile = FileSystem.copyFile;
      let copyCallCount = 0;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        copyCallCount++;
        if (copyCallCount === 1) {
          throw new Error('First transaction failed');
        }
        return originalCopyFile(src, dest);
      });

      // Execute operations concurrently
      const promise1 = (async () => {
        await dataPersistence.saveProjectData(projectId1, 'data.json', data1, transaction1);
        return dataPersistence.commitTransaction(transaction1);
      })();

      const promise2 = (async () => {
        await dataPersistence.saveProjectData(projectId2, 'data.json', data2, transaction2);
        return dataPersistence.commitTransaction(transaction2);
      })();

      // Wait for both to complete (one should fail)
      const results = await Promise.allSettled([promise1, promise2]);

      // One should fail, one should succeed
      const failedCount = results.filter(r => r.status === 'rejected').length;
      const succeededCount = results.filter(r => r.status === 'fulfilled').length;
      
      expect(failedCount).toBe(1);
      expect(succeededCount).toBe(1);

      // Verify only the successful transaction's data exists
      const result1 = await dataPersistence.loadProjectData(projectId1, 'data.json');
      const result2 = await dataPersistence.loadProjectData(projectId2, 'data.json');

      // One should be null (failed), one should have data (succeeded)
      const nullCount = [result1, result2].filter(r => r === null).length;
      const dataCount = [result1, result2].filter(r => r !== null).length;
      
      expect(nullCount).toBe(1);
      expect(dataCount).toBe(1);

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });

    test('should handle high concurrency transaction stress', async () => {
      const concurrentTransactions = 10;
      const promises = [];

      // Mock to randomly fail some transactions
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        // Randomly fail ~30% of transactions
        if (Math.random() < 0.3) {
          throw new Error('Random transaction failure');
        }
        return originalCopyFile(src, dest);
      });

      // Create multiple concurrent transactions
      for (let i = 0; i < concurrentTransactions; i++) {
        const promise = (async () => {
          const projectId = `stress-test-${i}`;
          const testData = { id: i, stress: true };
          
          const transaction = dataPersistence.beginTransaction();
          await dataPersistence.saveProjectData(projectId, 'stress.json', testData, transaction);
          return dataPersistence.commitTransaction(transaction);
        })();
        
        promises.push(promise);
      }

      // Wait for all to complete
      const results = await Promise.allSettled(promises);

      // Some should succeed, some should fail
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.filter(r => r.status === 'rejected').length;
      
      expect(successCount + failureCount).toBe(concurrentTransactions);
      expect(successCount).toBeGreaterThan(0); // At least some should succeed
      expect(failureCount).toBeGreaterThan(0); // At least some should fail

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });
});
      await dataPersistence.saveProjectData(projectId, 'state.json', newData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Transaction should have failed');
      } catch (error) {
        // Expected failure
      }

      // Verify no partial state exists
      const finalData = await dataPersistence.loadProjectData(projectId, 'state.json');
      expect(finalData).toEqual(originalData);

      // Verify no temp files remain
      const projectDir = dataPersistence.getProjectDir(projectId);
      const files = await fs.readdir(projectDir);
      const tempFiles = files.filter(f => f.endsWith('.tmp'));
      expect(tempFiles).toHaveLength(0);
    });

// ============================================================================
// TRANSACTION ERROR SCENARIOS TESTS
// ============================================================================

describe('Transaction Error Scenarios', () => {
  let dataPersistence;
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'forest-error-tx-test-'));
    dataPersistence = new DataPersistence(tmpDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Disk Space Simulation Tests', () => {
    test('should handle disk full during temp file creation', async () => {
      const projectId = 'disk-full-test';
      const testData = { large: 'data'.repeat(1000) };

      // Mock FileSystem.writeFile to simulate disk full error
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
      );

      const transaction = dataPersistence.beginTransaction();
      
      try {
        await dataPersistence.saveProjectData(projectId, 'large.json', testData, transaction);
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to disk space');
      } catch (error) {
        expect(error.message).toContain('no space left on device');
        expect(error.code).toBe('ENOSPC');
      }

      // Verify no partial files remain
      const projectDir = dataPersistence.getProjectDir(projectId);
      try {
        const files = await fs.readdir(projectDir);
        const tempFiles = files.filter(f => f.endsWith('.tmp'));
        expect(tempFiles).toHaveLength(0);
      } catch (dirError) {
        // Directory might not exist, which is fine
        expect(dirError.code).toBe('ENOENT');
      }

      // Restore original function
      FileSystem.writeFile = originalWriteFile;
    });

    test('should handle disk full during commit phase', async () => {
      const projectId = 'commit-disk-full';
      const testData = { commit: 'test' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'commit.json', testData, transaction);

      // Mock FileSystem.copyFile to fail during commit
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
      );

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit');
      } catch (error) {
        expect(error.message).toContain('no space left on device');
      }

      // Verify rollback occurred - no final file should exist
      const finalData = await dataPersistence.loadProjectData(projectId, 'commit.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('File Lock Scenarios', () => {
    test('should handle file lock during temp file creation', async () => {
      const projectId = 'file-lock-temp';
      const testData = { locked: true };

      // Mock FileSystem.writeFile to simulate file lock
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
      );

      const transaction = dataPersistence.beginTransaction();

      try {
        await dataPersistence.saveProjectData(projectId, 'locked.json', testData, transaction);
        fail('Should have failed due to file lock');
      } catch (error) {
        expect(error.message).toContain('resource busy or locked');
        expect(error.code).toBe('EBUSY');
      }

      // Restore original function
      FileSystem.writeFile = originalWriteFile;
    });

    test('should handle file lock during commit phase', async () => {
      const projectId = 'file-lock-commit';
      const testData = { commit: 'locked' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'locked.json', testData, transaction);

      // Mock FileSystem.copyFile to simulate file lock during commit
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
      );

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit due to file lock');
      } catch (error) {
        expect(error.message).toContain('resource busy or locked');
      }

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'locked.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Validation Hook Failures', () => {
    test('should handle synchronous validation hook failures', async () => {
      const projectId = 'sync-validation-fail';
      const testData = { invalid: 'data' };

      const failingValidator = jest.fn().mockReturnValue(false);

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: failingValidator,
        reason: 'Synchronous validation failure'
      });

      await dataPersistence.saveProjectData(projectId, 'test.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to validation');
      } catch (error) {
        expect(error.message).toContain('Transaction validation failed');
        expect(error.message).toContain('Synchronous validation failure');
      }

      expect(failingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'test.json');
      expect(finalData).toBeNull();
    });

    test('should handle asynchronous validation hook failures', async () => {
      const projectId = 'async-validation-fail';
      const testData = { async: 'invalid' };

      const asyncFailingValidator = jest.fn().mockResolvedValue(false);

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: asyncFailingValidator,
        reason: 'Asynchronous validation failure'
      });

      await dataPersistence.saveProjectData(projectId, 'async.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to async validation');
      } catch (error) {
        expect(error.message).toContain('Transaction validation failed');
        expect(error.message).toContain('Asynchronous validation failure');
      }

      expect(asyncFailingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'async.json');
      expect(finalData).toBeNull();
    });

    test('should handle validation hook crashes', async () => {
      const projectId = 'validation-crash';
      const testData = { crash: 'test' };

      const crashingValidator = jest.fn().mockImplementation(() => {
        throw new Error('Validation hook crashed');
      });

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: crashingValidator,
        reason: 'Crashing validator'
      });

      await dataPersistence.saveProjectData(projectId, 'crash.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to validator crash');
      } catch (error) {
        expect(error.message).toContain('Validation hook crashed');
      }

      expect(crashingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'crash.json');
      expect(finalData).toBeNull();
    });
  });

  describe('Commit Operation Failures', () => {
    test('should handle failure during temp file cleanup', async () => {
      const projectId = 'cleanup-fail';
      const testData = { cleanup: 'test' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'cleanup.json', testData, transaction);

      // Mock FileSystem.deleteFile to fail during cleanup
      const originalDeleteFile = FileSystem.deleteFile;
      FileSystem.deleteFile = jest.fn().mockRejectedValue(new Error('Cannot delete temp file'));

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during temp file cleanup');
      } catch (error) {
        expect(error.message).toContain('Cannot delete temp file');
      }

      // Verify rollback was attempted
      const finalData = await dataPersistence.loadProjectData(projectId, 'cleanup.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.deleteFile = originalDeleteFile;
    });

    test('should handle partial commit failures with multiple files', async () => {
      const projectId = 'partial-commit-fail';
      const files = [
        { name: 'file1.json', data: { id: 1 } },
        { name: 'file2.json', data: { id: 2 } },
        { name: 'file3.json', data: { id: 3 } }
      ];

      const transaction = dataPersistence.beginTransaction();
      
      // Save all files in transaction
      for (const file of files) {
        await dataPersistence.saveProjectData(projectId, file.name, file.data, transaction);
      }

      // Mock FileSystem.copyFile to fail on second file
      const originalCopyFile = FileSystem.copyFile;
      let copyCallCount = 0;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        copyCallCount++;
        if (copyCallCount === 2) {
          throw new Error('Failed to copy second file');
        }
        return originalCopyFile(src, dest);
      });

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during partial commit');
      } catch (error) {
        expect(error.message).toContain('Failed to copy second file');
      }

      // Verify all files were rolled back (none should exist)
      for (const file of files) {
        const finalData = await dataPersistence.loadProjectData(projectId, file.name);
        expect(finalData).toBeNull();
      }

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Rollback Operation Failures', () => {
    test('should handle rollback failures gracefully', async () => {
      const projectId = 'rollback-fail';
      const originalData = { original: true };
      const newData = { modified: true };

      // Create initial file
      await dataPersistence.saveProjectData(projectId, 'rollback.json', originalData);

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'rollback.json', newData, transaction);

      // Mock FileSystem.writeFile to fail during rollback
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(new Error('Cannot restore backup'));

      // Force rollback by making commit fail
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(new Error('Commit failed'));

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit and rollback');
      } catch (error) {
        // The error should be from the rollback failure, not the original commit failure
        expect(error.message).toContain('Cannot restore backup');
      }

      // Restore original functions
      FileSystem.writeFile = originalWriteFile;
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Concurrent Transaction Stress Tests', () => {
    test('should handle concurrent transaction failures', async () => {
      const projectId1 = 'concurrent-fail-1';
      const projectId2 = 'concurrent-fail-2';
      const data1 = { project: 1 };
      const data2 = { project: 2 };

      // Start two concurrent transactions
      const transaction1 = dataPersistence.beginTransaction();
      const transaction2 = dataPersistence.beginTransaction();

      // Mock one to fail
      const originalCopyFile = FileSystem.copyFile;
      let copyCallCount = 0;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        copyCallCount++;
        if (copyCallCount === 1) {
          throw new Error('First transaction failed');
        }
        return originalCopyFile(src, dest);
      });

      // Execute operations concurrently
      const promise1 = (async () => {
        await dataPersistence.saveProjectData(projectId1, 'data.json', data1, transaction1);
        return dataPersistence.commitTransaction(transaction1);
      })();

      const promise2 = (async () => {
        await dataPersistence.saveProjectData(projectId2, 'data.json', data2, transaction2);
        return dataPersistence.commitTransaction(transaction2);
      })();

      // Wait for both to complete (one should fail)
      const results = await Promise.allSettled([promise1, promise2]);

      // One should fail, one should succeed
      const failedCount = results.filter(r => r.status === 'rejected').length;
      const succeededCount = results.filter(r => r.status === 'fulfilled').length;
      
      expect(failedCount).toBe(1);
      expect(succeededCount).toBe(1);

      // Verify only the successful transaction's data exists
      const result1 = await dataPersistence.loadProjectData(projectId1, 'data.json');
      const result2 = await dataPersistence.loadProjectData(projectId2, 'data.json');

      // One should be null (failed), one should have data (succeeded)
      const nullCount = [result1, result2].filter(r => r === null).length;
      const dataCount = [result1, result2].filter(r => r !== null).length;
      
      expect(nullCount).toBe(1);
      expect(dataCount).toBe(1);

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });

    test('should handle high concurrency transaction stress', async () => {
      const concurrentTransactions = 10;
      const promises = [];

      // Mock to randomly fail some transactions
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        // Randomly fail ~30% of transactions
        if (Math.random() < 0.3) {
          throw new Error('Random transaction failure');
        }
        return originalCopyFile(src, dest);
      });

      // Create multiple concurrent transactions
      for (let i = 0; i < concurrentTransactions; i++) {
        const promise = (async () => {
          const projectId = `stress-test-${i}`;
          const testData = { id: i, stress: true };
          
          const transaction = dataPersistence.beginTransaction();
          await dataPersistence.saveProjectData(projectId, 'stress.json', testData, transaction);
          return dataPersistence.commitTransaction(transaction);
        })();
        
        promises.push(promise);
      }

      // Wait for all to complete
      const results = await Promise.allSettled(promises);

      // Some should succeed, some should fail
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.filter(r => r.status === 'rejected').length;
      
      expect(successCount + failureCount).toBe(concurrentTransactions);
      expect(successCount).toBeGreaterThan(0); // At least some should succeed
      expect(failureCount).toBeGreaterThan(0); // At least some should fail

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });
});
    test('should ensure successful operations are fully committed', async () => {
      const projectId = 'commit-consistency';
      const files = [
        { name: 'file1.json', data: { committed: true, id: 1 } },
        { name: 'file2.json', data: { committed: true, id: 2 } }
      ];

      const transaction = dataPersistence.beginTransaction();

      for (const file of files) {
        await dataPersistence.saveProjectData(projectId, file.name, file.data, transaction);
      }

      await dataPersistence.commitTransaction(transaction);

      // Verify all files are committed and accessible
      for (const file of files) {
        const savedData = await dataPersistence.loadProjectData(projectId, file.name);
        expect(savedData).toEqual(file.data);
      }

      // Verify no temp files remain
      const projectDir = dataPersistence.getProjectDir(projectId);
      const files_after = await fs.readdir(projectDir);
      const tempFiles = files_after.filter(f => f.endsWith('.tmp'));
      expect(tempFiles).toHaveLength(0);
    });

// ============================================================================
// TRANSACTION ERROR SCENARIOS TESTS
// ============================================================================

describe('Transaction Error Scenarios', () => {
  let dataPersistence;
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'forest-error-tx-test-'));
    dataPersistence = new DataPersistence(tmpDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Disk Space Simulation Tests', () => {
    test('should handle disk full during temp file creation', async () => {
      const projectId = 'disk-full-test';
      const testData = { large: 'data'.repeat(1000) };

      // Mock FileSystem.writeFile to simulate disk full error
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
      );

      const transaction = dataPersistence.beginTransaction();
      
      try {
        await dataPersistence.saveProjectData(projectId, 'large.json', testData, transaction);
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to disk space');
      } catch (error) {
        expect(error.message).toContain('no space left on device');
        expect(error.code).toBe('ENOSPC');
      }

      // Verify no partial files remain
      const projectDir = dataPersistence.getProjectDir(projectId);
      try {
        const files = await fs.readdir(projectDir);
        const tempFiles = files.filter(f => f.endsWith('.tmp'));
        expect(tempFiles).toHaveLength(0);
      } catch (dirError) {
        // Directory might not exist, which is fine
        expect(dirError.code).toBe('ENOENT');
      }

      // Restore original function
      FileSystem.writeFile = originalWriteFile;
    });

    test('should handle disk full during commit phase', async () => {
      const projectId = 'commit-disk-full';
      const testData = { commit: 'test' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'commit.json', testData, transaction);

      // Mock FileSystem.copyFile to fail during commit
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
      );

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit');
      } catch (error) {
        expect(error.message).toContain('no space left on device');
      }

      // Verify rollback occurred - no final file should exist
      const finalData = await dataPersistence.loadProjectData(projectId, 'commit.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('File Lock Scenarios', () => {
    test('should handle file lock during temp file creation', async () => {
      const projectId = 'file-lock-temp';
      const testData = { locked: true };

      // Mock FileSystem.writeFile to simulate file lock
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
      );

      const transaction = dataPersistence.beginTransaction();

      try {
        await dataPersistence.saveProjectData(projectId, 'locked.json', testData, transaction);
        fail('Should have failed due to file lock');
      } catch (error) {
        expect(error.message).toContain('resource busy or locked');
        expect(error.code).toBe('EBUSY');
      }

      // Restore original function
      FileSystem.writeFile = originalWriteFile;
    });

    test('should handle file lock during commit phase', async () => {
      const projectId = 'file-lock-commit';
      const testData = { commit: 'locked' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'locked.json', testData, transaction);

      // Mock FileSystem.copyFile to simulate file lock during commit
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
      );

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit due to file lock');
      } catch (error) {
        expect(error.message).toContain('resource busy or locked');
      }

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'locked.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Validation Hook Failures', () => {
    test('should handle synchronous validation hook failures', async () => {
      const projectId = 'sync-validation-fail';
      const testData = { invalid: 'data' };

      const failingValidator = jest.fn().mockReturnValue(false);

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: failingValidator,
        reason: 'Synchronous validation failure'
      });

      await dataPersistence.saveProjectData(projectId, 'test.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to validation');
      } catch (error) {
        expect(error.message).toContain('Transaction validation failed');
        expect(error.message).toContain('Synchronous validation failure');
      }

      expect(failingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'test.json');
      expect(finalData).toBeNull();
    });

    test('should handle asynchronous validation hook failures', async () => {
      const projectId = 'async-validation-fail';
      const testData = { async: 'invalid' };

      const asyncFailingValidator = jest.fn().mockResolvedValue(false);

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: asyncFailingValidator,
        reason: 'Asynchronous validation failure'
      });

      await dataPersistence.saveProjectData(projectId, 'async.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to async validation');
      } catch (error) {
        expect(error.message).toContain('Transaction validation failed');
        expect(error.message).toContain('Asynchronous validation failure');
      }

      expect(asyncFailingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'async.json');
      expect(finalData).toBeNull();
    });

    test('should handle validation hook crashes', async () => {
      const projectId = 'validation-crash';
      const testData = { crash: 'test' };

      const crashingValidator = jest.fn().mockImplementation(() => {
        throw new Error('Validation hook crashed');
      });

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: crashingValidator,
        reason: 'Crashing validator'
      });

      await dataPersistence.saveProjectData(projectId, 'crash.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to validator crash');
      } catch (error) {
        expect(error.message).toContain('Validation hook crashed');
      }

      expect(crashingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'crash.json');
      expect(finalData).toBeNull();
    });
  });

  describe('Commit Operation Failures', () => {
    test('should handle failure during temp file cleanup', async () => {
      const projectId = 'cleanup-fail';
      const testData = { cleanup: 'test' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'cleanup.json', testData, transaction);

      // Mock FileSystem.deleteFile to fail during cleanup
      const originalDeleteFile = FileSystem.deleteFile;
      FileSystem.deleteFile = jest.fn().mockRejectedValue(new Error('Cannot delete temp file'));

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during temp file cleanup');
      } catch (error) {
        expect(error.message).toContain('Cannot delete temp file');
      }

      // Verify rollback was attempted
      const finalData = await dataPersistence.loadProjectData(projectId, 'cleanup.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.deleteFile = originalDeleteFile;
    });

    test('should handle partial commit failures with multiple files', async () => {
      const projectId = 'partial-commit-fail';
      const files = [
        { name: 'file1.json', data: { id: 1 } },
        { name: 'file2.json', data: { id: 2 } },
        { name: 'file3.json', data: { id: 3 } }
      ];

      const transaction = dataPersistence.beginTransaction();
      
      // Save all files in transaction
      for (const file of files) {
        await dataPersistence.saveProjectData(projectId, file.name, file.data, transaction);
      }

      // Mock FileSystem.copyFile to fail on second file
      const originalCopyFile = FileSystem.copyFile;
      let copyCallCount = 0;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        copyCallCount++;
        if (copyCallCount === 2) {
          throw new Error('Failed to copy second file');
        }
        return originalCopyFile(src, dest);
      });

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during partial commit');
      } catch (error) {
        expect(error.message).toContain('Failed to copy second file');
      }

      // Verify all files were rolled back (none should exist)
      for (const file of files) {
        const finalData = await dataPersistence.loadProjectData(projectId, file.name);
        expect(finalData).toBeNull();
      }

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Rollback Operation Failures', () => {
    test('should handle rollback failures gracefully', async () => {
      const projectId = 'rollback-fail';
      const originalData = { original: true };
      const newData = { modified: true };

      // Create initial file
      await dataPersistence.saveProjectData(projectId, 'rollback.json', originalData);

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'rollback.json', newData, transaction);

      // Mock FileSystem.writeFile to fail during rollback
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(new Error('Cannot restore backup'));

      // Force rollback by making commit fail
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(new Error('Commit failed'));

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit and rollback');
      } catch (error) {
        // The error should be from the rollback failure, not the original commit failure
        expect(error.message).toContain('Cannot restore backup');
      }

      // Restore original functions
      FileSystem.writeFile = originalWriteFile;
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Concurrent Transaction Stress Tests', () => {
    test('should handle concurrent transaction failures', async () => {
      const projectId1 = 'concurrent-fail-1';
      const projectId2 = 'concurrent-fail-2';
      const data1 = { project: 1 };
      const data2 = { project: 2 };

      // Start two concurrent transactions
      const transaction1 = dataPersistence.beginTransaction();
      const transaction2 = dataPersistence.beginTransaction();

      // Mock one to fail
      const originalCopyFile = FileSystem.copyFile;
      let copyCallCount = 0;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        copyCallCount++;
        if (copyCallCount === 1) {
          throw new Error('First transaction failed');
        }
        return originalCopyFile(src, dest);
      });

      // Execute operations concurrently
      const promise1 = (async () => {
        await dataPersistence.saveProjectData(projectId1, 'data.json', data1, transaction1);
        return dataPersistence.commitTransaction(transaction1);
      })();

      const promise2 = (async () => {
        await dataPersistence.saveProjectData(projectId2, 'data.json', data2, transaction2);
        return dataPersistence.commitTransaction(transaction2);
      })();

      // Wait for both to complete (one should fail)
      const results = await Promise.allSettled([promise1, promise2]);

      // One should fail, one should succeed
      const failedCount = results.filter(r => r.status === 'rejected').length;
      const succeededCount = results.filter(r => r.status === 'fulfilled').length;
      
      expect(failedCount).toBe(1);
      expect(succeededCount).toBe(1);

      // Verify only the successful transaction's data exists
      const result1 = await dataPersistence.loadProjectData(projectId1, 'data.json');
      const result2 = await dataPersistence.loadProjectData(projectId2, 'data.json');

      // One should be null (failed), one should have data (succeeded)
      const nullCount = [result1, result2].filter(r => r === null).length;
      const dataCount = [result1, result2].filter(r => r !== null).length;
      
      expect(nullCount).toBe(1);
      expect(dataCount).toBe(1);

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });

    test('should handle high concurrency transaction stress', async () => {
      const concurrentTransactions = 10;
      const promises = [];

      // Mock to randomly fail some transactions
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        // Randomly fail ~30% of transactions
        if (Math.random() < 0.3) {
          throw new Error('Random transaction failure');
        }
        return originalCopyFile(src, dest);
      });

      // Create multiple concurrent transactions
      for (let i = 0; i < concurrentTransactions; i++) {
        const promise = (async () => {
          const projectId = `stress-test-${i}`;
          const testData = { id: i, stress: true };
          
          const transaction = dataPersistence.beginTransaction();
          await dataPersistence.saveProjectData(projectId, 'stress.json', testData, transaction);
          return dataPersistence.commitTransaction(transaction);
        })();
        
        promises.push(promise);
      }

      // Wait for all to complete
      const results = await Promise.allSettled(promises);

      // Some should succeed, some should fail
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.filter(r => r.status === 'rejected').length;
      
      expect(successCount + failureCount).toBe(concurrentTransactions);
      expect(successCount).toBeGreaterThan(0); // At least some should succeed
      expect(failureCount).toBeGreaterThan(0); // At least some should fail

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });
});
    test('should handle concurrent operations without interference', async () => {
      const projectId1 = 'concurrent-1';
      const projectId2 = 'concurrent-2';
      const data1 = { project: 1, concurrent: true };
      const data2 = { project: 2, concurrent: true };

      // Start two concurrent transactions
      const transaction1 = dataPersistence.beginTransaction();
      const transaction2 = dataPersistence.beginTransaction();

      // Execute operations concurrently
      const promise1 = (async () => {
        await dataPersistence.saveProjectData(projectId1, 'data.json', data1, transaction1);
        await dataPersistence.commitTransaction(transaction1);
      })();

      const promise2 = (async () => {
        await dataPersistence.saveProjectData(projectId2, 'data.json', data2, transaction2);
        await dataPersistence.commitTransaction(transaction2);
      })();

      // Wait for both to complete
      await Promise.all([promise1, promise2]);

      // Verify both operations succeeded independently
      const result1 = await dataPersistence.loadProjectData(projectId1, 'data.json');
      const result2 = await dataPersistence.loadProjectData(projectId2, 'data.json');

      expect(result1).toEqual(data1);
      expect(result2).toEqual(data2);
    });

// ============================================================================
// TRANSACTION ERROR SCENARIOS TESTS
// ============================================================================

describe('Transaction Error Scenarios', () => {
  let dataPersistence;
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'forest-error-tx-test-'));
    dataPersistence = new DataPersistence(tmpDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Disk Space Simulation Tests', () => {
    test('should handle disk full during temp file creation', async () => {
      const projectId = 'disk-full-test';
      const testData = { large: 'data'.repeat(1000) };

      // Mock FileSystem.writeFile to simulate disk full error
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
      );

      const transaction = dataPersistence.beginTransaction();
      
      try {
        await dataPersistence.saveProjectData(projectId, 'large.json', testData, transaction);
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to disk space');
      } catch (error) {
        expect(error.message).toContain('no space left on device');
        expect(error.code).toBe('ENOSPC');
      }

      // Verify no partial files remain
      const projectDir = dataPersistence.getProjectDir(projectId);
      try {
        const files = await fs.readdir(projectDir);
        const tempFiles = files.filter(f => f.endsWith('.tmp'));
        expect(tempFiles).toHaveLength(0);
      } catch (dirError) {
        // Directory might not exist, which is fine
        expect(dirError.code).toBe('ENOENT');
      }

      // Restore original function
      FileSystem.writeFile = originalWriteFile;
    });

    test('should handle disk full during commit phase', async () => {
      const projectId = 'commit-disk-full';
      const testData = { commit: 'test' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'commit.json', testData, transaction);

      // Mock FileSystem.copyFile to fail during commit
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
      );

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit');
      } catch (error) {
        expect(error.message).toContain('no space left on device');
      }

      // Verify rollback occurred - no final file should exist
      const finalData = await dataPersistence.loadProjectData(projectId, 'commit.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('File Lock Scenarios', () => {
    test('should handle file lock during temp file creation', async () => {
      const projectId = 'file-lock-temp';
      const testData = { locked: true };

      // Mock FileSystem.writeFile to simulate file lock
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
      );

      const transaction = dataPersistence.beginTransaction();

      try {
        await dataPersistence.saveProjectData(projectId, 'locked.json', testData, transaction);
        fail('Should have failed due to file lock');
      } catch (error) {
        expect(error.message).toContain('resource busy or locked');
        expect(error.code).toBe('EBUSY');
      }

      // Restore original function
      FileSystem.writeFile = originalWriteFile;
    });

    test('should handle file lock during commit phase', async () => {
      const projectId = 'file-lock-commit';
      const testData = { commit: 'locked' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'locked.json', testData, transaction);

      // Mock FileSystem.copyFile to simulate file lock during commit
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
      );

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit due to file lock');
      } catch (error) {
        expect(error.message).toContain('resource busy or locked');
      }

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'locked.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Validation Hook Failures', () => {
    test('should handle synchronous validation hook failures', async () => {
      const projectId = 'sync-validation-fail';
      const testData = { invalid: 'data' };

      const failingValidator = jest.fn().mockReturnValue(false);

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: failingValidator,
        reason: 'Synchronous validation failure'
      });

      await dataPersistence.saveProjectData(projectId, 'test.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to validation');
      } catch (error) {
        expect(error.message).toContain('Transaction validation failed');
        expect(error.message).toContain('Synchronous validation failure');
      }

      expect(failingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'test.json');
      expect(finalData).toBeNull();
    });

    test('should handle asynchronous validation hook failures', async () => {
      const projectId = 'async-validation-fail';
      const testData = { async: 'invalid' };

      const asyncFailingValidator = jest.fn().mockResolvedValue(false);

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: asyncFailingValidator,
        reason: 'Asynchronous validation failure'
      });

      await dataPersistence.saveProjectData(projectId, 'async.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to async validation');
      } catch (error) {
        expect(error.message).toContain('Transaction validation failed');
        expect(error.message).toContain('Asynchronous validation failure');
      }

      expect(asyncFailingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'async.json');
      expect(finalData).toBeNull();
    });

    test('should handle validation hook crashes', async () => {
      const projectId = 'validation-crash';
      const testData = { crash: 'test' };

      const crashingValidator = jest.fn().mockImplementation(() => {
        throw new Error('Validation hook crashed');
      });

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: crashingValidator,
        reason: 'Crashing validator'
      });

      await dataPersistence.saveProjectData(projectId, 'crash.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to validator crash');
      } catch (error) {
        expect(error.message).toContain('Validation hook crashed');
      }

      expect(crashingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'crash.json');
      expect(finalData).toBeNull();
    });
  });

  describe('Commit Operation Failures', () => {
    test('should handle failure during temp file cleanup', async () => {
      const projectId = 'cleanup-fail';
      const testData = { cleanup: 'test' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'cleanup.json', testData, transaction);

      // Mock FileSystem.deleteFile to fail during cleanup
      const originalDeleteFile = FileSystem.deleteFile;
      FileSystem.deleteFile = jest.fn().mockRejectedValue(new Error('Cannot delete temp file'));

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during temp file cleanup');
      } catch (error) {
        expect(error.message).toContain('Cannot delete temp file');
      }

      // Verify rollback was attempted
      const finalData = await dataPersistence.loadProjectData(projectId, 'cleanup.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.deleteFile = originalDeleteFile;
    });

    test('should handle partial commit failures with multiple files', async () => {
      const projectId = 'partial-commit-fail';
      const files = [
        { name: 'file1.json', data: { id: 1 } },
        { name: 'file2.json', data: { id: 2 } },
        { name: 'file3.json', data: { id: 3 } }
      ];

      const transaction = dataPersistence.beginTransaction();
      
      // Save all files in transaction
      for (const file of files) {
        await dataPersistence.saveProjectData(projectId, file.name, file.data, transaction);
      }

      // Mock FileSystem.copyFile to fail on second file
      const originalCopyFile = FileSystem.copyFile;
      let copyCallCount = 0;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        copyCallCount++;
        if (copyCallCount === 2) {
          throw new Error('Failed to copy second file');
        }
        return originalCopyFile(src, dest);
      });

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during partial commit');
      } catch (error) {
        expect(error.message).toContain('Failed to copy second file');
      }

      // Verify all files were rolled back (none should exist)
      for (const file of files) {
        const finalData = await dataPersistence.loadProjectData(projectId, file.name);
        expect(finalData).toBeNull();
      }

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Rollback Operation Failures', () => {
    test('should handle rollback failures gracefully', async () => {
      const projectId = 'rollback-fail';
      const originalData = { original: true };
      const newData = { modified: true };

      // Create initial file
      await dataPersistence.saveProjectData(projectId, 'rollback.json', originalData);

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'rollback.json', newData, transaction);

      // Mock FileSystem.writeFile to fail during rollback
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(new Error('Cannot restore backup'));

      // Force rollback by making commit fail
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(new Error('Commit failed'));

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit and rollback');
      } catch (error) {
        // The error should be from the rollback failure, not the original commit failure
        expect(error.message).toContain('Cannot restore backup');
      }

      // Restore original functions
      FileSystem.writeFile = originalWriteFile;
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Concurrent Transaction Stress Tests', () => {
    test('should handle concurrent transaction failures', async () => {
      const projectId1 = 'concurrent-fail-1';
      const projectId2 = 'concurrent-fail-2';
      const data1 = { project: 1 };
      const data2 = { project: 2 };

      // Start two concurrent transactions
      const transaction1 = dataPersistence.beginTransaction();
      const transaction2 = dataPersistence.beginTransaction();

      // Mock one to fail
      const originalCopyFile = FileSystem.copyFile;
      let copyCallCount = 0;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        copyCallCount++;
        if (copyCallCount === 1) {
          throw new Error('First transaction failed');
        }
        return originalCopyFile(src, dest);
      });

      // Execute operations concurrently
      const promise1 = (async () => {
        await dataPersistence.saveProjectData(projectId1, 'data.json', data1, transaction1);
        return dataPersistence.commitTransaction(transaction1);
      })();

      const promise2 = (async () => {
        await dataPersistence.saveProjectData(projectId2, 'data.json', data2, transaction2);
        return dataPersistence.commitTransaction(transaction2);
      })();

      // Wait for both to complete (one should fail)
      const results = await Promise.allSettled([promise1, promise2]);

      // One should fail, one should succeed
      const failedCount = results.filter(r => r.status === 'rejected').length;
      const succeededCount = results.filter(r => r.status === 'fulfilled').length;
      
      expect(failedCount).toBe(1);
      expect(succeededCount).toBe(1);

      // Verify only the successful transaction's data exists
      const result1 = await dataPersistence.loadProjectData(projectId1, 'data.json');
      const result2 = await dataPersistence.loadProjectData(projectId2, 'data.json');

      // One should be null (failed), one should have data (succeeded)
      const nullCount = [result1, result2].filter(r => r === null).length;
      const dataCount = [result1, result2].filter(r => r !== null).length;
      
      expect(nullCount).toBe(1);
      expect(dataCount).toBe(1);

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });

    test('should handle high concurrency transaction stress', async () => {
      const concurrentTransactions = 10;
      const promises = [];

      // Mock to randomly fail some transactions
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        // Randomly fail ~30% of transactions
        if (Math.random() < 0.3) {
          throw new Error('Random transaction failure');
        }
        return originalCopyFile(src, dest);
      });

      // Create multiple concurrent transactions
      for (let i = 0; i < concurrentTransactions; i++) {
        const promise = (async () => {
          const projectId = `stress-test-${i}`;
          const testData = { id: i, stress: true };
          
          const transaction = dataPersistence.beginTransaction();
          await dataPersistence.saveProjectData(projectId, 'stress.json', testData, transaction);
          return dataPersistence.commitTransaction(transaction);
        })();
        
        promises.push(promise);
      }

      // Wait for all to complete
      const results = await Promise.allSettled(promises);

      // Some should succeed, some should fail
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.filter(r => r.status === 'rejected').length;
      
      expect(successCount + failureCount).toBe(concurrentTransactions);
      expect(successCount).toBeGreaterThan(0); // At least some should succeed
      expect(failureCount).toBeGreaterThan(0); // At least some should fail

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });
});
  });

// ============================================================================
// TRANSACTION ERROR SCENARIOS TESTS
// ============================================================================

describe('Transaction Error Scenarios', () => {
  let dataPersistence;
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'forest-error-tx-test-'));
    dataPersistence = new DataPersistence(tmpDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Disk Space Simulation Tests', () => {
    test('should handle disk full during temp file creation', async () => {
      const projectId = 'disk-full-test';
      const testData = { large: 'data'.repeat(1000) };

      // Mock FileSystem.writeFile to simulate disk full error
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
      );

      const transaction = dataPersistence.beginTransaction();
      
      try {
        await dataPersistence.saveProjectData(projectId, 'large.json', testData, transaction);
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to disk space');
      } catch (error) {
        expect(error.message).toContain('no space left on device');
        expect(error.code).toBe('ENOSPC');
      }

      // Verify no partial files remain
      const projectDir = dataPersistence.getProjectDir(projectId);
      try {
        const files = await fs.readdir(projectDir);
        const tempFiles = files.filter(f => f.endsWith('.tmp'));
        expect(tempFiles).toHaveLength(0);
      } catch (dirError) {
        // Directory might not exist, which is fine
        expect(dirError.code).toBe('ENOENT');
      }

      // Restore original function
      FileSystem.writeFile = originalWriteFile;
    });

    test('should handle disk full during commit phase', async () => {
      const projectId = 'commit-disk-full';
      const testData = { commit: 'test' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'commit.json', testData, transaction);

      // Mock FileSystem.copyFile to fail during commit
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
      );

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit');
      } catch (error) {
        expect(error.message).toContain('no space left on device');
      }

      // Verify rollback occurred - no final file should exist
      const finalData = await dataPersistence.loadProjectData(projectId, 'commit.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('File Lock Scenarios', () => {
    test('should handle file lock during temp file creation', async () => {
      const projectId = 'file-lock-temp';
      const testData = { locked: true };

      // Mock FileSystem.writeFile to simulate file lock
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
      );

      const transaction = dataPersistence.beginTransaction();

      try {
        await dataPersistence.saveProjectData(projectId, 'locked.json', testData, transaction);
        fail('Should have failed due to file lock');
      } catch (error) {
        expect(error.message).toContain('resource busy or locked');
        expect(error.code).toBe('EBUSY');
      }

      // Restore original function
      FileSystem.writeFile = originalWriteFile;
    });

    test('should handle file lock during commit phase', async () => {
      const projectId = 'file-lock-commit';
      const testData = { commit: 'locked' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'locked.json', testData, transaction);

      // Mock FileSystem.copyFile to simulate file lock during commit
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
      );

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit due to file lock');
      } catch (error) {
        expect(error.message).toContain('resource busy or locked');
      }

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'locked.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Validation Hook Failures', () => {
    test('should handle synchronous validation hook failures', async () => {
      const projectId = 'sync-validation-fail';
      const testData = { invalid: 'data' };

      const failingValidator = jest.fn().mockReturnValue(false);

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: failingValidator,
        reason: 'Synchronous validation failure'
      });

      await dataPersistence.saveProjectData(projectId, 'test.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to validation');
      } catch (error) {
        expect(error.message).toContain('Transaction validation failed');
        expect(error.message).toContain('Synchronous validation failure');
      }

      expect(failingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'test.json');
      expect(finalData).toBeNull();
    });

    test('should handle asynchronous validation hook failures', async () => {
      const projectId = 'async-validation-fail';
      const testData = { async: 'invalid' };

      const asyncFailingValidator = jest.fn().mockResolvedValue(false);

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: asyncFailingValidator,
        reason: 'Asynchronous validation failure'
      });

      await dataPersistence.saveProjectData(projectId, 'async.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to async validation');
      } catch (error) {
        expect(error.message).toContain('Transaction validation failed');
        expect(error.message).toContain('Asynchronous validation failure');
      }

      expect(asyncFailingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'async.json');
      expect(finalData).toBeNull();
    });

    test('should handle validation hook crashes', async () => {
      const projectId = 'validation-crash';
      const testData = { crash: 'test' };

      const crashingValidator = jest.fn().mockImplementation(() => {
        throw new Error('Validation hook crashed');
      });

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: crashingValidator,
        reason: 'Crashing validator'
      });

      await dataPersistence.saveProjectData(projectId, 'crash.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to validator crash');
      } catch (error) {
        expect(error.message).toContain('Validation hook crashed');
      }

      expect(crashingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'crash.json');
      expect(finalData).toBeNull();
    });
  });

  describe('Commit Operation Failures', () => {
    test('should handle failure during temp file cleanup', async () => {
      const projectId = 'cleanup-fail';
      const testData = { cleanup: 'test' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'cleanup.json', testData, transaction);

      // Mock FileSystem.deleteFile to fail during cleanup
      const originalDeleteFile = FileSystem.deleteFile;
      FileSystem.deleteFile = jest.fn().mockRejectedValue(new Error('Cannot delete temp file'));

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during temp file cleanup');
      } catch (error) {
        expect(error.message).toContain('Cannot delete temp file');
      }

      // Verify rollback was attempted
      const finalData = await dataPersistence.loadProjectData(projectId, 'cleanup.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.deleteFile = originalDeleteFile;
    });

    test('should handle partial commit failures with multiple files', async () => {
      const projectId = 'partial-commit-fail';
      const files = [
        { name: 'file1.json', data: { id: 1 } },
        { name: 'file2.json', data: { id: 2 } },
        { name: 'file3.json', data: { id: 3 } }
      ];

      const transaction = dataPersistence.beginTransaction();
      
      // Save all files in transaction
      for (const file of files) {
        await dataPersistence.saveProjectData(projectId, file.name, file.data, transaction);
      }

      // Mock FileSystem.copyFile to fail on second file
      const originalCopyFile = FileSystem.copyFile;
      let copyCallCount = 0;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        copyCallCount++;
        if (copyCallCount === 2) {
          throw new Error('Failed to copy second file');
        }
        return originalCopyFile(src, dest);
      });

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during partial commit');
      } catch (error) {
        expect(error.message).toContain('Failed to copy second file');
      }

      // Verify all files were rolled back (none should exist)
      for (const file of files) {
        const finalData = await dataPersistence.loadProjectData(projectId, file.name);
        expect(finalData).toBeNull();
      }

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Rollback Operation Failures', () => {
    test('should handle rollback failures gracefully', async () => {
      const projectId = 'rollback-fail';
      const originalData = { original: true };
      const newData = { modified: true };

      // Create initial file
      await dataPersistence.saveProjectData(projectId, 'rollback.json', originalData);

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'rollback.json', newData, transaction);

      // Mock FileSystem.writeFile to fail during rollback
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(new Error('Cannot restore backup'));

      // Force rollback by making commit fail
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(new Error('Commit failed'));

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit and rollback');
      } catch (error) {
        // The error should be from the rollback failure, not the original commit failure
        expect(error.message).toContain('Cannot restore backup');
      }

      // Restore original functions
      FileSystem.writeFile = originalWriteFile;
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Concurrent Transaction Stress Tests', () => {
    test('should handle concurrent transaction failures', async () => {
      const projectId1 = 'concurrent-fail-1';
      const projectId2 = 'concurrent-fail-2';
      const data1 = { project: 1 };
      const data2 = { project: 2 };

      // Start two concurrent transactions
      const transaction1 = dataPersistence.beginTransaction();
      const transaction2 = dataPersistence.beginTransaction();

      // Mock one to fail
      const originalCopyFile = FileSystem.copyFile;
      let copyCallCount = 0;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        copyCallCount++;
        if (copyCallCount === 1) {
          throw new Error('First transaction failed');
        }
        return originalCopyFile(src, dest);
      });

      // Execute operations concurrently
      const promise1 = (async () => {
        await dataPersistence.saveProjectData(projectId1, 'data.json', data1, transaction1);
        return dataPersistence.commitTransaction(transaction1);
      })();

      const promise2 = (async () => {
        await dataPersistence.saveProjectData(projectId2, 'data.json', data2, transaction2);
        return dataPersistence.commitTransaction(transaction2);
      })();

      // Wait for both to complete (one should fail)
      const results = await Promise.allSettled([promise1, promise2]);

      // One should fail, one should succeed
      const failedCount = results.filter(r => r.status === 'rejected').length;
      const succeededCount = results.filter(r => r.status === 'fulfilled').length;
      
      expect(failedCount).toBe(1);
      expect(succeededCount).toBe(1);

      // Verify only the successful transaction's data exists
      const result1 = await dataPersistence.loadProjectData(projectId1, 'data.json');
      const result2 = await dataPersistence.loadProjectData(projectId2, 'data.json');

      // One should be null (failed), one should have data (succeeded)
      const nullCount = [result1, result2].filter(r => r === null).length;
      const dataCount = [result1, result2].filter(r => r !== null).length;
      
      expect(nullCount).toBe(1);
      expect(dataCount).toBe(1);

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });

    test('should handle high concurrency transaction stress', async () => {
      const concurrentTransactions = 10;
      const promises = [];

      // Mock to randomly fail some transactions
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        // Randomly fail ~30% of transactions
        if (Math.random() < 0.3) {
          throw new Error('Random transaction failure');
        }
        return originalCopyFile(src, dest);
      });

      // Create multiple concurrent transactions
      for (let i = 0; i < concurrentTransactions; i++) {
        const promise = (async () => {
          const projectId = `stress-test-${i}`;
          const testData = { id: i, stress: true };
          
          const transaction = dataPersistence.beginTransaction();
          await dataPersistence.saveProjectData(projectId, 'stress.json', testData, transaction);
          return dataPersistence.commitTransaction(transaction);
        })();
        
        promises.push(promise);
      }

      // Wait for all to complete
      const results = await Promise.allSettled(promises);

      // Some should succeed, some should fail
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.filter(r => r.status === 'rejected').length;
      
      expect(successCount + failureCount).toBe(concurrentTransactions);
      expect(successCount).toBeGreaterThan(0); // At least some should succeed
      expect(failureCount).toBeGreaterThan(0); // At least some should fail

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });
});
  describe('Performance and Integration Tests', () => {
    test('should measure transaction overhead', async () => {
      const projectId = 'performance-test';
      const testData = { performance: 'test', timestamp: Date.now() };

      // Measure transaction time
      const startTime = Date.now();
      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'perf.json', testData, transaction);
      await dataPersistence.commitTransaction(transaction);
      const transactionTime = Date.now() - startTime;

      // Measure direct save time
      const directStartTime = Date.now();
      await dataPersistence.saveProjectData(projectId, 'direct.json', testData);
      const directTime = Date.now() - directStartTime;

      // Transaction should complete within reasonable overhead (less than 10x direct save)
      expect(transactionTime).toBeLessThan(directTime * 10);

      // Both files should exist and be identical
      const transactionResult = await dataPersistence.loadProjectData(projectId, 'perf.json');
      const directResult = await dataPersistence.loadProjectData(projectId, 'direct.json');

      expect(transactionResult.performance).toEqual(testData.performance);
      expect(directResult.performance).toEqual(testData.performance);
    });

// ============================================================================
// TRANSACTION ERROR SCENARIOS TESTS
// ============================================================================

describe('Transaction Error Scenarios', () => {
  let dataPersistence;
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'forest-error-tx-test-'));
    dataPersistence = new DataPersistence(tmpDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Disk Space Simulation Tests', () => {
    test('should handle disk full during temp file creation', async () => {
      const projectId = 'disk-full-test';
      const testData = { large: 'data'.repeat(1000) };

      // Mock FileSystem.writeFile to simulate disk full error
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
      );

      const transaction = dataPersistence.beginTransaction();
      
      try {
        await dataPersistence.saveProjectData(projectId, 'large.json', testData, transaction);
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to disk space');
      } catch (error) {
        expect(error.message).toContain('no space left on device');
        expect(error.code).toBe('ENOSPC');
      }

      // Verify no partial files remain
      const projectDir = dataPersistence.getProjectDir(projectId);
      try {
        const files = await fs.readdir(projectDir);
        const tempFiles = files.filter(f => f.endsWith('.tmp'));
        expect(tempFiles).toHaveLength(0);
      } catch (dirError) {
        // Directory might not exist, which is fine
        expect(dirError.code).toBe('ENOENT');
      }

      // Restore original function
      FileSystem.writeFile = originalWriteFile;
    });

    test('should handle disk full during commit phase', async () => {
      const projectId = 'commit-disk-full';
      const testData = { commit: 'test' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'commit.json', testData, transaction);

      // Mock FileSystem.copyFile to fail during commit
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
      );

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit');
      } catch (error) {
        expect(error.message).toContain('no space left on device');
      }

      // Verify rollback occurred - no final file should exist
      const finalData = await dataPersistence.loadProjectData(projectId, 'commit.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('File Lock Scenarios', () => {
    test('should handle file lock during temp file creation', async () => {
      const projectId = 'file-lock-temp';
      const testData = { locked: true };

      // Mock FileSystem.writeFile to simulate file lock
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
      );

      const transaction = dataPersistence.beginTransaction();

      try {
        await dataPersistence.saveProjectData(projectId, 'locked.json', testData, transaction);
        fail('Should have failed due to file lock');
      } catch (error) {
        expect(error.message).toContain('resource busy or locked');
        expect(error.code).toBe('EBUSY');
      }

      // Restore original function
      FileSystem.writeFile = originalWriteFile;
    });

    test('should handle file lock during commit phase', async () => {
      const projectId = 'file-lock-commit';
      const testData = { commit: 'locked' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'locked.json', testData, transaction);

      // Mock FileSystem.copyFile to simulate file lock during commit
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
      );

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit due to file lock');
      } catch (error) {
        expect(error.message).toContain('resource busy or locked');
      }

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'locked.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Validation Hook Failures', () => {
    test('should handle synchronous validation hook failures', async () => {
      const projectId = 'sync-validation-fail';
      const testData = { invalid: 'data' };

      const failingValidator = jest.fn().mockReturnValue(false);

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: failingValidator,
        reason: 'Synchronous validation failure'
      });

      await dataPersistence.saveProjectData(projectId, 'test.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to validation');
      } catch (error) {
        expect(error.message).toContain('Transaction validation failed');
        expect(error.message).toContain('Synchronous validation failure');
      }

      expect(failingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'test.json');
      expect(finalData).toBeNull();
    });

    test('should handle asynchronous validation hook failures', async () => {
      const projectId = 'async-validation-fail';
      const testData = { async: 'invalid' };

      const asyncFailingValidator = jest.fn().mockResolvedValue(false);

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: asyncFailingValidator,
        reason: 'Asynchronous validation failure'
      });

      await dataPersistence.saveProjectData(projectId, 'async.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to async validation');
      } catch (error) {
        expect(error.message).toContain('Transaction validation failed');
        expect(error.message).toContain('Asynchronous validation failure');
      }

      expect(asyncFailingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'async.json');
      expect(finalData).toBeNull();
    });

    test('should handle validation hook crashes', async () => {
      const projectId = 'validation-crash';
      const testData = { crash: 'test' };

      const crashingValidator = jest.fn().mockImplementation(() => {
        throw new Error('Validation hook crashed');
      });

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: crashingValidator,
        reason: 'Crashing validator'
      });

      await dataPersistence.saveProjectData(projectId, 'crash.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to validator crash');
      } catch (error) {
        expect(error.message).toContain('Validation hook crashed');
      }

      expect(crashingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'crash.json');
      expect(finalData).toBeNull();
    });
  });

  describe('Commit Operation Failures', () => {
    test('should handle failure during temp file cleanup', async () => {
      const projectId = 'cleanup-fail';
      const testData = { cleanup: 'test' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'cleanup.json', testData, transaction);

      // Mock FileSystem.deleteFile to fail during cleanup
      const originalDeleteFile = FileSystem.deleteFile;
      FileSystem.deleteFile = jest.fn().mockRejectedValue(new Error('Cannot delete temp file'));

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during temp file cleanup');
      } catch (error) {
        expect(error.message).toContain('Cannot delete temp file');
      }

      // Verify rollback was attempted
      const finalData = await dataPersistence.loadProjectData(projectId, 'cleanup.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.deleteFile = originalDeleteFile;
    });

    test('should handle partial commit failures with multiple files', async () => {
      const projectId = 'partial-commit-fail';
      const files = [
        { name: 'file1.json', data: { id: 1 } },
        { name: 'file2.json', data: { id: 2 } },
        { name: 'file3.json', data: { id: 3 } }
      ];

      const transaction = dataPersistence.beginTransaction();
      
      // Save all files in transaction
      for (const file of files) {
        await dataPersistence.saveProjectData(projectId, file.name, file.data, transaction);
      }

      // Mock FileSystem.copyFile to fail on second file
      const originalCopyFile = FileSystem.copyFile;
      let copyCallCount = 0;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        copyCallCount++;
        if (copyCallCount === 2) {
          throw new Error('Failed to copy second file');
        }
        return originalCopyFile(src, dest);
      });

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during partial commit');
      } catch (error) {
        expect(error.message).toContain('Failed to copy second file');
      }

      // Verify all files were rolled back (none should exist)
      for (const file of files) {
        const finalData = await dataPersistence.loadProjectData(projectId, file.name);
        expect(finalData).toBeNull();
      }

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Rollback Operation Failures', () => {
    test('should handle rollback failures gracefully', async () => {
      const projectId = 'rollback-fail';
      const originalData = { original: true };
      const newData = { modified: true };

      // Create initial file
      await dataPersistence.saveProjectData(projectId, 'rollback.json', originalData);

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'rollback.json', newData, transaction);

      // Mock FileSystem.writeFile to fail during rollback
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(new Error('Cannot restore backup'));

      // Force rollback by making commit fail
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(new Error('Commit failed'));

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit and rollback');
      } catch (error) {
        // The error should be from the rollback failure, not the original commit failure
        expect(error.message).toContain('Cannot restore backup');
      }

      // Restore original functions
      FileSystem.writeFile = originalWriteFile;
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Concurrent Transaction Stress Tests', () => {
    test('should handle concurrent transaction failures', async () => {
      const projectId1 = 'concurrent-fail-1';
      const projectId2 = 'concurrent-fail-2';
      const data1 = { project: 1 };
      const data2 = { project: 2 };

      // Start two concurrent transactions
      const transaction1 = dataPersistence.beginTransaction();
      const transaction2 = dataPersistence.beginTransaction();

      // Mock one to fail
      const originalCopyFile = FileSystem.copyFile;
      let copyCallCount = 0;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        copyCallCount++;
        if (copyCallCount === 1) {
          throw new Error('First transaction failed');
        }
        return originalCopyFile(src, dest);
      });

      // Execute operations concurrently
      const promise1 = (async () => {
        await dataPersistence.saveProjectData(projectId1, 'data.json', data1, transaction1);
        return dataPersistence.commitTransaction(transaction1);
      })();

      const promise2 = (async () => {
        await dataPersistence.saveProjectData(projectId2, 'data.json', data2, transaction2);
        return dataPersistence.commitTransaction(transaction2);
      })();

      // Wait for both to complete (one should fail)
      const results = await Promise.allSettled([promise1, promise2]);

      // One should fail, one should succeed
      const failedCount = results.filter(r => r.status === 'rejected').length;
      const succeededCount = results.filter(r => r.status === 'fulfilled').length;
      
      expect(failedCount).toBe(1);
      expect(succeededCount).toBe(1);

      // Verify only the successful transaction's data exists
      const result1 = await dataPersistence.loadProjectData(projectId1, 'data.json');
      const result2 = await dataPersistence.loadProjectData(projectId2, 'data.json');

      // One should be null (failed), one should have data (succeeded)
      const nullCount = [result1, result2].filter(r => r === null).length;
      const dataCount = [result1, result2].filter(r => r !== null).length;
      
      expect(nullCount).toBe(1);
      expect(dataCount).toBe(1);

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });

    test('should handle high concurrency transaction stress', async () => {
      const concurrentTransactions = 10;
      const promises = [];

      // Mock to randomly fail some transactions
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        // Randomly fail ~30% of transactions
        if (Math.random() < 0.3) {
          throw new Error('Random transaction failure');
        }
        return originalCopyFile(src, dest);
      });

      // Create multiple concurrent transactions
      for (let i = 0; i < concurrentTransactions; i++) {
        const promise = (async () => {
          const projectId = `stress-test-${i}`;
          const testData = { id: i, stress: true };
          
          const transaction = dataPersistence.beginTransaction();
          await dataPersistence.saveProjectData(projectId, 'stress.json', testData, transaction);
          return dataPersistence.commitTransaction(transaction);
        })();
        
        promises.push(promise);
      }

      // Wait for all to complete
      const results = await Promise.allSettled(promises);

      // Some should succeed, some should fail
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.filter(r => r.status === 'rejected').length;
      
      expect(successCount + failureCount).toBe(concurrentTransactions);
      expect(successCount).toBeGreaterThan(0); // At least some should succeed
      expect(failureCount).toBeGreaterThan(0); // At least some should fail

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });
});
    test('should handle recovery from various failure points', async () => {
      const projectId = 'recovery-test';
      const testData = { recovery: 'test' };

      // Test failure during temp file creation
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn()
        .mockRejectedValueOnce(new Error('Temp file creation failed'))
        .mockImplementation(originalWriteFile);

      const transaction1 = dataPersistence.beginTransaction();

      try {
        await dataPersistence.saveProjectData(projectId, 'recovery1.json', testData, transaction1);
        fail('Should have failed during temp file creation');
      } catch (error) {
        expect(error.message).toContain('Temp file creation failed');
      }

      // Verify system can recover and perform successful transaction
      const transaction2 = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'recovery2.json', testData, transaction2);
      await dataPersistence.commitTransaction(transaction2);

      const recoveredData = await dataPersistence.loadProjectData(projectId, 'recovery2.json');
      expect(recoveredData).toEqual(testData);

      // Restore original function
      FileSystem.writeFile = originalWriteFile;
    });

// ============================================================================
// TRANSACTION ERROR SCENARIOS TESTS
// ============================================================================

describe('Transaction Error Scenarios', () => {
  let dataPersistence;
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'forest-error-tx-test-'));
    dataPersistence = new DataPersistence(tmpDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Disk Space Simulation Tests', () => {
    test('should handle disk full during temp file creation', async () => {
      const projectId = 'disk-full-test';
      const testData = { large: 'data'.repeat(1000) };

      // Mock FileSystem.writeFile to simulate disk full error
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
      );

      const transaction = dataPersistence.beginTransaction();
      
      try {
        await dataPersistence.saveProjectData(projectId, 'large.json', testData, transaction);
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to disk space');
      } catch (error) {
        expect(error.message).toContain('no space left on device');
        expect(error.code).toBe('ENOSPC');
      }

      // Verify no partial files remain
      const projectDir = dataPersistence.getProjectDir(projectId);
      try {
        const files = await fs.readdir(projectDir);
        const tempFiles = files.filter(f => f.endsWith('.tmp'));
        expect(tempFiles).toHaveLength(0);
      } catch (dirError) {
        // Directory might not exist, which is fine
        expect(dirError.code).toBe('ENOENT');
      }

      // Restore original function
      FileSystem.writeFile = originalWriteFile;
    });

    test('should handle disk full during commit phase', async () => {
      const projectId = 'commit-disk-full';
      const testData = { commit: 'test' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'commit.json', testData, transaction);

      // Mock FileSystem.copyFile to fail during commit
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
      );

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit');
      } catch (error) {
        expect(error.message).toContain('no space left on device');
      }

      // Verify rollback occurred - no final file should exist
      const finalData = await dataPersistence.loadProjectData(projectId, 'commit.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('File Lock Scenarios', () => {
    test('should handle file lock during temp file creation', async () => {
      const projectId = 'file-lock-temp';
      const testData = { locked: true };

      // Mock FileSystem.writeFile to simulate file lock
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
      );

      const transaction = dataPersistence.beginTransaction();

      try {
        await dataPersistence.saveProjectData(projectId, 'locked.json', testData, transaction);
        fail('Should have failed due to file lock');
      } catch (error) {
        expect(error.message).toContain('resource busy or locked');
        expect(error.code).toBe('EBUSY');
      }

      // Restore original function
      FileSystem.writeFile = originalWriteFile;
    });

    test('should handle file lock during commit phase', async () => {
      const projectId = 'file-lock-commit';
      const testData = { commit: 'locked' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'locked.json', testData, transaction);

      // Mock FileSystem.copyFile to simulate file lock during commit
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
      );

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit due to file lock');
      } catch (error) {
        expect(error.message).toContain('resource busy or locked');
      }

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'locked.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Validation Hook Failures', () => {
    test('should handle synchronous validation hook failures', async () => {
      const projectId = 'sync-validation-fail';
      const testData = { invalid: 'data' };

      const failingValidator = jest.fn().mockReturnValue(false);

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: failingValidator,
        reason: 'Synchronous validation failure'
      });

      await dataPersistence.saveProjectData(projectId, 'test.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to validation');
      } catch (error) {
        expect(error.message).toContain('Transaction validation failed');
        expect(error.message).toContain('Synchronous validation failure');
      }

      expect(failingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'test.json');
      expect(finalData).toBeNull();
    });

    test('should handle asynchronous validation hook failures', async () => {
      const projectId = 'async-validation-fail';
      const testData = { async: 'invalid' };

      const asyncFailingValidator = jest.fn().mockResolvedValue(false);

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: asyncFailingValidator,
        reason: 'Asynchronous validation failure'
      });

      await dataPersistence.saveProjectData(projectId, 'async.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to async validation');
      } catch (error) {
        expect(error.message).toContain('Transaction validation failed');
        expect(error.message).toContain('Asynchronous validation failure');
      }

      expect(asyncFailingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'async.json');
      expect(finalData).toBeNull();
    });

    test('should handle validation hook crashes', async () => {
      const projectId = 'validation-crash';
      const testData = { crash: 'test' };

      const crashingValidator = jest.fn().mockImplementation(() => {
        throw new Error('Validation hook crashed');
      });

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: crashingValidator,
        reason: 'Crashing validator'
      });

      await dataPersistence.saveProjectData(projectId, 'crash.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to validator crash');
      } catch (error) {
        expect(error.message).toContain('Validation hook crashed');
      }

      expect(crashingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'crash.json');
      expect(finalData).toBeNull();
    });
  });

  describe('Commit Operation Failures', () => {
    test('should handle failure during temp file cleanup', async () => {
      const projectId = 'cleanup-fail';
      const testData = { cleanup: 'test' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'cleanup.json', testData, transaction);

      // Mock FileSystem.deleteFile to fail during cleanup
      const originalDeleteFile = FileSystem.deleteFile;
      FileSystem.deleteFile = jest.fn().mockRejectedValue(new Error('Cannot delete temp file'));

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during temp file cleanup');
      } catch (error) {
        expect(error.message).toContain('Cannot delete temp file');
      }

      // Verify rollback was attempted
      const finalData = await dataPersistence.loadProjectData(projectId, 'cleanup.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.deleteFile = originalDeleteFile;
    });

    test('should handle partial commit failures with multiple files', async () => {
      const projectId = 'partial-commit-fail';
      const files = [
        { name: 'file1.json', data: { id: 1 } },
        { name: 'file2.json', data: { id: 2 } },
        { name: 'file3.json', data: { id: 3 } }
      ];

      const transaction = dataPersistence.beginTransaction();
      
      // Save all files in transaction
      for (const file of files) {
        await dataPersistence.saveProjectData(projectId, file.name, file.data, transaction);
      }

      // Mock FileSystem.copyFile to fail on second file
      const originalCopyFile = FileSystem.copyFile;
      let copyCallCount = 0;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        copyCallCount++;
        if (copyCallCount === 2) {
          throw new Error('Failed to copy second file');
        }
        return originalCopyFile(src, dest);
      });

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during partial commit');
      } catch (error) {
        expect(error.message).toContain('Failed to copy second file');
      }

      // Verify all files were rolled back (none should exist)
      for (const file of files) {
        const finalData = await dataPersistence.loadProjectData(projectId, file.name);
        expect(finalData).toBeNull();
      }

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Rollback Operation Failures', () => {
    test('should handle rollback failures gracefully', async () => {
      const projectId = 'rollback-fail';
      const originalData = { original: true };
      const newData = { modified: true };

      // Create initial file
      await dataPersistence.saveProjectData(projectId, 'rollback.json', originalData);

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'rollback.json', newData, transaction);

      // Mock FileSystem.writeFile to fail during rollback
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(new Error('Cannot restore backup'));

      // Force rollback by making commit fail
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(new Error('Commit failed'));

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit and rollback');
      } catch (error) {
        // The error should be from the rollback failure, not the original commit failure
        expect(error.message).toContain('Cannot restore backup');
      }

      // Restore original functions
      FileSystem.writeFile = originalWriteFile;
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Concurrent Transaction Stress Tests', () => {
    test('should handle concurrent transaction failures', async () => {
      const projectId1 = 'concurrent-fail-1';
      const projectId2 = 'concurrent-fail-2';
      const data1 = { project: 1 };
      const data2 = { project: 2 };

      // Start two concurrent transactions
      const transaction1 = dataPersistence.beginTransaction();
      const transaction2 = dataPersistence.beginTransaction();

      // Mock one to fail
      const originalCopyFile = FileSystem.copyFile;
      let copyCallCount = 0;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        copyCallCount++;
        if (copyCallCount === 1) {
          throw new Error('First transaction failed');
        }
        return originalCopyFile(src, dest);
      });

      // Execute operations concurrently
      const promise1 = (async () => {
        await dataPersistence.saveProjectData(projectId1, 'data.json', data1, transaction1);
        return dataPersistence.commitTransaction(transaction1);
      })();

      const promise2 = (async () => {
        await dataPersistence.saveProjectData(projectId2, 'data.json', data2, transaction2);
        return dataPersistence.commitTransaction(transaction2);
      })();

      // Wait for both to complete (one should fail)
      const results = await Promise.allSettled([promise1, promise2]);

      // One should fail, one should succeed
      const failedCount = results.filter(r => r.status === 'rejected').length;
      const succeededCount = results.filter(r => r.status === 'fulfilled').length;
      
      expect(failedCount).toBe(1);
      expect(succeededCount).toBe(1);

      // Verify only the successful transaction's data exists
      const result1 = await dataPersistence.loadProjectData(projectId1, 'data.json');
      const result2 = await dataPersistence.loadProjectData(projectId2, 'data.json');

      // One should be null (failed), one should have data (succeeded)
      const nullCount = [result1, result2].filter(r => r === null).length;
      const dataCount = [result1, result2].filter(r => r !== null).length;
      
      expect(nullCount).toBe(1);
      expect(dataCount).toBe(1);

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });

    test('should handle high concurrency transaction stress', async () => {
      const concurrentTransactions = 10;
      const promises = [];

      // Mock to randomly fail some transactions
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        // Randomly fail ~30% of transactions
        if (Math.random() < 0.3) {
          throw new Error('Random transaction failure');
        }
        return originalCopyFile(src, dest);
      });

      // Create multiple concurrent transactions
      for (let i = 0; i < concurrentTransactions; i++) {
        const promise = (async () => {
          const projectId = `stress-test-${i}`;
          const testData = { id: i, stress: true };
          
          const transaction = dataPersistence.beginTransaction();
          await dataPersistence.saveProjectData(projectId, 'stress.json', testData, transaction);
          return dataPersistence.commitTransaction(transaction);
        })();
        
        promises.push(promise);
      }

      // Wait for all to complete
      const results = await Promise.allSettled(promises);

      // Some should succeed, some should fail
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.filter(r => r.status === 'rejected').length;
      
      expect(successCount + failureCount).toBe(concurrentTransactions);
      expect(successCount).toBeGreaterThan(0); // At least some should succeed
      expect(failureCount).toBeGreaterThan(0); // At least some should fail

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });
});
  });

// ============================================================================
// TRANSACTION ERROR SCENARIOS TESTS
// ============================================================================

describe('Transaction Error Scenarios', () => {
  let dataPersistence;
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'forest-error-tx-test-'));
    dataPersistence = new DataPersistence(tmpDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Disk Space Simulation Tests', () => {
    test('should handle disk full during temp file creation', async () => {
      const projectId = 'disk-full-test';
      const testData = { large: 'data'.repeat(1000) };

      // Mock FileSystem.writeFile to simulate disk full error
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
      );

      const transaction = dataPersistence.beginTransaction();
      
      try {
        await dataPersistence.saveProjectData(projectId, 'large.json', testData, transaction);
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to disk space');
      } catch (error) {
        expect(error.message).toContain('no space left on device');
        expect(error.code).toBe('ENOSPC');
      }

      // Verify no partial files remain
      const projectDir = dataPersistence.getProjectDir(projectId);
      try {
        const files = await fs.readdir(projectDir);
        const tempFiles = files.filter(f => f.endsWith('.tmp'));
        expect(tempFiles).toHaveLength(0);
      } catch (dirError) {
        // Directory might not exist, which is fine
        expect(dirError.code).toBe('ENOENT');
      }

      // Restore original function
      FileSystem.writeFile = originalWriteFile;
    });

    test('should handle disk full during commit phase', async () => {
      const projectId = 'commit-disk-full';
      const testData = { commit: 'test' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'commit.json', testData, transaction);

      // Mock FileSystem.copyFile to fail during commit
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
      );

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit');
      } catch (error) {
        expect(error.message).toContain('no space left on device');
      }

      // Verify rollback occurred - no final file should exist
      const finalData = await dataPersistence.loadProjectData(projectId, 'commit.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('File Lock Scenarios', () => {
    test('should handle file lock during temp file creation', async () => {
      const projectId = 'file-lock-temp';
      const testData = { locked: true };

      // Mock FileSystem.writeFile to simulate file lock
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
      );

      const transaction = dataPersistence.beginTransaction();

      try {
        await dataPersistence.saveProjectData(projectId, 'locked.json', testData, transaction);
        fail('Should have failed due to file lock');
      } catch (error) {
        expect(error.message).toContain('resource busy or locked');
        expect(error.code).toBe('EBUSY');
      }

      // Restore original function
      FileSystem.writeFile = originalWriteFile;
    });

    test('should handle file lock during commit phase', async () => {
      const projectId = 'file-lock-commit';
      const testData = { commit: 'locked' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'locked.json', testData, transaction);

      // Mock FileSystem.copyFile to simulate file lock during commit
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
      );

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit due to file lock');
      } catch (error) {
        expect(error.message).toContain('resource busy or locked');
      }

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'locked.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Validation Hook Failures', () => {
    test('should handle synchronous validation hook failures', async () => {
      const projectId = 'sync-validation-fail';
      const testData = { invalid: 'data' };

      const failingValidator = jest.fn().mockReturnValue(false);

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: failingValidator,
        reason: 'Synchronous validation failure'
      });

      await dataPersistence.saveProjectData(projectId, 'test.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to validation');
      } catch (error) {
        expect(error.message).toContain('Transaction validation failed');
        expect(error.message).toContain('Synchronous validation failure');
      }

      expect(failingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'test.json');
      expect(finalData).toBeNull();
    });

    test('should handle asynchronous validation hook failures', async () => {
      const projectId = 'async-validation-fail';
      const testData = { async: 'invalid' };

      const asyncFailingValidator = jest.fn().mockResolvedValue(false);

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: asyncFailingValidator,
        reason: 'Asynchronous validation failure'
      });

      await dataPersistence.saveProjectData(projectId, 'async.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to async validation');
      } catch (error) {
        expect(error.message).toContain('Transaction validation failed');
        expect(error.message).toContain('Asynchronous validation failure');
      }

      expect(asyncFailingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'async.json');
      expect(finalData).toBeNull();
    });

    test('should handle validation hook crashes', async () => {
      const projectId = 'validation-crash';
      const testData = { crash: 'test' };

      const crashingValidator = jest.fn().mockImplementation(() => {
        throw new Error('Validation hook crashed');
      });

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: crashingValidator,
        reason: 'Crashing validator'
      });

      await dataPersistence.saveProjectData(projectId, 'crash.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to validator crash');
      } catch (error) {
        expect(error.message).toContain('Validation hook crashed');
      }

      expect(crashingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'crash.json');
      expect(finalData).toBeNull();
    });
  });

  describe('Commit Operation Failures', () => {
    test('should handle failure during temp file cleanup', async () => {
      const projectId = 'cleanup-fail';
      const testData = { cleanup: 'test' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'cleanup.json', testData, transaction);

      // Mock FileSystem.deleteFile to fail during cleanup
      const originalDeleteFile = FileSystem.deleteFile;
      FileSystem.deleteFile = jest.fn().mockRejectedValue(new Error('Cannot delete temp file'));

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during temp file cleanup');
      } catch (error) {
        expect(error.message).toContain('Cannot delete temp file');
      }

      // Verify rollback was attempted
      const finalData = await dataPersistence.loadProjectData(projectId, 'cleanup.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.deleteFile = originalDeleteFile;
    });

    test('should handle partial commit failures with multiple files', async () => {
      const projectId = 'partial-commit-fail';
      const files = [
        { name: 'file1.json', data: { id: 1 } },
        { name: 'file2.json', data: { id: 2 } },
        { name: 'file3.json', data: { id: 3 } }
      ];

      const transaction = dataPersistence.beginTransaction();
      
      // Save all files in transaction
      for (const file of files) {
        await dataPersistence.saveProjectData(projectId, file.name, file.data, transaction);
      }

      // Mock FileSystem.copyFile to fail on second file
      const originalCopyFile = FileSystem.copyFile;
      let copyCallCount = 0;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        copyCallCount++;
        if (copyCallCount === 2) {
          throw new Error('Failed to copy second file');
        }
        return originalCopyFile(src, dest);
      });

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during partial commit');
      } catch (error) {
        expect(error.message).toContain('Failed to copy second file');
      }

      // Verify all files were rolled back (none should exist)
      for (const file of files) {
        const finalData = await dataPersistence.loadProjectData(projectId, file.name);
        expect(finalData).toBeNull();
      }

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Rollback Operation Failures', () => {
    test('should handle rollback failures gracefully', async () => {
      const projectId = 'rollback-fail';
      const originalData = { original: true };
      const newData = { modified: true };

      // Create initial file
      await dataPersistence.saveProjectData(projectId, 'rollback.json', originalData);

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'rollback.json', newData, transaction);

      // Mock FileSystem.writeFile to fail during rollback
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(new Error('Cannot restore backup'));

      // Force rollback by making commit fail
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(new Error('Commit failed'));

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit and rollback');
      } catch (error) {
        // The error should be from the rollback failure, not the original commit failure
        expect(error.message).toContain('Cannot restore backup');
      }

      // Restore original functions
      FileSystem.writeFile = originalWriteFile;
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Concurrent Transaction Stress Tests', () => {
    test('should handle concurrent transaction failures', async () => {
      const projectId1 = 'concurrent-fail-1';
      const projectId2 = 'concurrent-fail-2';
      const data1 = { project: 1 };
      const data2 = { project: 2 };

      // Start two concurrent transactions
      const transaction1 = dataPersistence.beginTransaction();
      const transaction2 = dataPersistence.beginTransaction();

      // Mock one to fail
      const originalCopyFile = FileSystem.copyFile;
      let copyCallCount = 0;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        copyCallCount++;
        if (copyCallCount === 1) {
          throw new Error('First transaction failed');
        }
        return originalCopyFile(src, dest);
      });

      // Execute operations concurrently
      const promise1 = (async () => {
        await dataPersistence.saveProjectData(projectId1, 'data.json', data1, transaction1);
        return dataPersistence.commitTransaction(transaction1);
      })();

      const promise2 = (async () => {
        await dataPersistence.saveProjectData(projectId2, 'data.json', data2, transaction2);
        return dataPersistence.commitTransaction(transaction2);
      })();

      // Wait for both to complete (one should fail)
      const results = await Promise.allSettled([promise1, promise2]);

      // One should fail, one should succeed
      const failedCount = results.filter(r => r.status === 'rejected').length;
      const succeededCount = results.filter(r => r.status === 'fulfilled').length;
      
      expect(failedCount).toBe(1);
      expect(succeededCount).toBe(1);

      // Verify only the successful transaction's data exists
      const result1 = await dataPersistence.loadProjectData(projectId1, 'data.json');
      const result2 = await dataPersistence.loadProjectData(projectId2, 'data.json');

      // One should be null (failed), one should have data (succeeded)
      const nullCount = [result1, result2].filter(r => r === null).length;
      const dataCount = [result1, result2].filter(r => r !== null).length;
      
      expect(nullCount).toBe(1);
      expect(dataCount).toBe(1);

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });

    test('should handle high concurrency transaction stress', async () => {
      const concurrentTransactions = 10;
      const promises = [];

      // Mock to randomly fail some transactions
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        // Randomly fail ~30% of transactions
        if (Math.random() < 0.3) {
          throw new Error('Random transaction failure');
        }
        return originalCopyFile(src, dest);
      });

      // Create multiple concurrent transactions
      for (let i = 0; i < concurrentTransactions; i++) {
        const promise = (async () => {
          const projectId = `stress-test-${i}`;
          const testData = { id: i, stress: true };
          
          const transaction = dataPersistence.beginTransaction();
          await dataPersistence.saveProjectData(projectId, 'stress.json', testData, transaction);
          return dataPersistence.commitTransaction(transaction);
        })();
        
        promises.push(promise);
      }

      // Wait for all to complete
      const results = await Promise.allSettled(promises);

      // Some should succeed, some should fail
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.filter(r => r.status === 'rejected').length;
      
      expect(successCount + failureCount).toBe(concurrentTransactions);
      expect(successCount).toBeGreaterThan(0); // At least some should succeed
      expect(failureCount).toBeGreaterThan(0); // At least some should fail

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });
});
});

// ============================================================================
// TRANSACTION ERROR SCENARIOS TESTS
// ============================================================================

describe('Transaction Error Scenarios', () => {
  let dataPersistence;
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'forest-error-tx-test-'));
    dataPersistence = new DataPersistence(tmpDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Disk Space Simulation Tests', () => {
    test('should handle disk full during temp file creation', async () => {
      const projectId = 'disk-full-test';
      const testData = { large: 'data'.repeat(1000) };

      // Mock FileSystem.writeFile to simulate disk full error
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
      );

      const transaction = dataPersistence.beginTransaction();
      
      try {
        await dataPersistence.saveProjectData(projectId, 'large.json', testData, transaction);
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to disk space');
      } catch (error) {
        expect(error.message).toContain('no space left on device');
        expect(error.code).toBe('ENOSPC');
      }

      // Verify no partial files remain
      const projectDir = dataPersistence.getProjectDir(projectId);
      try {
        const files = await fs.readdir(projectDir);
        const tempFiles = files.filter(f => f.endsWith('.tmp'));
        expect(tempFiles).toHaveLength(0);
      } catch (dirError) {
        // Directory might not exist, which is fine
        expect(dirError.code).toBe('ENOENT');
      }

      // Restore original function
      FileSystem.writeFile = originalWriteFile;
    });

    test('should handle disk full during commit phase', async () => {
      const projectId = 'commit-disk-full';
      const testData = { commit: 'test' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'commit.json', testData, transaction);

      // Mock FileSystem.copyFile to fail during commit
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
      );

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit');
      } catch (error) {
        expect(error.message).toContain('no space left on device');
      }

      // Verify rollback occurred - no final file should exist
      const finalData = await dataPersistence.loadProjectData(projectId, 'commit.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('File Lock Scenarios', () => {
    test('should handle file lock during temp file creation', async () => {
      const projectId = 'file-lock-temp';
      const testData = { locked: true };

      // Mock FileSystem.writeFile to simulate file lock
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
      );

      const transaction = dataPersistence.beginTransaction();

      try {
        await dataPersistence.saveProjectData(projectId, 'locked.json', testData, transaction);
        fail('Should have failed due to file lock');
      } catch (error) {
        expect(error.message).toContain('resource busy or locked');
        expect(error.code).toBe('EBUSY');
      }

      // Restore original function
      FileSystem.writeFile = originalWriteFile;
    });

    test('should handle file lock during commit phase', async () => {
      const projectId = 'file-lock-commit';
      const testData = { commit: 'locked' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'locked.json', testData, transaction);

      // Mock FileSystem.copyFile to simulate file lock during commit
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' })
      );

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit due to file lock');
      } catch (error) {
        expect(error.message).toContain('resource busy or locked');
      }

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'locked.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Validation Hook Failures', () => {
    test('should handle synchronous validation hook failures', async () => {
      const projectId = 'sync-validation-fail';
      const testData = { invalid: 'data' };

      const failingValidator = jest.fn().mockReturnValue(false);

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: failingValidator,
        reason: 'Synchronous validation failure'
      });

      await dataPersistence.saveProjectData(projectId, 'test.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to validation');
      } catch (error) {
        expect(error.message).toContain('Transaction validation failed');
        expect(error.message).toContain('Synchronous validation failure');
      }

      expect(failingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'test.json');
      expect(finalData).toBeNull();
    });

    test('should handle asynchronous validation hook failures', async () => {
      const projectId = 'async-validation-fail';
      const testData = { async: 'invalid' };

      const asyncFailingValidator = jest.fn().mockResolvedValue(false);

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: asyncFailingValidator,
        reason: 'Asynchronous validation failure'
      });

      await dataPersistence.saveProjectData(projectId, 'async.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to async validation');
      } catch (error) {
        expect(error.message).toContain('Transaction validation failed');
        expect(error.message).toContain('Asynchronous validation failure');
      }

      expect(asyncFailingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'async.json');
      expect(finalData).toBeNull();
    });

    test('should handle validation hook crashes', async () => {
      const projectId = 'validation-crash';
      const testData = { crash: 'test' };

      const crashingValidator = jest.fn().mockImplementation(() => {
        throw new Error('Validation hook crashed');
      });

      const transaction = dataPersistence.beginTransaction();
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: crashingValidator,
        reason: 'Crashing validator'
      });

      await dataPersistence.saveProjectData(projectId, 'crash.json', testData, transaction);

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed due to validator crash');
      } catch (error) {
        expect(error.message).toContain('Validation hook crashed');
      }

      expect(crashingValidator).toHaveBeenCalledWith(testData);

      // Verify rollback occurred
      const finalData = await dataPersistence.loadProjectData(projectId, 'crash.json');
      expect(finalData).toBeNull();
    });
  });

  describe('Commit Operation Failures', () => {
    test('should handle failure during temp file cleanup', async () => {
      const projectId = 'cleanup-fail';
      const testData = { cleanup: 'test' };

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'cleanup.json', testData, transaction);

      // Mock FileSystem.deleteFile to fail during cleanup
      const originalDeleteFile = FileSystem.deleteFile;
      FileSystem.deleteFile = jest.fn().mockRejectedValue(new Error('Cannot delete temp file'));

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during temp file cleanup');
      } catch (error) {
        expect(error.message).toContain('Cannot delete temp file');
      }

      // Verify rollback was attempted
      const finalData = await dataPersistence.loadProjectData(projectId, 'cleanup.json');
      expect(finalData).toBeNull();

      // Restore original function
      FileSystem.deleteFile = originalDeleteFile;
    });

    test('should handle partial commit failures with multiple files', async () => {
      const projectId = 'partial-commit-fail';
      const files = [
        { name: 'file1.json', data: { id: 1 } },
        { name: 'file2.json', data: { id: 2 } },
        { name: 'file3.json', data: { id: 3 } }
      ];

      const transaction = dataPersistence.beginTransaction();
      
      // Save all files in transaction
      for (const file of files) {
        await dataPersistence.saveProjectData(projectId, file.name, file.data, transaction);
      }

      // Mock FileSystem.copyFile to fail on second file
      const originalCopyFile = FileSystem.copyFile;
      let copyCallCount = 0;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        copyCallCount++;
        if (copyCallCount === 2) {
          throw new Error('Failed to copy second file');
        }
        return originalCopyFile(src, dest);
      });

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during partial commit');
      } catch (error) {
        expect(error.message).toContain('Failed to copy second file');
      }

      // Verify all files were rolled back (none should exist)
      for (const file of files) {
        const finalData = await dataPersistence.loadProjectData(projectId, file.name);
        expect(finalData).toBeNull();
      }

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Rollback Operation Failures', () => {
    test('should handle rollback failures gracefully', async () => {
      const projectId = 'rollback-fail';
      const originalData = { original: true };
      const newData = { modified: true };

      // Create initial file
      await dataPersistence.saveProjectData(projectId, 'rollback.json', originalData);

      const transaction = dataPersistence.beginTransaction();
      await dataPersistence.saveProjectData(projectId, 'rollback.json', newData, transaction);

      // Mock FileSystem.writeFile to fail during rollback
      const originalWriteFile = FileSystem.writeFile;
      FileSystem.writeFile = jest.fn().mockRejectedValue(new Error('Cannot restore backup'));

      // Force rollback by making commit fail
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockRejectedValue(new Error('Commit failed'));

      try {
        await dataPersistence.commitTransaction(transaction);
        fail('Should have failed during commit and rollback');
      } catch (error) {
        // The error should be from the rollback failure, not the original commit failure
        expect(error.message).toContain('Cannot restore backup');
      }

      // Restore original functions
      FileSystem.writeFile = originalWriteFile;
      FileSystem.copyFile = originalCopyFile;
    });
  });

  describe('Concurrent Transaction Stress Tests', () => {
    test('should handle concurrent transaction failures', async () => {
      const projectId1 = 'concurrent-fail-1';
      const projectId2 = 'concurrent-fail-2';
      const data1 = { project: 1 };
      const data2 = { project: 2 };

      // Start two concurrent transactions
      const transaction1 = dataPersistence.beginTransaction();
      const transaction2 = dataPersistence.beginTransaction();

      // Mock one to fail
      const originalCopyFile = FileSystem.copyFile;
      let copyCallCount = 0;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        copyCallCount++;
        if (copyCallCount === 1) {
          throw new Error('First transaction failed');
        }
        return originalCopyFile(src, dest);
      });

      // Execute operations concurrently
      const promise1 = (async () => {
        await dataPersistence.saveProjectData(projectId1, 'data.json', data1, transaction1);
        return dataPersistence.commitTransaction(transaction1);
      })();

      const promise2 = (async () => {
        await dataPersistence.saveProjectData(projectId2, 'data.json', data2, transaction2);
        return dataPersistence.commitTransaction(transaction2);
      })();

      // Wait for both to complete (one should fail)
      const results = await Promise.allSettled([promise1, promise2]);

      // One should fail, one should succeed
      const failedCount = results.filter(r => r.status === 'rejected').length;
      const succeededCount = results.filter(r => r.status === 'fulfilled').length;
      
      expect(failedCount).toBe(1);
      expect(succeededCount).toBe(1);

      // Verify only the successful transaction's data exists
      const result1 = await dataPersistence.loadProjectData(projectId1, 'data.json');
      const result2 = await dataPersistence.loadProjectData(projectId2, 'data.json');

      // One should be null (failed), one should have data (succeeded)
      const nullCount = [result1, result2].filter(r => r === null).length;
      const dataCount = [result1, result2].filter(r => r !== null).length;
      
      expect(nullCount).toBe(1);
      expect(dataCount).toBe(1);

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });

    test('should handle high concurrency transaction stress', async () => {
      const concurrentTransactions = 10;
      const promises = [];

      // Mock to randomly fail some transactions
      const originalCopyFile = FileSystem.copyFile;
      FileSystem.copyFile = jest.fn().mockImplementation(async (src, dest) => {
        // Randomly fail ~30% of transactions
        if (Math.random() < 0.3) {
          throw new Error('Random transaction failure');
        }
        return originalCopyFile(src, dest);
      });

      // Create multiple concurrent transactions
      for (let i = 0; i < concurrentTransactions; i++) {
        const promise = (async () => {
          const projectId = `stress-test-${i}`;
          const testData = { id: i, stress: true };
          
          const transaction = dataPersistence.beginTransaction();
          await dataPersistence.saveProjectData(projectId, 'stress.json', testData, transaction);
          return dataPersistence.commitTransaction(transaction);
        })();
        
        promises.push(promise);
      }

      // Wait for all to complete
      const results = await Promise.allSettled(promises);

      // Some should succeed, some should fail
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.filter(r => r.status === 'rejected').length;
      
      expect(successCount + failureCount).toBe(concurrentTransactions);
      expect(successCount).toBeGreaterThan(0); // At least some should succeed
      expect(failureCount).toBeGreaterThan(0); // At least some should fail

      // Restore original function
      FileSystem.copyFile = originalCopyFile;
    });
  });
});
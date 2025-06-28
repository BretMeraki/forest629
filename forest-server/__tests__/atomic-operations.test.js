/**
 * Atomic Operations Tests
 * Comprehensive tests for the new atomic file operations in the FileSystem utility
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { FileSystem } from '../modules/utils/file-system.js';

describe('FileSystem Atomic Operations', () => {
  let tempDir;
  let testFile;
  let testData;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'forest-atomic-test-'));
    testFile = path.join(tempDir, 'test.json');
    testData = { test: 'data', timestamp: Date.now() };
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('FileSystem.rename', () => {
    test('should rename file successfully', async () => {
      const sourceFile = path.join(tempDir, 'source.txt');
      const destFile = path.join(tempDir, 'dest.txt');
      
      // Create source file
      await fs.writeFile(sourceFile, 'test content');
      
      // Rename file
      await FileSystem.rename(sourceFile, destFile);
      
      // Verify source file no longer exists
      await expect(fs.access(sourceFile)).rejects.toThrow();
      
      // Verify destination file exists with correct content
      const content = await fs.readFile(destFile, 'utf8');
      expect(content).toBe('test content');
    });

    test('should handle error when source file does not exist', async () => {
      const nonExistentFile = path.join(tempDir, 'nonexistent.txt');
      const destFile = path.join(tempDir, 'dest.txt');
      
      await expect(FileSystem.rename(nonExistentFile, destFile))
        .rejects.toThrow(/Failed to rename file/);
    });

    test('should provide descriptive error messages', async () => {
      const nonExistentFile = path.join(tempDir, 'nonexistent.txt');
      const destFile = path.join(tempDir, 'dest.txt');
      
      try {
        await FileSystem.rename(nonExistentFile, destFile);
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error.message).toContain('Failed to rename file');
        expect(error.message).toContain(nonExistentFile);
        expect(error.message).toContain(destFile);
      }
    });
  });

  describe('FileSystem.atomicWriteJSON', () => {
    test('should write JSON file atomically', async () => {
      await FileSystem.atomicWriteJSON(testFile, testData);
      
      // Verify file exists and has correct content
      expect(await FileSystem.exists(testFile)).toBe(true);
      const readData = await FileSystem.readJSON(testFile);
      expect(readData).toEqual(testData);
    });

    test('should handle various data types', async () => {
      const testCases = [
        { name: 'object', data: { key: 'value', nested: { prop: 123 } } },
        { name: 'array', data: [1, 2, 3, 'string', { obj: true }] },
        { name: 'string', data: 'simple string' },
        { name: 'number', data: 42 },
        { name: 'boolean', data: true },
        { name: 'empty object', data: {} },
        { name: 'empty array', data: [] }
      ];

      for (const testCase of testCases) {
        const file = path.join(tempDir, `${testCase.name}.json`);
        await FileSystem.atomicWriteJSON(file, testCase.data);
        
        const readData = await FileSystem.readJSON(file);
        expect(readData).toEqual(testCase.data);
      }
    });

    test('should clean up temp files after successful operation', async () => {
      await FileSystem.atomicWriteJSON(testFile, testData);
      
      // Check that no temp files remain
      const files = await fs.readdir(tempDir);
      const tempFiles = files.filter(file => file.includes('.tmp_'));
      expect(tempFiles).toHaveLength(0);
    });

    test('should clean up temp files after failed operation', async () => {
      // Create a scenario where the atomic write will fail
      // by making the directory read-only (if supported by OS)
      const readOnlyDir = path.join(tempDir, 'readonly');
      await fs.mkdir(readOnlyDir);
      
      try {
        // Try to change permissions (may not work on all systems)
        await fs.chmod(readOnlyDir, 0o444);
      } catch (error) {
        // Skip this test if we can't change permissions
        return;
      }
      
      const readOnlyFile = path.join(readOnlyDir, 'test.json');
      
      try {
        await FileSystem.atomicWriteJSON(readOnlyFile, testData);
        fail('Expected atomic write to fail');
      } catch (error) {
        // Verify temp files are cleaned up even after failure
        const files = await fs.readdir(tempDir, { recursive: true });
        const tempFiles = files.filter(file => file.includes('.tmp_'));
        expect(tempFiles).toHaveLength(0);
      } finally {
        // Restore permissions for cleanup
        try {
          await fs.chmod(readOnlyDir, 0o755);
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    });

    test('should handle concurrent atomic writes to different files', async () => {
      const promises = [];
      const fileCount = 5;
      
      for (let i = 0; i < fileCount; i++) {
        const file = path.join(tempDir, `concurrent-${i}.json`);
        const data = { id: i, timestamp: Date.now() };
        promises.push(FileSystem.atomicWriteJSON(file, data));
      }
      
      await Promise.all(promises);
      
      // Verify all files were created correctly
      for (let i = 0; i < fileCount; i++) {
        const file = path.join(tempDir, `concurrent-${i}.json`);
        const data = await FileSystem.readJSON(file);
        expect(data.id).toBe(i);
      }
    });

    test('should validate input parameters', async () => {
      // Test invalid file path
      await expect(FileSystem.atomicWriteJSON('', testData))
        .rejects.toThrow('Invalid file path for atomic write');
      
      await expect(FileSystem.atomicWriteJSON(null, testData))
        .rejects.toThrow('Invalid file path for atomic write');
      
      // Test null/undefined data
      await expect(FileSystem.atomicWriteJSON(testFile, null))
        .rejects.toThrow('Cannot write null or undefined data');
      
      await expect(FileSystem.atomicWriteJSON(testFile, undefined))
        .rejects.toThrow('Cannot write null or undefined data');
    });

    test('should respect spaces parameter for JSON formatting', async () => {
      const data = { key: 'value', nested: { prop: 123 } };
      
      // Test with different spacing
      await FileSystem.atomicWriteJSON(testFile, data, 4);
      
      const fileContent = await fs.readFile(testFile, 'utf8');
      expect(fileContent).toContain('    '); // Should have 4-space indentation
      
      // Test with compact formatting
      const compactFile = path.join(tempDir, 'compact.json');
      await FileSystem.atomicWriteJSON(compactFile, data, 0);
      
      const compactContent = await fs.readFile(compactFile, 'utf8');
      expect(compactContent).not.toContain('  '); // Should have no indentation
    });
  });

  describe('Integration with DataPersistence', () => {
    test('should resolve the original "fs is not defined" error', async () => {
      // Import DataPersistence to ensure it can be instantiated
      const { DataPersistence } = await import('../modules/data-persistence.js');
      
      const dp = new DataPersistence(tempDir);
      
      // This should not throw "fs is not defined" error
      expect(() => dp._atomicWriteJSON).not.toThrow();
      
      // Test that the atomic write method works
      await expect(dp._atomicWriteJSON(testFile, testData)).resolves.not.toThrow();
      
      // Verify the file was created
      expect(await FileSystem.exists(testFile)).toBe(true);
      const readData = await FileSystem.readJSON(testFile);
      expect(readData).toEqual(testData);
    });
  });
});
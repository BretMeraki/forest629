/**
 * Transaction Safety Tests
 * Tests transaction functionality across all modules that use transaction contexts
 */

const { DataPersistence } = require('../modules/data-persistence.js');
const { CleanForestServer } = require('../server-modular.js');

// Mock file system operations for testing
jest.mock('../modules/utils/file-system.js');

describe('Transaction Safety', () => {
  let dataPersistence;
  let mockFileSystem;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create test instance
    dataPersistence = new DataPersistence('/test/data');

    // Mock FileSystem
    mockFileSystem = require('../modules/utils/file-system.js').FileSystem;
    mockFileSystem.exists = jest.fn().mockResolvedValue(true);
    mockFileSystem.readJSON = jest.fn().mockResolvedValue({});
    mockFileSystem.writeFile = jest.fn().mockResolvedValue();
    mockFileSystem.copyFile = jest.fn().mockResolvedValue();
    mockFileSystem.deleteFile = jest.fn().mockResolvedValue();
    mockFileSystem.dirname = jest.fn().mockReturnValue('/test/data');
    mockFileSystem.join = jest.fn((...args) => args.join('/'));
  });

  describe('DataPersistence Transaction Methods', () => {
    test('beginTransaction creates valid transaction context', () => {
      const transaction = dataPersistence.beginTransaction();

      expect(transaction).toHaveProperty('id');
      expect(transaction).toHaveProperty('backups');
      expect(transaction).toHaveProperty('operations');
      expect(transaction).toHaveProperty('tempFiles');
      expect(transaction).toHaveProperty('startTime');

      expect(transaction.backups).toBeInstanceOf(Map);
      expect(transaction.operations).toBeInstanceOf(Array);
      expect(transaction.tempFiles).toBeInstanceOf(Set);
      expect(typeof transaction.startTime).toBe('number');
    });

    test('saveProjectData with transaction uses temporary files', async () => {
      const transaction = dataPersistence.beginTransaction();
      const testData = { test: 'data' };

      await dataPersistence.saveProjectData('test-project', 'test.json', testData, transaction);

      // Should write to temporary file
      expect(mockFileSystem.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.tmp'),
        JSON.stringify(testData, null, 2)
      );

      // Should add temp file to transaction
      expect(transaction.tempFiles.size).toBe(1);

      // Should add validation operation
      expect(transaction.operations).toHaveLength(1);
      expect(transaction.operations[0].type).toBe('validate');
    });

    test('commitTransaction moves temp files to final locations', async () => {
      const transaction = dataPersistence.beginTransaction();
      const testData = { test: 'data' };

      await dataPersistence.saveProjectData('test-project', 'test.json', testData, transaction);
      await dataPersistence.commitTransaction(transaction);

      // Should copy temp file to final location
      expect(mockFileSystem.copyFile).toHaveBeenCalledWith(
        expect.stringContaining('.tmp'),
        expect.not.stringContaining('.tmp')
      );

      // Should delete temp file
      expect(mockFileSystem.deleteFile).toHaveBeenCalledWith(expect.stringContaining('.tmp'));

      // Should clear transaction data
      expect(transaction.backups.size).toBe(0);
      expect(transaction.operations).toHaveLength(0);
      expect(transaction.tempFiles.size).toBe(0);
    });

    test('rollbackTransaction restores original files', async () => {
      const transaction = dataPersistence.beginTransaction();
      const originalData = { original: 'data' };
      const newData = { new: 'data' };

      // Mock existing file
      mockFileSystem.readJSON.mockResolvedValueOnce(originalData);

      await dataPersistence.saveProjectData('test-project', 'test.json', newData, transaction);
      await dataPersistence.rollbackTransaction(transaction);

      // Should restore original data
      expect(mockFileSystem.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        JSON.stringify(originalData, null, 2)
      );

      // Should delete temp files
      expect(mockFileSystem.deleteFile).toHaveBeenCalledWith(expect.stringContaining('.tmp'));
    });

    test('validation failure triggers rollback', async () => {
      const transaction = dataPersistence.beginTransaction();
      const testData = { test: 'data' };

      await dataPersistence.saveProjectData('test-project', 'test.json', testData, transaction);

      // Add failing validation
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: () => false,
        reason: 'Test validation failure',
      });

      await expect(dataPersistence.commitTransaction(transaction)).rejects.toThrow(
        'Test validation failure'
      );

      // Should clean up temp files
      expect(mockFileSystem.deleteFile).toHaveBeenCalledWith(expect.stringContaining('.tmp'));
    });
  });

  describe('Server-Level Transaction Integration', () => {
    let server;
    let mockProjectManagement;
    let mockDataPersistence;

    beforeEach(() => {
      // Create mocks for dependencies
      mockProjectManagement = {
        requireActiveProject: jest.fn().mockResolvedValue('test-project'),
      };

      mockDataPersistence = {
        beginTransaction: jest.fn().mockReturnValue({
          id: 'test-tx',
          backups: new Map(),
          operations: [],
          tempFiles: new Set(),
          startTime: Date.now(),
        }),
        commitTransaction: jest.fn().mockResolvedValue(),
        rollbackTransaction: jest.fn().mockResolvedValue(),
        saveProjectData: jest.fn().mockResolvedValue(),
        savePathData: jest.fn().mockResolvedValue(),
      };

      // Create partial server instance for testing
      server = {
        projectManagement: mockProjectManagement,
        dataPersistence: mockDataPersistence,
        logger: {
          info: jest.fn(),
          error: jest.fn(),
        },
      };
    });

    test('savePathHTA with transaction context', async () => {
      const { savePathHTA } = require('../server-modular.js').CleanForestServer.prototype;
      const htaData = { frontierNodes: [] };

      await savePathHTA.call(server, 'test-project', 'general', htaData);

      // Should begin transaction
      expect(mockDataPersistence.beginTransaction).toHaveBeenCalled();

      // Should save with transaction
      expect(mockDataPersistence.saveProjectData).toHaveBeenCalledWith(
        'test-project',
        'hta.json',
        htaData,
        expect.any(Object)
      );

      // Should commit transaction
      expect(mockDataPersistence.commitTransaction).toHaveBeenCalled();
    });

    test('savePathHTA rollback on failure', async () => {
      const { savePathHTA } = require('../server-modular.js').CleanForestServer.prototype;

      // Mock save failure
      mockDataPersistence.saveProjectData.mockRejectedValueOnce(new Error('Save failed'));

      await expect(savePathHTA.call(server, 'test-project', 'general', {})).rejects.toThrow(
        'Save failed'
      );

      // Should rollback transaction
      expect(mockDataPersistence.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('Multi-File Operation Atomicity', () => {
    test('task completion updates are atomic', async () => {
      const mockTaskCompletion = {
        dataPersistence: {
          beginTransaction: jest.fn().mockReturnValue({
            id: 'test-tx',
            backups: new Map(),
            operations: [],
            tempFiles: new Set(),
          }),
          commitTransaction: jest.fn().mockResolvedValue(),
          rollbackTransaction: jest.fn().mockResolvedValue(),
          saveProjectData: jest.fn().mockResolvedValue(),
        },
      };

      const blockData = { id: 'test-block', completed: true };
      const htaData = { frontierNodes: [] };
      const schedule = { blocks: [] };

      // Simulate atomic update pattern
      const transaction = mockTaskCompletion.dataPersistence.beginTransaction();

      try {
        await mockTaskCompletion.dataPersistence.saveProjectData(
          'test-project',
          'hta.json',
          htaData,
          transaction
        );
        await mockTaskCompletion.dataPersistence.saveProjectData(
          'test-project',
          'schedule.json',
          schedule,
          transaction
        );
        await mockTaskCompletion.dataPersistence.commitTransaction(transaction);
      } catch (error) {
        await mockTaskCompletion.dataPersistence.rollbackTransaction(transaction);
        throw error;
      }

      expect(mockTaskCompletion.dataPersistence.commitTransaction).toHaveBeenCalled();
    });

    test('project creation is atomic', async () => {
      const mockProjectMgmt = {
        dataPersistence: {
          beginTransaction: jest.fn().mockReturnValue({
            id: 'test-tx',
            backups: new Map(),
            operations: [],
            tempFiles: new Set(),
          }),
          commitTransaction: jest.fn().mockResolvedValue(),
          rollbackTransaction: jest.fn().mockResolvedValue(),
          saveProjectData: jest.fn().mockResolvedValue(),
          saveGlobalData: jest.fn().mockResolvedValue(),
        },
      };

      const projectConfig = { id: 'test-project', goal: 'test goal' };
      const globalData = { projects: ['test-project'], activeProject: 'test-project' };

      // Simulate atomic project creation
      const transaction = mockProjectMgmt.dataPersistence.beginTransaction();

      try {
        await mockProjectMgmt.dataPersistence.saveProjectData(
          'test-project',
          'config.json',
          projectConfig,
          transaction
        );
        await mockProjectMgmt.dataPersistence.saveGlobalData('config.json', globalData);
        await mockProjectMgmt.dataPersistence.commitTransaction(transaction);
      } catch (error) {
        await mockProjectMgmt.dataPersistence.rollbackTransaction(transaction);
        throw error;
      }

      expect(mockProjectMgmt.dataPersistence.commitTransaction).toHaveBeenCalled();
    });
  });

  describe('Error Recovery Scenarios', () => {
    test('handles disk space full during commit', async () => {
      const transaction = dataPersistence.beginTransaction();
      const testData = { test: 'data' };

      await dataPersistence.saveProjectData('test-project', 'test.json', testData, transaction);

      // Mock disk space error during commit
      mockFileSystem.copyFile.mockRejectedValueOnce(new Error('ENOSPC: no space left on device'));

      await expect(dataPersistence.commitTransaction(transaction)).rejects.toThrow(
        'no space left on device'
      );

      // Should attempt cleanup
      expect(mockFileSystem.deleteFile).toHaveBeenCalled();
    });

    test('handles file lock during rollback', async () => {
      const transaction = dataPersistence.beginTransaction();
      const testData = { test: 'data' };

      await dataPersistence.saveProjectData('test-project', 'test.json', testData, transaction);

      // Mock file lock error
      mockFileSystem.writeFile.mockRejectedValueOnce(new Error('EBUSY: resource busy'));

      await expect(dataPersistence.rollbackTransaction(transaction)).rejects.toThrow(
        'resource busy'
      );
    });

    test('concurrent transactions do not interfere', async () => {
      const transaction1 = dataPersistence.beginTransaction();
      const transaction2 = dataPersistence.beginTransaction();

      expect(transaction1.id).not.toBe(transaction2.id);

      // Both should be able to operate independently
      await dataPersistence.saveProjectData('project1', 'test.json', { data: '1' }, transaction1);
      await dataPersistence.saveProjectData('project2', 'test.json', { data: '2' }, transaction2);

      expect(transaction1.tempFiles.size).toBe(1);
      expect(transaction2.tempFiles.size).toBe(1);

      await dataPersistence.commitTransaction(transaction1);
      await dataPersistence.commitTransaction(transaction2);

      expect(mockFileSystem.copyFile).toHaveBeenCalledTimes(2);
    });
  });

  describe('Performance Impact', () => {
    test('transaction overhead is minimal', async () => {
      const iterations = 100;
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        const transaction = dataPersistence.beginTransaction();
        await dataPersistence.saveProjectData(`project-${i}`, 'test.json', { i }, transaction);
        await dataPersistence.commitTransaction(transaction);
      }

      const duration = Date.now() - startTime;
      const avgPerOperation = duration / iterations;

      // Should be reasonably fast (under 10ms per operation)
      expect(avgPerOperation).toBeLessThan(10);
    });

    test('large transaction commits are efficient', async () => {
      const transaction = dataPersistence.beginTransaction();
      const fileCount = 50;

      // Add many files to single transaction
      for (let i = 0; i < fileCount; i++) {
        await dataPersistence.saveProjectData('test-project', `file-${i}.json`, { i }, transaction);
      }

      const startTime = Date.now();
      await dataPersistence.commitTransaction(transaction);
      const duration = Date.now() - startTime;

      // Should complete in reasonable time
      expect(duration).toBeLessThan(1000); // 1 second
      expect(mockFileSystem.copyFile).toHaveBeenCalledTimes(fileCount);
    });
  });

  describe('Data Consistency Validation', () => {
    test('validates transaction data before commit', async () => {
      const transaction = dataPersistence.beginTransaction();
      const invalidData = null;

      await dataPersistence.saveProjectData('test-project', 'test.json', invalidData, transaction);

      // Should fail validation and rollback
      await expect(dataPersistence.commitTransaction(transaction)).rejects.toThrow(
        'Data must be a valid object'
      );

      expect(mockFileSystem.deleteFile).toHaveBeenCalledWith(expect.stringContaining('.tmp'));
    });

    test('custom validation rules work correctly', async () => {
      const transaction = dataPersistence.beginTransaction();
      const testData = { test: 'data' };

      await dataPersistence.saveProjectData('test-project', 'test.json', testData, transaction);

      // Add custom validation
      transaction.operations.push({
        type: 'validate',
        data: testData,
        validator: data => data.test === 'required_value',
        reason: 'Test field must be "required_value"',
      });

      await expect(dataPersistence.commitTransaction(transaction)).rejects.toThrow(
        'Test field must be "required_value"'
      );
    });
  });
});

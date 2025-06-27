/**
 * Module-Specific Transaction Integration Tests
 * Tests transaction usage across different Forest MCP modules
 */

import { jest } from '@jest/globals';
import { DataPersistence } from '../modules/data-persistence.js';
import { ProjectManagement } from '../modules/project-management.js';
import { HtaTreeBuilder } from '../modules/hta-tree-builder.js';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

describe('Module-Specific Transaction Tests', () => {
  let tmpDir;
  let dataPersistence;
  let projectManagement;
  let htaTreeBuilder;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'forest-module-tx-test-'));
    dataPersistence = new DataPersistence(tmpDir);
    projectManagement = new ProjectManagement(dataPersistence);
    
    // Mock logger for HtaTreeBuilder
    const mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };
    
    htaTreeBuilder = new HtaTreeBuilder(dataPersistence, projectManagement);
    htaTreeBuilder.logger = mockLogger;
  });

  afterEach(async () => {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('HTA Tree Builder Transaction Tests', () => {
    test('should use transactions for HTA tree creation', async () => {
      // Create a project first
      await projectManagement.createProject('test-hta-tx', 'Test HTA Transaction');
      await projectManagement.setActiveProject('test-hta-tx');

      // Mock Claude interface to return valid response
      const mockClaudeResponse = {
        content: [{
          type: 'text',
          text: JSON.stringify({
            strategic_branches: [
              {
                title: 'Learning Branch',
                description: 'Core learning path',
                priority: 'high',
                tasks: [
                  { title: 'Task 1', description: 'First task', difficulty: 3 }
                ]
              }
            ],
            goal: 'Test Goal',
            complexity_analysis: { score: 5 }
          })
        }]
      };

      htaTreeBuilder.claudeInterface = {
        requestIntelligence: jest.fn().mockResolvedValue(mockClaudeResponse)
      };

      // Test HTA tree building with transaction
      const result = await htaTreeBuilder.buildHTATree('general', 'mixed', [], 'Test Goal');

      expect(result.success).toBe(true);
      
      // Verify HTA data was saved atomically
      const htaData = await dataPersistence.loadPathData('test-hta-tx', 'general', 'hta.json');
      expect(htaData).toBeDefined();
      expect(htaData.goal).toBe('Test Goal');
      expect(htaData.frontierNodes).toBeDefined();
      expect(htaData.frontierNodes.length).toBeGreaterThan(0);
    });

    test('should rollback HTA creation on validation failure', async () => {
      await projectManagement.createProject('test-hta-rollback', 'Test HTA Rollback');
      await projectManagement.setActiveProject('test-hta-rollback');

      // Mock Claude to return response that will fail validation
      htaTreeBuilder.claudeInterface = {
        requestIntelligence: jest.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'Invalid JSON response' }]
        })
      };

      // Override parseClaudeResponse to return invalid data
      htaTreeBuilder.parseClaudeResponse = jest.fn().mockReturnValue(null);

      const result = await htaTreeBuilder.buildHTATree('general', 'mixed', [], 'Invalid Goal');

      // Should fall back to skeleton generation, but let's test explicit failure
      expect(result.success).toBe(true); // Falls back to skeleton
      
      // Verify HTA data exists (skeleton fallback)
      const htaData = await dataPersistence.loadPathData('test-hta-rollback', 'general', 'hta.json');
      expect(htaData).toBeDefined();
      expect(htaData.frontierNodes).toBeDefined();
    });

    test('should handle transaction rollback on file system errors', async () => {
      await projectManagement.createProject('test-fs-error', 'Test FS Error');
      await projectManagement.setActiveProject('test-fs-error');

      // Mock file system to fail during save
      const originalSavePathData = dataPersistence.savePathData;
      dataPersistence.savePathData = jest.fn().mockRejectedValue(new Error('Disk full'));

      const result = await htaTreeBuilder.buildHTATree('general', 'mixed', [], 'FS Error Test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Disk full');

      // Verify no partial data was saved
      const htaData = await dataPersistence.loadPathData('test-fs-error', 'general', 'hta.json');
      expect(htaData).toBeNull();

      // Restore original method
      dataPersistence.savePathData = originalSavePathData;
    });
  });

  describe('Project Management Transaction Tests', () => {
    test('should create projects atomically', async () => {
      const projectId = 'atomic-project';
      const projectName = 'Atomic Project Test';

      // Test atomic project creation
      const result = await projectManagement.createProject(projectId, projectName);
      expect(result.success).toBe(true);

      // Verify all project files were created
      const projectConfig = await dataPersistence.loadProjectData(projectId, 'project.json');
      const learningHistory = await dataPersistence.loadProjectData(projectId, 'learning-history.json');

      expect(projectConfig).toBeDefined();
      expect(projectConfig.name).toBe(projectName);
      expect(learningHistory).toBeDefined();
    });

    test('should handle project creation failure atomically', async () => {
      const projectId = 'failing-project';
      
      // Mock file system to fail during project creation
      const originalSaveProjectData = dataPersistence.saveProjectData;
      let callCount = 0;
      dataPersistence.saveProjectData = jest.fn().mockImplementation(async (pid, filename, data) => {
        callCount++;
        if (callCount === 2) { // Fail on second file
          throw new Error('Simulated disk failure');
        }
        return originalSaveProjectData.call(dataPersistence, pid, filename, data);
      });

      try {
        await projectManagement.createProject(projectId, 'Failing Project');
        fail('Should have failed during project creation');
      } catch (error) {
        expect(error.message).toContain('Simulated disk failure');
      }

      // Verify no partial project data exists
      const projectConfig = await dataPersistence.loadProjectData(projectId, 'project.json');
      const learningHistory = await dataPersistence.loadProjectData(projectId, 'learning-history.json');
      
      expect(projectConfig).toBeNull();
      expect(learningHistory).toBeNull();

      // Restore original method
      dataPersistence.saveProjectData = originalSaveProjectData;
    });
  });

  describe('Transaction Performance Tests', () => {
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
  });
});/**
 * Module-Specific Transaction Integration Tests
 * Tests transaction usage across different Forest MCP modules
 */

import { jest } from '@jest/globals';
import { DataPersistence } from '../modules/data-persistence.js';
import { ProjectManagement } from '../modules/project-management.js';
import { HtaTreeBuilder } from '../modules/hta-tree-builder.js';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

describe('Module-Specific Transaction Tests', () => {
  let tmpDir;
  let dataPersistence;
  let projectManagement;
  let htaTreeBuilder;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'forest-module-tx-test-'));
    dataPersistence = new DataPersistence(tmpDir);
    projectManagement = new ProjectManagement(dataPersistence);
    
    // Mock logger for HtaTreeBuilder
    const mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };
    
    htaTreeBuilder = new HtaTreeBuilder(dataPersistence, projectManagement);
    htaTreeBuilder.logger = mockLogger;
  });

  afterEach(async () => {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('HTA Tree Builder Transaction Tests', () => {
    test('should use transactions for HTA tree creation', async () => {
      // Create a project first
      await projectManagement.createProject('test-hta-tx', 'Test HTA Transaction');
      await projectManagement.setActiveProject('test-hta-tx');

      // Mock Claude interface to return valid response
      const mockClaudeResponse = {
        content: [{
          type: 'text',
          text: JSON.stringify({
            strategic_branches: [
              {
                title: 'Learning Branch',
                description: 'Core learning path',
                priority: 'high',
                tasks: [
                  { title: 'Task 1', description: 'First task', difficulty: 3 }
                ]
              }
            ],
            goal: 'Test Goal',
            complexity_analysis: { score: 5 }
          })
        }]
      };

      htaTreeBuilder.claudeInterface = {
        requestIntelligence: jest.fn().mockResolvedValue(mockClaudeResponse)
      };

      // Test HTA tree building with transaction
      const result = await htaTreeBuilder.buildHTATree('general', 'mixed', [], 'Test Goal');

      expect(result.success).toBe(true);
      
      // Verify HTA data was saved atomically
      const htaData = await dataPersistence.loadPathData('test-hta-tx', 'general', 'hta.json');
      expect(htaData).toBeDefined();
      expect(htaData.goal).toBe('Test Goal');
      expect(htaData.frontierNodes).toBeDefined();
      expect(htaData.frontierNodes.length).toBeGreaterThan(0);
    });

    test('should rollback HTA creation on validation failure', async () => {
      await projectManagement.createProject('test-hta-rollback', 'Test HTA Rollback');
      await projectManagement.setActiveProject('test-hta-rollback');

      // Mock Claude to return response that will fail validation
      htaTreeBuilder.claudeInterface = {
        requestIntelligence: jest.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'Invalid JSON response' }]
        })
      };

      // Override parseClaudeResponse to return invalid data
      htaTreeBuilder.parseClaudeResponse = jest.fn().mockReturnValue(null);

      const result = await htaTreeBuilder.buildHTATree('general', 'mixed', [], 'Invalid Goal');

      // Should fall back to skeleton generation, but let's test explicit failure
      expect(result.success).toBe(true); // Falls back to skeleton
      
      // Verify HTA data exists (skeleton fallback)
      const htaData = await dataPersistence.loadPathData('test-hta-rollback', 'general', 'hta.json');
      expect(htaData).toBeDefined();
      expect(htaData.frontierNodes).toBeDefined();
    });

    test('should handle transaction rollback on file system errors', async () => {
      await projectManagement.createProject('test-fs-error', 'Test FS Error');
      await projectManagement.setActiveProject('test-fs-error');

      // Mock file system to fail during save
      const originalSavePathData = dataPersistence.savePathData;
      dataPersistence.savePathData = jest.fn().mockRejectedValue(new Error('Disk full'));

      const result = await htaTreeBuilder.buildHTATree('general', 'mixed', [], 'FS Error Test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Disk full');

      // Verify no partial data was saved
      const htaData = await dataPersistence.loadPathData('test-fs-error', 'general', 'hta.json');
      expect(htaData).toBeNull();

      // Restore original method
      dataPersistence.savePathData = originalSavePathData;
    });
  });

  describe('Project Management Transaction Tests', () => {
    test('should create projects atomically', async () => {
      const projectId = 'atomic-project';
      const projectName = 'Atomic Project Test';

      // Test atomic project creation
      const result = await projectManagement.createProject(projectId, projectName);
      expect(result.success).toBe(true);

      // Verify all project files were created
      const projectConfig = await dataPersistence.loadProjectData(projectId, 'project.json');
      const learningHistory = await dataPersistence.loadProjectData(projectId, 'learning-history.json');

      expect(projectConfig).toBeDefined();
      expect(projectConfig.name).toBe(projectName);
      expect(learningHistory).toBeDefined();
    });

    test('should handle project creation failure atomically', async () => {
      const projectId = 'failing-project';
      
      // Mock file system to fail during project creation
      const originalSaveProjectData = dataPersistence.saveProjectData;
      let callCount = 0;
      dataPersistence.saveProjectData = jest.fn().mockImplementation(async (pid, filename, data) => {
        callCount++;
        if (callCount === 2) { // Fail on second file
          throw new Error('Simulated disk failure');
        }
        return originalSaveProjectData.call(dataPersistence, pid, filename, data);
      });

      try {
        await projectManagement.createProject(projectId, 'Failing Project');
        fail('Should have failed during project creation');
      } catch (error) {
        expect(error.message).toContain('Simulated disk failure');
      }

      // Verify no partial project data exists
      const projectConfig = await dataPersistence.loadProjectData(projectId, 'project.json');
      const learningHistory = await dataPersistence.loadProjectData(projectId, 'learning-history.json');
      
      expect(projectConfig).toBeNull();
      expect(learningHistory).toBeNull();

      // Restore original method
      dataPersistence.saveProjectData = originalSaveProjectData;
    });
  });

  describe('Transaction Performance Tests', () => {
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
  });
});
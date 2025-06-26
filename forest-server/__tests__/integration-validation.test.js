/**
 * Integration Validation Test - CTO Super Glue Verification
 * Validates that all components work together seamlessly
 */

import { jest } from '@jest/globals';
import { createIntegrationTestHarness } from './integration-test-harness.js';
import { HtaTreeBuilder } from '../hta-tree-builder.js';

describe('Integration Validation', () => {
  let testHarness;

  beforeEach(() => {
    testHarness = createIntegrationTestHarness();
  });

  afterEach(() => {
    testHarness.cleanup();
  });

  it('should build an HTA tree successfully with a valid project', async () => {
    await testHarness.setupCompleteSystemState();
    const mocks = testHarness.createComprehensiveMocks();
    
    // PHASE 1: MOCK VALIDATION - Verify mock objects have required methods
    const validateMock = (mockObject, expectedMethods, mockName) => {
      console.error(`[MOCK-VALIDATION] Validating ${mockName}:`, {
        hasObject: !!mockObject,
        objectType: typeof mockObject,
        constructorName: mockObject?.constructor?.name,
        timestamp: new Date().toISOString()
      });

      for (const method of expectedMethods) {
        const hasMethod = typeof mockObject?.[method] === 'function';
        if (!hasMethod) {
          const availableMethods = Object.getOwnPropertyNames(mockObject || {})
            .filter(prop => typeof mockObject[prop] === 'function');
          
          throw new Error(`Mock validation failed: ${mockName}.${method} not found. Available methods: ${availableMethods.join(', ')}`);
        }
      }
      
      console.error(`[MOCK-VALIDATION] ✓ ${mockName} validation successful`);
      return true;
    };

    // PHASE 1: VALIDATE CRITICAL MOCK METHODS
    validateMock(mocks.mockProjectManagement, ['requireActiveProject'], 'mockProjectManagement');
    validateMock(mocks.mockDataPersistence, ['loadProjectData', 'saveProjectData'], 'mockDataPersistence');

    // PHASE 1: MEMORY MONITORING - Track test execution memory usage
    const memoryBefore = process.memoryUsage();
    
    // PHASE 1: MOCK INTEGRITY MONITORING - Log mock state before test execution
    console.error('[MOCK-STATE] Pre-execution mock state:', {
      projectManagementType: typeof mocks.mockProjectManagement,
      projectManagementMethods: Object.getOwnPropertyNames(mocks.mockProjectManagement)
        .filter(prop => typeof mocks.mockProjectManagement[prop] === 'function'),
      requireActiveProjectType: typeof mocks.mockProjectManagement.requireActiveProject,
      timestamp: new Date().toISOString()
    });
    
    const htaBuilder = new HtaTreeBuilder(
      mocks.mockDataPersistence,
      mocks.mockProjectManagement,
      { generateCompletion: jest.fn().mockResolvedValue('Generated HTA content') }
    );

    // PHASE 1: ERROR CONTEXT CAPTURE - Wrap execution to capture state on failure
    let result;
    try {
      result = await htaBuilder.buildHTATree('main-path');
    } catch (error) {
      // PHASE 1: DETAILED ERROR CONTEXT
      const errorContext = {
        errorMessage: error.message,
        errorStack: error.stack,
        mockState: {
          projectManagementExists: !!mocks.mockProjectManagement,
          requireActiveProjectExists: typeof mocks.mockProjectManagement?.requireActiveProject === 'function',
          mockCalls: mocks.mockProjectManagement.requireActiveProject?.mock?.calls || 'no mock calls'
        },
        memoryAtError: process.memoryUsage(),
        timestamp: new Date().toISOString()
      };
      
      console.error('[TEST-ERROR] Full error context:', errorContext);
      throw new Error(`Test execution failed with context: ${JSON.stringify(errorContext, null, 2)}`);
    }

    // PHASE 1: MEMORY MONITORING COMPLETION
    const memoryAfter = process.memoryUsage();
    const memoryDelta = memoryAfter.heapUsed - memoryBefore.heapUsed;
    
    console.error('[MEMORY-USAGE] Test memory consumption:', {
      memoryDelta: Math.round(memoryDelta / 1024) + 'KB',
      totalHeapUsed: Math.round(memoryAfter.heapUsed / 1024 / 1024) + 'MB'
    });
    
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should return an error when the project has no goal', async () => {
    await testHarness.setupCompleteSystemState();
    const mocks = testHarness.createComprehensiveMocks();
    
    // PHASE 1: MOCK INTEGRITY VALIDATION - Ensure mocks maintain integrity throughout test
    const validateMockIntegrity = () => {
      const integrity = {
        projectManagementExists: !!mocks.mockProjectManagement,
        requireActiveProjectType: typeof mocks.mockProjectManagement?.requireActiveProject,
        dataPersistenceExists: !!mocks.mockDataPersistence,
        loadProjectDataType: typeof mocks.mockDataPersistence?.loadProjectData,
        timestamp: new Date().toISOString()
      };
      
      console.error('[MOCK-INTEGRITY] Current mock state:', integrity);
      
      return integrity.projectManagementExists && 
             integrity.requireActiveProjectType === 'function' &&
             integrity.dataPersistenceExists &&
             integrity.loadProjectDataType === 'function';
    };

    // PHASE 1: INITIAL INTEGRITY CHECK
    if (!validateMockIntegrity()) {
      throw new Error('Initial mock integrity validation failed');
    }
    
    mocks.mockDataPersistence.loadProjectData.mockResolvedValue({
      projectId: 'test-project-001',
      // No goal
    });

    // PHASE 1: INTEGRITY CHECK AFTER MOCK SETUP
    if (!validateMockIntegrity()) {
      throw new Error('Mock integrity validation failed after setup');
    }
    
    const htaBuilder = new HtaTreeBuilder(
      mocks.mockDataPersistence,
      mocks.mockProjectManagement,
      { generateCompletion: jest.fn().mockResolvedValue('Generated content') }
    );

    // PHASE 1: FINAL INTEGRITY CHECK BEFORE EXECUTION
    if (!validateMockIntegrity()) {
      throw new Error('Mock integrity validation failed before execution');
    }

    const result = await htaBuilder.buildHTATree('main-path');
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('goal');
  });
});

describe('System Resilience Validation', () => {
  it('should validate the system can recover from various failure scenarios', async () => {
    const testHarness = createIntegrationTestHarness();
    
    try {
      await testHarness.setupCompleteSystemState();
      const mocks = testHarness.createComprehensiveMocks();
      
      // PHASE 1: COMPREHENSIVE MOCK VALIDATION WITH DEBUGGING
      const performMockValidation = (scenario) => {
        console.error(`[MOCK-VALIDATION-${scenario}] Validating mock objects:`, {
          projectManagement: {
            exists: !!mocks.mockProjectManagement,
            requireActiveProjectType: typeof mocks.mockProjectManagement?.requireActiveProject,
            requireActiveProjectCalls: mocks.mockProjectManagement?.requireActiveProject?.mock?.calls?.length || 0
          },
          dataPersistence: {
            exists: !!mocks.mockDataPersistence,
            loadProjectDataType: typeof mocks.mockDataPersistence?.loadProjectData,
            loadProjectDataCalls: mocks.mockDataPersistence?.loadProjectData?.mock?.calls?.length || 0
          },
          timestamp: new Date().toISOString()
        });
      };

      // PHASE 1: MEMORY MONITORING DURING TEST EXECUTION
      const memoryBefore = process.memoryUsage();
      
      performMockValidation('INITIAL');
      
      // Test scenario 1: Database connection failure
      mocks.mockDataPersistence.loadProjectData.mockRejectedValueOnce(new Error('Database connection lost'));
      mocks.mockDataPersistence.loadProjectData.mockResolvedValue(testHarness.mockState.projectConfig);
      
      performMockValidation('AFTER_SCENARIO_1_SETUP');
      
      // Test scenario 2: Network timeout
      mocks.mockProjectManagement.requireActiveProject.mockRejectedValueOnce(new Error('Network timeout'));
      mocks.mockProjectManagement.requireActiveProject.mockResolvedValue('test-project-001');
      
      performMockValidation('AFTER_SCENARIO_2_SETUP');

      // PHASE 1: ERROR CONTEXT CAPTURE - Monitor for mock corruption during failures
      const mockCorruptionDetector = () => {
        const corruptionCheck = {
          projectManagementLost: !mocks.mockProjectManagement,
          requireActiveProjectLost: typeof mocks.mockProjectManagement?.requireActiveProject !== 'function',
          dataPersistenceLost: !mocks.mockDataPersistence,
          loadProjectDataLost: typeof mocks.mockDataPersistence?.loadProjectData !== 'function',
          timestamp: new Date().toISOString()
        };
        
        const hasCorruption = Object.values(corruptionCheck).some(v => v === true);
        if (hasCorruption) {
          console.error('[MOCK-CORRUPTION] Detected mock corruption:', corruptionCheck);
        }
        
        return !hasCorruption;
      };

      // System should handle these failures gracefully
      if (!mockCorruptionDetector()) {
        throw new Error('Mock corruption detected before test server creation');
      }
      
      const testServer = await testHarness.createTestServerInstance();
      expect(testServer).toBeDefined();

      // PHASE 1: MEMORY MONITORING COMPLETION
      const memoryAfter = process.memoryUsage();
      const memoryDelta = memoryAfter.heapUsed - memoryBefore.heapUsed;
      
      console.error('[RESILIENCE-TEST-MEMORY] Test memory usage:', {
        memoryDelta: Math.round(memoryDelta / 1024) + 'KB',
        resourcePressure: memoryDelta > 10 * 1024 * 1024 ? 'HIGH' : 'NORMAL'
      });

      performMockValidation('FINAL');
      
    } finally {
      testHarness.cleanup();
    }
  });
}); 
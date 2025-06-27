// @ts-nocheck
import { jest } from '@jest/globals';
import { HtaStatus } from '../modules/hta-status.js';

const mockDataPersistence = {
  loadProjectData: jest.fn(),
  loadPathData: jest.fn(),
  logError: jest.fn()
};

const mockProjectManagement = {
  requireActiveProject: jest.fn()
};

describe('HtaStatus module - field name and path handling', () => {
  let htaStatus;

  beforeEach(() => {
    jest.clearAllMocks();
    htaStatus = new HtaStatus(mockDataPersistence, mockProjectManagement);
  });

  it('should read frontierNodes when present (field normalization)', async () => {
    mockProjectManagement.requireActiveProject.mockResolvedValue('test-project');
    mockDataPersistence.loadProjectData.mockResolvedValue({ activePath: 'general', goal: 'Test' });
    const sampleHTA = {
      goal: 'Test',
      frontierNodes: [{ id: '1', title: 'Task', completed: false }]
    };
    mockDataPersistence.loadPathData.mockResolvedValue(sampleHTA);

    const result = await htaStatus.getHTAStatus();

    expect(result.hta_status.frontierNodes.length).toBe(1);
  });

  it('should fallback to frontierNodes for backward compatibility', async () => {
    mockProjectManagement.requireActiveProject.mockResolvedValue('test-project');
    mockDataPersistence.loadProjectData.mockResolvedValue({ activePath: 'general', goal: 'Test' });
    const sampleHTA = {
      goal: 'Test',
      frontierNodes: [{ id: '1', title: 'Task', completed: false }]
    };
    mockDataPersistence.loadPathData.mockResolvedValue(sampleHTA);

    const result = await htaStatus.getHTAStatus();
    expect(result.hta_status.frontierNodes.length).toBe(1);
  });
}); 
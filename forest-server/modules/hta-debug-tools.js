/**
 * HTA Debug Tools Module
 * Specialized debugging utilities for the HTA tree pipeline
 */

import { FileSystem } from './utils/file-system.js';
import { getForestLogger } from './winston-logger.js';

const logger = getForestLogger({ module: 'HTADebugTools' });

export class HTADebugTools {
  constructor(forestServer) {
    this.forestServer = forestServer;
    this.dataPersistence = forestServer.dataPersistence;
  }

  /**
   * Comprehensive HTA pipeline validation
   * Tests the entire flow from build to task selection
   */
  async validateHTAPipeline(projectId, pathName = 'general') {
    const report = {
      timestamp: new Date().toISOString(),
      projectId,
      pathName,
      stages: {
        projectSetup: { status: 'pending', details: {} },
        htaBuild: { status: 'pending', details: {} },
        dataStorage: { status: 'pending', details: {} },
        dataRetrieval: { status: 'pending', details: {} },
        taskSelection: { status: 'pending', details: {} }
      },
      overallStatus: 'pending',
      recommendations: []
    };

    try {
      // Stage 1: Project Setup Validation
      report.stages.projectSetup = await this.validateProjectSetup(projectId);

      // Stage 2: HTA Build Validation
      if (report.stages.projectSetup.status === 'success') {
        report.stages.htaBuild = await this.validateHTABuild(projectId, pathName);
      }

      // Stage 3: Data Storage Validation
      if (report.stages.htaBuild.status === 'success') {
        report.stages.dataStorage = await this.validateDataStorage(projectId, pathName);
      }

      // Stage 4: Data Retrieval Validation
      if (report.stages.dataStorage.status === 'success') {
        report.stages.dataRetrieval = await this.validateDataRetrieval(projectId, pathName);
      }

      // Stage 5: Task Selection Validation
      if (report.stages.dataRetrieval.status === 'success') {
        report.stages.taskSelection = await this.validateTaskSelection(projectId);
      }

      // Generate overall status and recommendations
      this.generateRecommendations(report);

      return report;

    } catch (error) {
      report.overallStatus = 'error';
      report.error = error.message;
      logger.error('HTA pipeline validation failed', { error: error.message, projectId, pathName });
      return report;
    }
  }

  /**
   * Validate project setup and configuration
   */
  async validateProjectSetup(projectId) {
    const stage = { status: 'pending', details: {} };

    try {
      // Check if project exists
      const config = await this.dataPersistence.loadProjectData(projectId, 'config.json');
      if (!config) {
        stage.status = 'error';
        stage.error = 'Project configuration not found';
        return stage;
      }

      stage.details.config = {
        goal: config.goal,
        knowledgeLevel: config.knowledge_level,
        activePath: config.activePath
      };

      // Check project directory structure
      const projectDir = FileSystem.join(this.dataPersistence.dataDir, 'projects', projectId);
      const pathsDir = FileSystem.join(projectDir, 'paths');
      
      stage.details.directories = {
        projectExists: await FileSystem.exists(projectDir),
        pathsExists: await FileSystem.exists(pathsDir)
      };

      stage.status = 'success';
      return stage;

    } catch (error) {
      stage.status = 'error';
      stage.error = error.message;
      return stage;
    }
  }

  /**
   * Validate HTA tree building process
   */
  async validateHTABuild(projectId, pathName) {
    const stage = { status: 'pending', details: {} };

    try {
      // Attempt to build HTA tree
      const buildResult = await this.forestServer.buildHTATree(pathName, 'mixed', []);
      
      stage.details.buildResult = {
        success: buildResult.success,
        branchCount: buildResult.branches?.length || 0,
        taskCount: buildResult.total_tasks || 0
      };

      if (!buildResult.success) {
        stage.status = 'error';
        stage.error = 'HTA tree build failed';
        return stage;
      }

      stage.status = 'success';
      return stage;

    } catch (error) {
      stage.status = 'error';
      stage.error = error.message;
      return stage;
    }
  }

  /**
   * Validate data storage and file persistence
   */
  async validateDataStorage(projectId, pathName) {
    const stage = { status: 'pending', details: {} };

    try {
      // Check if HTA file was created
      const htaPath = FileSystem.join(
        this.dataPersistence.dataDir,
        'projects',
        projectId,
        'paths',
        pathName,
        'hta.json'
      );

      const htaExists = await FileSystem.exists(htaPath);
      stage.details.htaFileExists = htaExists;

      if (!htaExists) {
        stage.status = 'error';
        stage.error = 'HTA file not created';
        return stage;
      }

      // Validate HTA file structure
      const htaContent = await FileSystem.readFile(htaPath, 'utf8');
      const htaData = JSON.parse(htaContent);

      stage.details.htaStructure = {
        hasGoal: !!htaData.goal,
        hasBranches: Array.isArray(htaData.branches) && htaData.branches.length > 0,
        hasFrontierNodes: Array.isArray(htaData.frontier_nodes) && htaData.frontier_nodes.length > 0,
        hasMetadata: !!htaData.hierarchy_metadata
      };

      // Validate node structure
      if (htaData.frontier_nodes) {
        const nodeValidation = this.validateNodeStructure(htaData.frontier_nodes);
        stage.details.nodeValidation = nodeValidation;
      }

      stage.status = 'success';
      return stage;

    } catch (error) {
      stage.status = 'error';
      stage.error = error.message;
      return stage;
    }
  }

  /**
   * Validate data retrieval from storage
   */
  async validateDataRetrieval(projectId, pathName) {
    const stage = { status: 'pending', details: {} };

    try {
      // Test loading HTA data
      const htaData = await this.forestServer.loadPathHTA(projectId, pathName);
      
      if (!htaData) {
        stage.status = 'error';
        stage.error = 'Failed to load HTA data';
        return stage;
      }

      stage.details.loadedData = {
        hasGoal: !!htaData.goal,
        branchCount: htaData.branches?.length || 0,
        nodeCount: htaData.frontier_nodes?.length || 0,
        cacheHit: !!this.dataPersistence.cacheManager?.get(`hta_${projectId}_${pathName}`)
      };

      stage.status = 'success';
      return stage;

    } catch (error) {
      stage.status = 'error';
      stage.error = error.message;
      return stage;
    }
  }

  /**
   * Validate task selection process
   */
  async validateTaskSelection(projectId) {
    const stage = { status: 'pending', details: {} };

    try {
      // Test getting next task
      const taskResult = await this.forestServer.getNextTask(5, '45 minutes');
      
      stage.details.taskSelection = {
        success: taskResult.success !== false,
        hasTask: !!taskResult.selected_task,
        taskTitle: taskResult.selected_task?.title,
        isGeneric: this.isGenericTask(taskResult.selected_task?.title)
      };

      if (!taskResult.selected_task) {
        stage.status = 'warning';
        stage.warning = 'No task selected - may need more tasks generated';
        return stage;
      }

      if (stage.details.taskSelection.isGeneric) {
        stage.status = 'warning';
        stage.warning = 'Generic task title detected - quality may be low';
        return stage;
      }

      stage.status = 'success';
      return stage;

    } catch (error) {
      stage.status = 'error';
      stage.error = error.message;
      return stage;
    }
  }

  /**
   * Validate individual node structure
   */
  validateNodeStructure(nodes) {
    const validation = {
      totalNodes: nodes.length,
      validNodes: 0,
      issues: []
    };

    for (const node of nodes) {
      let isValid = true;

      if (!node.id) {
        validation.issues.push(`Node missing ID: ${node.title || 'Unknown'}`);
        isValid = false;
      }

      if (!node.title || typeof node.title !== 'string') {
        validation.issues.push(`Node missing/invalid title: ${node.id || 'Unknown'}`);
        isValid = false;
      }

      if (!node.branch) {
        validation.issues.push(`Node missing branch: ${node.title || node.id || 'Unknown'}`);
        isValid = false;
      }

      if (isValid) {
        validation.validNodes++;
      }
    }

    validation.validationRate = validation.totalNodes > 0 ? 
      (validation.validNodes / validation.totalNodes) * 100 : 0;

    return validation;
  }

  /**
   * Check if a task title is generic/low quality
   */
  isGenericTask(title) {
    if (!title || typeof title !== 'string') return true;

    const genericPatterns = [
      /^learn more about/i,
      /^explore/i,
      /^research/i,
      /^study/i,
      /^understand/i,
      /^familiarize/i
    ];

    return genericPatterns.some(pattern => pattern.test(title.trim()));
  }

  /**
   * Generate recommendations based on validation results
   */
  generateRecommendations(report) {
    const recommendations = [];
    let successCount = 0;

    // Count successful stages
    for (const [stageName, stage] of Object.entries(report.stages)) {
      if (stage.status === 'success') successCount++;
    }

    // Overall status
    if (successCount === 5) {
      report.overallStatus = 'success';
      recommendations.push('HTA pipeline is fully functional');
    } else if (successCount >= 3) {
      report.overallStatus = 'partial';
      recommendations.push('HTA pipeline partially functional - some issues detected');
    } else {
      report.overallStatus = 'failure';
      recommendations.push('HTA pipeline has significant issues requiring attention');
    }

    // Specific recommendations
    if (report.stages.projectSetup.status === 'error') {
      recommendations.push('Fix project configuration and directory structure');
    }

    if (report.stages.htaBuild.status === 'error') {
      recommendations.push('Check HTA tree builder for generation issues');
    }

    if (report.stages.dataStorage.status === 'error') {
      recommendations.push('Verify file system permissions and data persistence layer');
    }

    if (report.stages.dataRetrieval.status === 'error') {
      recommendations.push('Clear caches and check data loading mechanisms');
    }

    if (report.stages.taskSelection.status === 'error') {
      recommendations.push('Review task intelligence and selection algorithms');
    }

    report.recommendations = recommendations;
  }
}

/**
 * Project Management Module
 * Handles project creation, switching, and lifecycle management
 */

import path from 'path';
import fs from 'fs';

export class ProjectManagement {
  /**
   * @param {*} dataPersistence
   * @param {*} memorySync
   */
  constructor(dataPersistence, memorySync) {
    this.dataPersistence = dataPersistence;
    this.memorySync = memorySync;
    this.activeProject = null;
    this.ensureGlobalConfig();
  }

  /**
   * Ensure the global config.json file exists and is valid. Repairs or recreates if missing/corrupted.
   */
  ensureGlobalConfig() {
    const globalConfigPath = path.join(this.dataPersistence.dataDir, 'config.json');
    let needsRepair = false;
    // Always use both properties for globalData
    let globalData = { projects: [], activeProject: null };
    try {
      if (fs.existsSync(globalConfigPath)) {
        try {
          const data = fs.readFileSync(globalConfigPath, 'utf8');
          const parsed = JSON.parse(data);
          if (!Array.isArray(parsed.projects) || typeof parsed.activeProject === 'undefined') {
            needsRepair = true;
          } else {
            globalData = { projects: parsed.projects, activeProject: parsed.activeProject };
          }
        } catch (err) { // eslint-disable-line no-unused-vars
          needsRepair = true;
        }
      } else {
        needsRepair = true;
      }
    } catch (err) { // eslint-disable-line no-unused-vars
      needsRepair = true;
    }
    if (needsRepair) {
      try {
        fs.writeFileSync(globalConfigPath, JSON.stringify(globalData, null, 2));
        if (this.dataPersistence && this.dataPersistence.logger && this.dataPersistence.logger.warn) {
          this.dataPersistence.logger.warn('Global config.json was missing or corrupted and has been repaired.', { path: globalConfigPath, globalData });
        }
      } catch (err) { // eslint-disable-line no-unused-vars
        if (this.dataPersistence && this.dataPersistence.logger && this.dataPersistence.logger.error) {
          this.dataPersistence.logger.error('Failed to repair global config.json', { error: err && err.message, path: globalConfigPath });
        }
      }
    }
  }

  // Helper to safely stringify errors
  toStringError(error) {
    if (!error) return 'Unknown error';
    if (typeof error === 'string') return error;
    if (typeof error === 'object' && error !== null) {
      if ('message' in error && typeof error.message === 'string') return error.message;
      return JSON.stringify(error);
    }
    return String(error);
  }

  async createProject(args) {
    try {
      const {
        project_id,
        goal,
        specific_interests = [],
        learning_paths = [],
        context = '',
        constraints = {},
        existing_credentials = [],
        current_habits = {},
        life_structure_preferences,
        urgency_level = 'medium',
        success_metrics = [],
      } = args;

      if (!project_id || !goal || !life_structure_preferences) {
        const missing = [];
        if (!project_id) {
          missing.push('project_id');
        }
        if (!goal) {
          missing.push('goal');
        }
        if (!life_structure_preferences) {
          missing.push('life_structure_preferences');
        }
        throw new Error(
          `Missing required fields for project creation: ${missing.join(', ')}. Please provide all required fields.`
        );
      }

      // Calculate knowledge boost from existing credentials
      const { knowledgeLevel, skillMappings } = this.calculateKnowledgeBoost(
        existing_credentials,
        goal
      );

      const projectConfig = {
        id: project_id,
        goal,
        specific_interests,
        learning_paths:
          learning_paths.length > 0 ? learning_paths : [{ path_name: 'general', priority: 'high' }],
        context,
        constraints,
        existing_credentials,
        current_habits,
        life_structure_preferences,
        urgency_level,
        success_metrics,
        created_at: new Date().toISOString(),
        knowledge_level: knowledgeLevel,
        skill_mappings: skillMappings,
        progress: 0,
        activePath: learning_paths.length > 0 ? learning_paths[0].path_name : 'general',
      };

      // Begin transaction for atomic project creation
      const transaction = this.dataPersistence.beginTransaction();

      try {
        // Save project configuration
        await this.dataPersistence.saveProjectData(
          project_id,
          'config.json',
          projectConfig,
          transaction
        );

        // Update global configuration
        const globalConfigPath = path.join(this.dataPersistence.dataDir, 'config.json');
        let globalData = { projects: [], activeProject: null };
        try {
          if (fs.existsSync(globalConfigPath)) {
            globalData = JSON.parse(fs.readFileSync(globalConfigPath, 'utf8'));
          }
        } catch (err) {
          if (this.dataPersistence && this.dataPersistence.logger && this.dataPersistence.logger.error) {
            this.dataPersistence.logger.error('Failed to read global config, initializing new one', { error: err.message });
          }
        }
        if (!globalData.projects.includes(project_id)) {
          globalData.projects.push(project_id);
        }
        globalData.activeProject = project_id;
        try {
          fs.writeFileSync(globalConfigPath, JSON.stringify(globalData, null, 2));
          if (this.dataPersistence && this.dataPersistence.logger && this.dataPersistence.logger.info) {
            this.dataPersistence.logger.info('Global config updated', { path: globalConfigPath, globalData });
          }
        } catch (err) {
          if (this.dataPersistence && this.dataPersistence.logger && this.dataPersistence.logger.error) {
            this.dataPersistence.logger.error('Failed to write global config', { error: err.message, path: globalConfigPath });
          }
          throw new Error('Critical: Could not write global config file. Project state may be lost.');
        }

        // Commit transaction
        await this.dataPersistence.commitTransaction(transaction);
      } catch (error) {
        // Rollback on failure
        await this.dataPersistence.rollbackTransaction(transaction);
        throw error;
      }

      // Set as active project
      this.activeProject = project_id;

      // Sync to memory
      const memoryData = await this.memorySync.syncActiveProjectToMemory(project_id);

      return {
        success: true,
        content: [
          {
            type: 'text',
            text:
              `Project "${project_id}" created successfully!\n\n` +
              `**Goal**: ${goal}\n` +
              `**Knowledge Level**: ${knowledgeLevel}/10\n` +
              `**Learning Paths**: ${(learning_paths.map(function(p) { return p.path_name; }).join(', ')) || 'general'}\n` +
              `**Focus Duration**: ${(life_structure_preferences && life_structure_preferences.focus_duration) || 'flexible'}\n` +
              `**Wake Time**: ${(life_structure_preferences && life_structure_preferences.wake_time) || 'not specified'}\n\n` +
              'Ready to build HTA tree and start learning!',
          },
        ],
        project_created: projectConfig,
        forest_memory_sync: memoryData,
      };
    } catch (error) {
      if (this.dataPersistence && typeof this.dataPersistence.logError === 'function') {
        this.dataPersistence.logError('createProject', error, args);
      }
      var errorMsg = this.toStringError(error);
      return {
        success: false,
        content: [
          {
            type: 'text',
            text: `Error creating project: ${errorMsg}`,
          },
        ],
      };
    }
  }

  async switchProject(projectId) {
    try {
      const config = await this.dataPersistence.loadProjectData(projectId, 'config.json');
      if (!config) {
        throw new Error(`Project "${projectId}" not found`);
      }

      // Begin transaction for project switch
      const transaction = this.dataPersistence.beginTransaction();

      try {
        // Update global configuration
        const globalConfigPath = path.join(this.dataPersistence.dataDir, 'config.json');
        let globalData = { projects: [], activeProject: null };
        try {
          if (fs.existsSync(globalConfigPath)) {
            globalData = JSON.parse(fs.readFileSync(globalConfigPath, 'utf8'));
          }
        } catch (err) {
          if (this.dataPersistence && this.dataPersistence.logger && this.dataPersistence.logger.error) {
            this.dataPersistence.logger.error('Failed to read global config, initializing new one', { error: err.message });
          }
        }
        globalData.activeProject = projectId;
        try {
          fs.writeFileSync(globalConfigPath, JSON.stringify(globalData, null, 2));
          if (this.dataPersistence && this.dataPersistence.logger && this.dataPersistence.logger.info) {
            this.dataPersistence.logger.info('Global config updated', { path: globalConfigPath, globalData });
          }
        } catch (err) {
          if (this.dataPersistence && this.dataPersistence.logger && this.dataPersistence.logger.error) {
            this.dataPersistence.logger.error('Failed to write global config', { error: err.message, path: globalConfigPath });
          }
          throw new Error('Critical: Could not write global config file. Project state may be lost.');
        }

        // Commit transaction
        await this.dataPersistence.commitTransaction(transaction);
      } catch (error) {
        // Rollback on failure
        await this.dataPersistence.rollbackTransaction(transaction);
        throw error;
      }

      // Set as active project
      this.activeProject = projectId;

      // Sync to memory
      const memoryData = await this.memorySync.syncActiveProjectToMemory(projectId);

      return {
        content: [
          {
            type: 'text',
            text:
              `Switched to project: **${projectId}**\n\n` +
              `**Goal**: ${config.goal}\n` +
              `**Progress**: ${config.progress || 0}%\n` +
              `**Active Path**: ${config.activePath || 'general'}\n\n` +
              'Project context loaded and synced to memory!',
          },
        ],
        active_project: config,
        forest_memory_sync: memoryData,
      };
    } catch (error) {
      await this.dataPersistence.logError('switchProject', error, { projectId });
      return {
        content: [
          {
            type: 'text',
            text: `Error switching project: ${error.message}`,
          },
        ],
      };
    }
  }

  async listProjects() {
    try {
      const globalData = (await this.dataPersistence.loadGlobalData('config.json')) || {
        projects: [],
      };
      const activeProject = globalData.activeProject;

      if (globalData.projects.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: '📂 No projects found. Create your first project to get started!',
            },
          ],
        };
      }

      let projectList = '📂 **Available Projects:**\n\n';

      // Load all project configs in parallel for better performance
      const projectConfigs = await Promise.all(
        globalData.projects.map(async projectId => {
          const config = await this.dataPersistence.loadProjectData(projectId, 'config.json');
          return { projectId, config };
        })
      );

      for (const { projectId, config } of projectConfigs) {
        const isActive = projectId === activeProject ? ' **ACTIVE**' : '';
        const progress = config?.progress || 0;

        projectList += `• **${projectId}**${isActive}\n`;
        projectList += `  Goal: ${config?.goal || 'Unknown'}\n`;
        projectList += `  Progress: ${progress}%\n\n`;
      }

      return {
        content: [
          {
            type: 'text',
            text: projectList,
          },
        ],
        projects: globalData.projects,
        active_project: activeProject,
      };
    } catch (error) {
      await this.dataPersistence.logError('listProjects', error);
      return {
        content: [
          {
            type: 'text',
            text: `Error listing projects: ${error.message}`,
          },
        ],
      };
    }
  }

  async getActiveProject() {
    try {
      const globalData = (await this.dataPersistence.loadGlobalData('config.json')) || {};
      const activeProjectId = globalData.activeProject;

      if (!activeProjectId) {
        return {
          content: [
            {
              type: 'text',
              text: 'No active project. Use `create_project` or `switch_project` first.',
            },
          ],
        };
      }

      const config = await this.dataPersistence.loadProjectData(activeProjectId, 'config.json');
      if (!config) {
        return {
          content: [
            {
              type: 'text',
              text: `Active project "${activeProjectId}" configuration not found.`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: 'text',
            text:
              `**Active Project**: ${activeProjectId}\n\n` +
              `**Goal**: ${config.goal}\n` +
              `**Context**: ${config.context || 'Not specified'}\n` +
              `**Knowledge Level**: ${config.knowledge_level || 'Unknown'}/10\n` +
              `**Active Path**: ${config.activePath || 'general'}\n` +
              `**Schedule**: ${config.life_structure_preferences?.wake_time || 'Flexible'} - ${config.life_structure_preferences?.sleep_time || 'Flexible'}`,
          },
        ],
        active_project: config,
      };
    } catch (error) {
      await this.dataPersistence.logError('getActiveProject', error);
      return {
        content: [
          {
            type: 'text',
            text: `Error getting active project: ${error.message}`,
          },
        ],
      };
    }
  }

  async requireActiveProject() {
    const globalData = (await this.dataPersistence.loadGlobalData('config.json')) || {};
    const activeProjectId = globalData.activeProject;

    if (!activeProjectId) {
      throw new Error(
        'No active project available. Use create_project to create a new project or switch_project to activate an existing one.'
      );
    }

    this.activeProject = activeProjectId;
    return activeProjectId;
  }

  calculateKnowledgeBoost(existingCredentials, goal) {
    let knowledgeLevel = 1; // Base level
    const skillMappings = {};

    for (const credential of existingCredentials) {
      const relevanceScore = this.assessRelevance(credential, goal);
      const levelBoost = this.getLevelBoost(credential.level);

      knowledgeLevel += relevanceScore * levelBoost;

      if (relevanceScore > 0.3) {
        skillMappings[credential.subject_area] = {
          level: credential.level,
          relevance: relevanceScore,
          boost: relevanceScore * levelBoost,
        };
      }
    }

    return {
      knowledgeLevel: Math.min(knowledgeLevel, 10), // Cap at 10
      skillMappings,
    };
  }

  assessRelevance(credential, goal) {
    const goalLower = goal.toLowerCase();
    const subjectLower = credential.subject_area.toLowerCase();
    const relevanceLower = (credential.relevance_to_goal || '').toLowerCase();

    // Direct subject match
    if (goalLower.includes(subjectLower) || subjectLower.includes(goalLower)) {
      return 1.0;
    }

    // High relevance stated
    if (relevanceLower.includes('directly related') || relevanceLower.includes('very relevant')) {
      return 0.8;
    }

    // Medium relevance
    if (relevanceLower.includes('somewhat') || relevanceLower.includes('partially')) {
      return 0.5;
    }

    // Check for common skill overlaps
    const skillOverlaps = this.mapCredentialsToSkills(credential.subject_area, goal);
    return skillOverlaps;
  }

  getLevelBoost(level) {
    const levelLower = level.toLowerCase();
    if (levelLower.includes('expert') || levelLower.includes('advanced')) {
      return 2.0;
    }
    if (levelLower.includes('intermediate')) {
      return 1.5;
    }
    if (levelLower.includes('beginner')) {
      return 1.0;
    }
    return 1.2; // Default for unspecified
  }

  mapCredentialsToSkills(subjectArea, goal) {
    const subjectLower = subjectArea.toLowerCase();
    const goalLower = goal.toLowerCase();

    // Technology overlaps
    if (
      (subjectLower.includes('computer') || subjectLower.includes('programming')) &&
      goalLower.includes('web')
    ) {
      return 0.7;
    }

    // Business overlaps
    if (subjectLower.includes('business') && goalLower.includes('entrepreneur')) {
      return 0.6;
    }

    // Creative overlaps
    if (subjectLower.includes('art') && goalLower.includes('design')) {
      return 0.6;
    }

    // Music overlaps
    if (subjectLower.includes('music') && goalLower.includes('music')) {
      return 0.9;
    }

    return 0.1; // Minimal overlap
  }
}

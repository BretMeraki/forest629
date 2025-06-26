/**
 * Project Management Module
 * Handles project creation, switching, and lifecycle management
 */

// @ts-nocheck

export class ProjectManagement {
  constructor(dataPersistence, memorySync) {
    this.dataPersistence = dataPersistence;
    this.memorySync = memorySync;
    this.activeProject = null;
  }

  async createProject(args) {
    try {
      // PHASE 1: ENHANCED ARGUMENT VALIDATION - Fix schema mismatch
      let {
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

      // ---- PHASE 1: AUTO-GENERATION AND DEFAULTS --------------------------------
      
      // Auto-generate project_id if not provided
      if (!project_id) {
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
        const goalSlug = goal ? goal.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20) : 'project';
        project_id = `${goalSlug}_${timestamp}`;
      }

      // Validate required goal field
      if (!goal || typeof goal !== 'string' || goal.trim().length === 0) {
        throw new Error(
          `Missing or invalid 'goal' field. Please provide a clear, specific goal for your project. ` +
          `Example: "Learn piano to play jazz standards" or "Build a personal portfolio website"`
        );
      }

      // Apply sensible defaults for life_structure_preferences if not provided
      if (!life_structure_preferences || typeof life_structure_preferences !== 'object') {
        life_structure_preferences = {
          wake_time: '07:00',
          sleep_time: '23:00',
          focus_duration: 'flexible',
          break_preferences: 'natural breaks every 90 minutes',
          transition_time: '5 minutes'
        };
      } else {
        // Fill in missing sub-fields with defaults
        const defaults = {
          wake_time: '07:00',
          sleep_time: '23:00',
          focus_duration: 'flexible',
          break_preferences: 'natural breaks every 90 minutes',
          transition_time: '5 minutes'
        };
        
        life_structure_preferences = { ...defaults, ...life_structure_preferences };
      }

      // ---- PHASE 1: ENHANCED VALIDATION WITH SPECIFIC ERROR MESSAGES -----------
      
      // Validate life_structure_preferences structure
      const requiredPrefs = ['wake_time', 'sleep_time'];
      const prefsMissing = requiredPrefs.filter(p => !life_structure_preferences[p]);

      if (prefsMissing.length > 0) {
        throw new Error(
          `Missing required life structure preferences: ${prefsMissing.join(', ')}. ` +
          `Expected format: { "wake_time": "07:00", "sleep_time": "23:00" }. ` +
          `Received: ${JSON.stringify(life_structure_preferences)}`
        );
      }

      // NEW: Enhanced time format parsing to accept multiple formats
      try {
        life_structure_preferences.wake_time = this.parseTimeFormat(life_structure_preferences.wake_time);
      } catch (timeError) {
        throw new Error(
          `Invalid wake_time format: "${life_structure_preferences.wake_time}". ` +
          `${timeError.message}. ` +
          `Accepted formats: "7:00 AM", "07:00", "7:00", "11:00 PM"`
        );
      }
      
      try {
        life_structure_preferences.sleep_time = this.parseTimeFormat(life_structure_preferences.sleep_time);
      } catch (timeError) {
        throw new Error(
          `Invalid sleep_time format: "${life_structure_preferences.sleep_time}". ` +
          `${timeError.message}. ` +
          `Accepted formats: "7:00 AM", "07:00", "7:00", "11:00 PM"`
        );
      }

      // Validate other fields
      if (specific_interests && !Array.isArray(specific_interests)) {
        throw new Error(
          `Invalid 'specific_interests' field: expected array, got ${typeof specific_interests}. ` +
          `Example: ["play Let It Be on piano", "build a personal website"]`
        );
      }

      if (learning_paths && !Array.isArray(learning_paths)) {
        throw new Error(
          `Invalid 'learning_paths' field: expected array, got ${typeof learning_paths}. ` +
          `Example: [{"path_name": "piano", "priority": "high"}]`
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

      // Save project configuration
      await this.dataPersistence.saveProjectData(project_id, 'config.json', projectConfig);

      // Update global configuration
      const globalData = (await this.dataPersistence.loadGlobalData('config.json')) || {
        projects: [],
      };
      if (!globalData.projects.includes(project_id)) {
        globalData.projects.push(project_id);
      }
      globalData.activeProject = project_id;
      await this.dataPersistence.saveGlobalData('config.json', globalData);

      // Set as active project
      this.activeProject = project_id;

      // Sync to memory
      const memoryData = await this.memorySync.syncActiveProjectToMemory(project_id);

      return {
        content: [
          {
            type: 'text',
            text:
              `🎯 Project "${project_id}" created successfully!\n\n` +
              `**Goal**: ${goal}\n` +
              `**Knowledge Level**: ${knowledgeLevel}/10\n` +
              `**Learning Paths**: ${learning_paths.map(p => p.path_name).join(', ') || 'general'}\n` +
              `**Focus Duration**: ${life_structure_preferences.focus_duration || 'flexible'}\n` +
              `**Schedule**: ${life_structure_preferences.wake_time} - ${life_structure_preferences.sleep_time}\n` +
              `**Auto-generated ID**: ${project_id === args.project_id ? 'No' : 'Yes'}\n\n` +
              '✅ Ready to build HTA tree and start learning!',
          },
        ],
        project_created: projectConfig,
        forest_memory_sync: memoryData,
      };
    } catch (error) {
      // PHASE 1: ENHANCED ERROR REPORTING - Provide specific guidance
      let enhancedError = error;
      
      if (error.message.includes('Missing required fields')) {
        enhancedError = new Error(
          `${error.message}\n\n` +
          `📋 **Quick Fix**: Ensure you provide these required fields:\n` +
          `• goal: "Your learning objective" (required)\n` +
          `• life_structure_preferences: { "wake_time": "07:00", "sleep_time": "23:00" } (auto-generated if not provided)\n` +
          `• project_id: Will be auto-generated if not provided\n\n` +
          `💡 **Example**:\n` +
          `{\n` +
          `  "goal": "Learn to play jazz piano",\n` +
          `  "life_structure_preferences": {\n` +
          `    "wake_time": "07:00",\n` +
          `    "sleep_time": "23:00"\n` +
          `  }\n` +
          `}`
        );
      }
      
      await this.dataPersistence.logError('createProject', enhancedError, args);
      return {
        content: [
          {
            type: 'text',
            text: `Error creating project: ${enhancedError.message}`,
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

      // Update global configuration
      const globalData = (await this.dataPersistence.loadGlobalData('config.json')) || {};
      globalData.activeProject = projectId;
      await this.dataPersistence.saveGlobalData('config.json', globalData);

      // Set as active project
      this.activeProject = projectId;

      // Sync to memory
      const memoryData = await this.memorySync.syncActiveProjectToMemory(projectId);

      return {
        content: [
          {
            type: 'text',
            text:
              `🔄 Switched to project: **${projectId}**\n\n` +
              `**Goal**: ${config.goal}\n` +
              `**Progress**: ${config.progress || 0}%\n` +
              `**Active Path**: ${config.activePath || 'general'}\n\n` +
              '✅ Project context loaded and synced to memory!',
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
        const isActive = projectId === activeProject ? ' 🎯 **ACTIVE**' : '';
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
              text: '❌ No active project. Use `create_project` or `switch_project` first.',
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
              text: `❌ Active project "${activeProjectId}" configuration not found.`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: 'text',
            text:
              `🎯 **Active Project**: ${activeProjectId}\n\n` +
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
        '🚫 **No active project found**. Forest operates on a project-first workflow:\n\n' +
        '1. Use `create_project` to start a new learning project with your goal.\n' +
        '2. Or use `switch_project` to activate an existing one from `list_projects`.\n' +
        '\nTip: After creating or switching, run `build_hta_tree` to generate your learning roadmap.'
      );
    }

    this.activeProject = activeProjectId;
    return activeProjectId;
  }

  /**
   * Parse various time formats and convert to 24-hour HH:MM format
   * @param {string} timeString - Time in various formats
   * @returns {string} Time in 24-hour HH:MM format
   */
  parseTimeFormat(timeString) {
    if (!timeString || typeof timeString !== 'string') {
      throw new Error('Time must be a string');
    }

    const trimmed = timeString.trim();
    
    // Check for AM/PM format (e.g., "7:00 AM", "11:00 PM")
    const amPmMatch = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (amPmMatch) {
      let hours = parseInt(amPmMatch[1]);
      const minutes = amPmMatch[2];
      const period = amPmMatch[3].toUpperCase();
      
      // Convert to 24-hour format
      if (period === 'AM') {
        if (hours === 12) hours = 0; // 12:00 AM = 00:00
      } else { // PM
        if (hours !== 12) hours += 12; // Don't change 12:00 PM
      }
      
      return `${hours.toString().padStart(2, '0')}:${minutes}`;
    }
    
    // Check for 24-hour format (e.g., "07:00", "23:00") 
    const fullMatch = trimmed.match(/^(\d{1,2}):(\d{2})$/);
    if (fullMatch) {
      const hours = parseInt(fullMatch[1]);
      const minutes = parseInt(fullMatch[2]);
      
      // Validate ranges
      if (hours < 0 || hours > 23) {
        throw new Error(`Hours must be between 0-23, got ${hours}`);
      }
      if (minutes < 0 || minutes > 59) {
        throw new Error(`Minutes must be between 0-59, got ${minutes}`);
      }
      
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
    
    // Check for hour-only format (e.g., "7", "23")
    const hourMatch = trimmed.match(/^(\d{1,2})$/);
    if (hourMatch) {
      const hours = parseInt(hourMatch[1]);
      if (hours < 0 || hours > 23) {
        throw new Error(`Hours must be between 0-23, got ${hours}`);
      }
      return `${hours.toString().padStart(2, '0')}:00`;
    }
    
    throw new Error(
      `Invalid time format. Expected formats: "7:00 AM", "11:00 PM", "07:00", "23:00", or "7"`
    );
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

  /**
   * Provide first-time users with clear guidance on how to get started based on
   * their current project state.
   * @returns {Promise<{hasProjects:boolean,message:string,suggestedAction:string}>}
   */
  async getStartupGuidance() {
    try {
      const globalData = (await this.dataPersistence.loadGlobalData('config.json')) || {
        projects: [],
      };

      const projects = globalData.projects || [];
      const hasProjects = projects.length > 0;

      if (!hasProjects) {
        return {
          hasProjects: false,
          message: 'Welcome! Start by defining your first project so Forest knows your goal.',
          suggestedAction: 'create_project',
        };
      }

      if (!globalData.activeProject) {
        return {
          hasProjects: true,
          message: 'You have existing projects, but none is active right now.',
          suggestedAction: 'switch_project',
        };
      }

      return {
        hasProjects: true,
        message: `Active project: ${globalData.activeProject}. You are ready to build your HTA tree or get next tasks.`,
        suggestedAction: 'build_hta_tree',
      };
    } catch (_err) {
      return {
        hasProjects: false,
        message: 'Unable to determine startup state. Please try creating a new project.',
        suggestedAction: 'create_project',
      };
    }
  }

  /**
   * Update the activePath for the current active project so that all modules reference the same learning path.
   * @param {string} pathName - The path name to set as active.
   */
  async updateActivePath(pathName) {
    try {
      if (!pathName || typeof pathName !== 'string') {
        throw new Error('pathName must be a non-empty string');
      }

      const projectId = await this.requireActiveProject();
      const config = await this.dataPersistence.loadProjectData(projectId, 'config.json');

      if (!config) {
        throw new Error(`Project configuration not found for project '${projectId}'`);
      }

      // No change required
      if (config.activePath === pathName) {
        return { updated: false };
      }

      config.activePath = pathName;
      config.lastUpdated = new Date().toISOString();

      await this.dataPersistence.saveProjectData(projectId, 'config.json', config);

      // Sync to memory so that reasoning modules have latest context
      if (this.memorySync && typeof this.memorySync.syncActiveProjectToMemory === 'function') {
        await this.memorySync.syncActiveProjectToMemory(projectId);
      }

      return { updated: true, activePath: pathName };
    } catch (error) {
      await this.dataPersistence.logError('updateActivePath', error, { pathName });
      return { updated: false, error: String(error) };
    }
  }
}

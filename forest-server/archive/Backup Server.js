#!/usr/bin/env node

/**
 * Forest MCP Server v2 - Life Orchestration Engine with Intelligent Sequencing
 * Enhanced with context awareness, dynamic adaptation, and completion feedback loops
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs/promises";
import path from "path";
// import { fileURLToPath } from 'url'; // Reserved for future use
import os from "os";
import http from "http";

// Resolve directory of this file and set repository root (one level up from forest-server)
// const __filename = fileURLToPath(import.meta.url); // Reserved for future use
// const __dirname = path.dirname(__filename); // Reserved for future use

const ENABLE_HTTP_API = true; // Set to false to disable HTTP API

class ForestServer {
  constructor() {
    this.server = new Server(
      {
        name: "forest-server",
        version: "2.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );
    // Decide on a guaranteed-writable data directory.
    // 1. If FOREST_DATA_DIR is set, use that.
    // 2. Otherwise default to ~/.forest-data (cross-platform writable location).
    this.dataDir = process.env.FOREST_DATA_DIR
      ? path.resolve(process.env.FOREST_DATA_DIR)
      : path.join(os.homedir(), ".forest-data");
    this.activeProject = null;
    this.setupHandlers();
    // Lightweight ClaudeInterface wrapper for contextual intelligence requests
    this.claudeInterface = {
      requestIntelligence: async (type, payload) => ({
        request_for_claude: { type, payload },
      }),
    };
  }

  setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      // Define the full list once so we can also publish it through the initial
      // MCP capabilities handshake (Cursor shows 0 tools if we don't do this).
      const toolDefs = [
        {
          name: "create_project",
          description:
            "Create comprehensive life orchestration project with detailed personal context",
          inputSchema: {
            type: "object",
            properties: {
              project_id: {
                type: "string",
                description:
                  'Unique project identifier (e.g. "dream_project_alpha")',
              },
              goal: {
                type: "string",
                description:
                  "Ultimate ambitious goal (what you want to achieve)",
              },
              specific_interests: {
                type: "array",
                items: { type: "string" },
                description:
                  'Optional: Specific things you want to be able to do (e.g. "play Let It Be on piano", "build a personal website"). Leave empty if you\'re not sure yet - the system will help you discover interests.',
              },
              learning_paths: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    path_name: {
                      type: "string",
                      description:
                        'Name of the learning path (e.g. "saxophone", "piano", "theory")',
                    },
                    interests: {
                      type: "array",
                      items: { type: "string" },
                      description: "Specific interests for this path",
                    },
                    priority: {
                      type: "string",
                      enum: ["high", "medium", "low"],
                      description: "Relative priority of this path",
                    },
                  },
                  required: ["path_name"],
                },
                description:
                  "Optional: Define separate learning paths within your goal for isolated focus (e.g. separate piano and saxophone paths)",
              },
              context: {
                type: "string",
                description:
                  "Current life situation and why this goal matters now",
              },
              constraints: {
                type: "object",
                properties: {
                  time_constraints: {
                    type: "string",
                    description:
                      "Available time slots, busy periods, commitments",
                  },
                  energy_patterns: {
                    type: "string",
                    description:
                      "When you have high/low energy, physical limitations",
                  },
                  focus_variability: {
                    type: "string",
                    description:
                      'How your focus and attention vary (e.g. "consistent daily", "varies with interest", "unpredictable energy levels")',
                  },
                  financial_constraints: {
                    type: "string",
                    description:
                      "Budget limitations affecting learning resources",
                  },
                  location_constraints: {
                    type: "string",
                    description:
                      "Home setup, workspace limitations, travel requirements",
                  },
                },
              },
              existing_credentials: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    credential_type: {
                      type: "string",
                      description: "Degree, certificate, course, etc.",
                    },
                    subject_area: {
                      type: "string",
                      description: "What field/subject",
                    },
                    level: {
                      type: "string",
                      description: "Beginner, intermediate, advanced, expert",
                    },
                    relevance_to_goal: {
                      type: "string",
                      description: "How this relates to your new goal",
                    },
                  },
                },
                description:
                  "All existing education, certificates, and relevant experience",
              },
              current_habits: {
                type: "object",
                properties: {
                  good_habits: {
                    type: "array",
                    items: { type: "string" },
                    description:
                      "Existing positive habits to maintain/build on",
                  },
                  bad_habits: {
                    type: "array",
                    items: { type: "string" },
                    description: "Habits you want to replace or minimize",
                  },
                  habit_goals: {
                    type: "array",
                    items: { type: "string" },
                    description:
                      "New habits you want to build alongside learning",
                  },
                },
              },
              life_structure_preferences: {
                type: "object",
                properties: {
                  wake_time: {
                    type: "string",
                    description: 'Preferred wake time (e.g. "6:00 AM")',
                  },
                  sleep_time: {
                    type: "string",
                    description: 'Preferred sleep time (e.g. "10:30 PM")',
                  },
                  meal_times: {
                    type: "array",
                    items: { type: "string" },
                    description: "Preferred meal schedule",
                  },
                  break_preferences: {
                    type: "string",
                    description: "How often and what type of breaks you need",
                  },
                  focus_duration: {
                    type: "string",
                    description:
                      'Preferred focus session length (e.g. "25 minutes", "2 hours", "until natural break", "flexible", "variable")',
                  },
                  transition_time: {
                    type: "string",
                    description: "Time needed between activities",
                  },
                },
              },
              urgency_level: {
                type: "string",
                enum: ["low", "medium", "high", "critical"],
                description: "How urgently you need to achieve this goal",
              },
              success_metrics: {
                type: "array",
                items: { type: "string" },
                description:
                  "How you will measure success (income, job offers, portfolio pieces, etc.)",
              },
            },
            required: ["project_id", "goal", "life_structure_preferences"],
          },
        },
        {
          name: "switch_project",
          description: "Switch to a different project workspace",
          inputSchema: {
            type: "object",
            properties: {
              project_id: {
                type: "string",
                description: "Project to switch to",
              },
            },
            required: ["project_id"],
          },
        },
        {
          name: "list_projects",
          description: "Show all project workspaces",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
        {
          name: "get_active_project",
          description: "Show current active project",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
        {
          name: "build_hta_tree",
          description:
            "Build strategic HTA framework for a specific learning path",
          inputSchema: {
            type: "object",
            properties: {
              path_name: {
                type: "string",
                description:
                  'Learning path to build HTA tree for (e.g. "saxophone", "piano"). If not specified, builds for active path or general project.',
              },
              learning_style: {
                type: "string",
                description:
                  "Preferred learning approach (visual, hands-on, research-based, etc.)",
              },
              focus_areas: {
                type: "array",
                items: { type: "string" },
                description: "Specific areas to prioritize in the strategy",
              },
            },
          },
        },
        {
          name: "get_hta_status",
          description: "View HTA strategic framework for active project",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
        {
          name: "generate_daily_schedule",
          description:
            "ON-DEMAND: Generate comprehensive gap-free daily schedule when requested by user",
          inputSchema: {
            type: "object",
            properties: {
              date: {
                type: "string",
                description: "YYYY-MM-DD, defaults to today",
              },
              energy_level: {
                type: "number",
                minimum: 1,
                maximum: 5,
                description:
                  "Current energy level (affects task difficulty and timing)",
              },
              available_hours: {
                type: "string",
                description:
                  'Comma-separated list of hours to prioritize (e.g. "9,10,11,14,15")',
              },
              focus_type: {
                type: "string",
                enum: ["learning", "building", "networking", "habits", "mixed"],
                description: "Type of work to prioritize today",
              },
              schedule_request_context: {
                type: "string",
                description:
                  'User context about why they need a schedule now (e.g. "planning tomorrow", "need structure today")',
              },
            },
          },
        },
        {
          name: "complete_block",
          description:
            "Complete time block and capture insights for active project",
          inputSchema: {
            type: "object",
            properties: {
              block_id: {
                type: "string",
              },
              outcome: {
                type: "string",
                description: "What happened? Key insights?",
              },
              learned: {
                type: "string",
                description: "What specific knowledge or skills did you gain?",
              },
              next_questions: {
                type: "string",
                description:
                  "What questions emerged? What do you need to learn next?",
              },
              energy_level: {
                type: "number",
                minimum: 1,
                maximum: 5,
                description: "Energy after completion",
              },
              difficulty_rating: {
                type: "number",
                minimum: 1,
                maximum: 5,
                description:
                  "How difficult was this task? (1=too easy, 5=too hard)",
              },
              breakthrough: {
                type: "boolean",
                description: "Major insight or breakthrough?",
              },
            },
            required: ["block_id", "outcome", "energy_level"],
          },
        },
        {
          name: "complete_with_opportunities",
          description:
            "Complete time block with rich context capture for impossible dream orchestration - use when significant breakthroughs, unexpected results, or external opportunities emerge",
          inputSchema: {
            type: "object",
            properties: {
              block_id: {
                type: "string",
                description: "The block being completed",
              },
              outcome: {
                type: "string",
                description: "What happened? Key insights?",
              },
              learned: {
                type: "string",
                description: "What specific knowledge or skills did you gain?",
              },
              energy_level: {
                type: "number",
                minimum: 1,
                maximum: 5,
                description: "Energy after completion",
              },
              engagement_level: {
                type: "number",
                minimum: 1,
                maximum: 10,
                description:
                  "How deeply engaged were you? (10 = totally absorbed, lost track of time)",
              },
              unexpected_results: {
                type: "array",
                items: { type: "string" },
                description:
                  "What unexpected things happened or were discovered?",
              },
              new_skills_revealed: {
                type: "array",
                items: { type: "string" },
                description:
                  "What hidden talents or natural abilities did this reveal?",
              },
              external_feedback: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    source: {
                      type: "string",
                      description: "Who gave feedback",
                    },
                    content: { type: "string", description: "What they said" },
                    sentiment: {
                      type: "string",
                      enum: ["positive", "negative", "neutral"],
                    },
                  },
                },
                description: "Any feedback from others about your work",
              },
              social_reactions: {
                type: "array",
                items: { type: "string" },
                description:
                  "Social media reactions, shares, comments, viral moments",
              },
              viral_potential: {
                type: "boolean",
                description:
                  "Does this work have viral potential or unusual appeal?",
              },
              industry_connections: {
                type: "array",
                items: { type: "string" },
                description:
                  "Any industry professionals who showed interest or made contact",
              },
              serendipitous_events: {
                type: "array",
                items: { type: "string" },
                description:
                  "Lucky coincidences, chance meetings, unexpected opportunities",
              },
            },
            required: [
              "block_id",
              "outcome",
              "energy_level",
              "engagement_level",
            ],
          },
        },
        {
          name: "current_status",
          description:
            "Show todays progress and next action for active project",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
        {
          name: "evolve_strategy",
          description:
            "Analyze patterns and evolve the approach for active project",
          inputSchema: {
            type: "object",
            properties: {
              feedback: {
                type: "string",
                description:
                  "What's working? What's not? What needs to change?",
              },
            },
          },
        },
        {
          name: "generate_tiimo_export",
          description: "Export today's schedule as Tiimo-compatible markdown",
          inputSchema: {
            type: "object",
            properties: {
              include_breaks: {
                type: "boolean",
                default: true,
                description: "Include break blocks between tasks",
              },
            },
          },
        },
        {
          name: "analyze_performance",
          description:
            "Analyze historical data to discover your personal productivity patterns.",
          inputSchema: { type: "object", properties: {} },
        },
        {
          name: "review_week",
          description:
            "Summarize the last 7 days of progress, breakthroughs, and challenges.",
          inputSchema: { type: "object", properties: {} },
        },
        {
          name: "review_month",
          description:
            "Provide a high-level monthly report of your progress towards the North Star.",
          inputSchema: { type: "object", properties: {} },
        },
        {
          name: "get_next_task",
          description:
            "Get the single most logical next task based on current progress and context",
          inputSchema: {
            type: "object",
            properties: {
              context_from_memory: {
                type: "string",
                description:
                  "Optional context retrieved from Memory MCP about recent progress/insights",
              },
              energy_level: {
                type: "number",
                minimum: 1,
                maximum: 5,
                description:
                  "Current energy level to match appropriate task difficulty",
              },
              time_available: {
                type: "string",
                description:
                  'Time available for the task (e.g. "30 minutes", "1 hour")',
              },
            },
          },
        },
        {
          name: "sync_forest_memory",
          description:
            "Sync current Forest state to memory for context awareness",
          inputSchema: { type: "object", properties: {} },
        },
        {
          name: "debug_task_sequence",
          description:
            "Debug task sequencing issues - shows prerequisite chains and task states",
          inputSchema: { type: "object", properties: {} },
        },
        {
          name: "repair_sequence",
          description:
            "Fix broken task sequencing by rebuilding the frontier with proper dependencies",
          inputSchema: {
            type: "object",
            properties: {
              force_rebuild: {
                type: "boolean",
                description:
                  "Completely rebuild the task sequence from scratch",
              },
            },
          },
        },
        {
          name: "focus_learning_path",
          description:
            'Set focus to a specific learning path within the project (e.g. "saxophone", "piano", "theory")',
          inputSchema: {
            type: "object",
            properties: {
              path_name: {
                type: "string",
                description:
                  'Name of the learning path to focus on (e.g. "saxophone", "piano", "web development")',
              },
              duration: {
                type: "string",
                description:
                  'How long to focus on this path (e.g. "today", "this week", "until next switch")',
              },
            },
            required: ["path_name"],
          },
        },
        {
          name: "analyze_complexity_evolution",
          description:
            "Analyze the current complexity tier and scaling opportunities for infinite growth potential",
          inputSchema: { type: "object", properties: {} },
        },
        {
          name: "analyze_identity_transformation",
          description:
            "Analyze current identity and generate micro-shifts toward target professional identity",
          inputSchema: { type: "object", properties: {} },
        },
        {
          name: "list_learning_paths",
          description:
            "Show all available learning paths in the current project",
          inputSchema: { type: "object", properties: {} },
        },
        {
          name: "analyze_reasoning",
          description:
            "Generate logical deductions and strategic insights from completion patterns",
          inputSchema: {
            type: "object",
            properties: {
              include_detailed_analysis: {
                type: "boolean",
                default: true,
                description:
                  "Include detailed logical chains and pattern analysis",
              },
            },
          },
        },
      ];

      // Expose tools in the handshake exactly once (before the transport
      // connects, constructor already ran `setupHandlers`).
      if (Object.keys(this.server.capabilities.tools).length === 0) {
        this.server.capabilities.tools = Object.fromEntries(
          toolDefs.map((t) => [t.name, t]),
        );
      }

      return { tools: toolDefs };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;

        switch (name) {
          case "create_project":
            return await this.createProject(args);
          case "switch_project":
            return await this.switchProject(args.project_id);
          case "list_projects":
            return await this.listProjects();
          case "get_active_project":
            return await this.getActiveProject();
          case "build_hta_tree":
            return await this.buildHTATree(
              args.path_name,
              args.learning_style || "mixed",
              args.focus_areas || [],
            );
          case "get_hta_status":
            return await this.getHTAStatus();
          case "generate_daily_schedule":
            return await this.generateDailySchedule(
              args.date || null,
              args.energy_level ?? 3,
              args.available_hours || null,
              args.focus_type || "mixed",
              args.schedule_request_context || "User requested schedule",
            );
          case "complete_block":
            return await this.completeBlock(
              args.block_id,
              args.outcome,
              args.learned || "",
              args.next_questions || "",
              args.energy_level,
              args.difficulty_rating || 3,
              args.breakthrough || false,
            );
          case "complete_with_opportunities":
            return await this.completeBlock(
              args.block_id,
              args.outcome,
              args.learned || "",
              args.next_questions || "",
              args.energy_level,
              args.difficulty_rating || 3,
              args.breakthrough || false,
              // OPPORTUNITY DETECTION CONTEXT
              args.engagement_level || 5,
              args.unexpected_results || [],
              args.new_skills_revealed || [],
              args.external_feedback || [],
              args.social_reactions || [],
              args.viral_potential || false,
              args.industry_connections || [],
              args.serendipitous_events || [],
            );
          case "get_next_task":
            return await this.getNextTask(
              args.context_from_memory || "",
              args.energy_level || 3,
              args.time_available || "30 minutes",
            );
          case "current_status":
            return await this.currentStatus();
          case "evolve_strategy":
            return await this.evolveStrategy(args.feedback || "");
          case "generate_tiimo_export":
            return await this.generateTiimoExport(args.include_breaks ?? true);
          case "analyze_performance":
            return await this.analyzePerformance();
          case "review_week":
            return await this.reviewPeriod(7);
          case "review_month":
            return await this.reviewPeriod(30);
          case "sync_forest_memory":
            return await this.syncForestMemory();
          case "debug_task_sequence":
            return await this.debugTaskSequence();
          case "repair_sequence":
            return await this.repairSequence(args.force_rebuild || false);
          case "focus_learning_path":
            return await this.focusLearningPath(
              args.path_name,
              args.duration || "until next switch",
            );
          case "list_learning_paths":
            return await this.listLearningPaths();
          case "analyze_complexity_evolution":
            return await this.analyzeComplexityEvolution();
          case "analyze_identity_transformation":
            return await this.analyzeIdentityTransformation();
          case "analyze_reasoning":
            return await this.analyzeReasoning(
              args.include_detailed_analysis ?? true,
            );
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error.message}`,
            },
          ],
        };
      }
    });
  }

  getProjectDir(projectId) {
    return path.join(this.dataDir, "projects", projectId);
  }

  getPathDir(projectId, pathName) {
    return path.join(this.dataDir, "projects", projectId, "paths", pathName);
  }

  async loadProjectData(projectId, filename) {
    try {
      const filePath = path.join(this.getProjectDir(projectId), filename);
      const data = await fs.readFile(filePath, "utf8");
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  async saveProjectData(projectId, filename, data) {
    const projectDir = this.getProjectDir(projectId);
    const filePath = path.join(projectDir, filename);
    try {
      await fs.mkdir(projectDir, { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
      return true;
    } catch (saveError) {
      await this.logError("saveProjectData", saveError, {
        projectId,
        filename,
      });
      return false;
    }
  }

  async loadPathData(projectId, pathName, filename) {
    try {
      const pathDir = this.getPathDir(projectId, pathName);
      const filePath = path.join(pathDir, filename);
      const data = await fs.readFile(filePath, "utf8");
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  async savePathData(projectId, pathName, filename, data) {
    const pathDir = this.getPathDir(projectId, pathName);
    const filePath = path.join(pathDir, filename);
    try {
      await fs.mkdir(pathDir, { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
      return true;
    } catch (saveError) {
      await this.logError("savePathData", saveError, {
        projectId,
        pathName,
        filename,
      });
      return false;
    }
  }

  async loadGlobalData(filename) {
    try {
      const filePath = path.join(this.dataDir, filename);
      const data = await fs.readFile(filePath, "utf8");
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  async saveGlobalData(filename, data) {
    const filePath = path.join(this.dataDir, filename);
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
      return true;
    } catch (saveError) {
      await this.logError("saveGlobalData", saveError, { filename });
      return false;
    }
  }

  // Persist detailed error information for easier troubleshooting
  async logError(operation, error, context = {}) {
    try {
      const logEntry = {
        timestamp: new Date().toISOString(),
        operation,
        error: error.message,
        stack: error.stack,
        context,
      };

      const logPath = path.join(this.dataDir, "error.log");
      const logLine = JSON.stringify(logEntry) + "\n";

      await fs.appendFile(logPath, logLine, "utf8");
    } catch (logError) {
      console.error("Failed to write to error log:", logError.message);
    }
  }

  // Memory MCP Integration - prepares comprehensive project state for memory sync
  async syncActiveProjectToMemory(projectId) {
    try {
      const projectConfig = await this.loadProjectData(
        projectId,
        "config.json",
      );
      const hta = await this.loadProjectData(projectId, "hta.json");
      const learningHistory = await this.loadProjectData(
        projectId,
        "learning_history.json",
      );
      const today = this.getTodayDate();
      const schedule = await this.loadProjectData(
        projectId,
        `day_${today}.json`,
      );

      const nextBlock = schedule?.time_blocks?.find((b) => !b.completed);
      const readyNodes =
        hta?.frontier_nodes?.filter((n) => n.status === "ready") || [];
      const completedNodes = hta?.completed_nodes || [];
      const recentTopics = learningHistory?.completed_topics?.slice(-5) || [];
      const knowledgeGaps = learningHistory?.knowledge_gaps?.slice(-3) || [];

      return {
        entity: "Forest_Learning_Progress",
        observations: [
          `Active project: ${projectId}`,
          `Learning goal: ${projectConfig?.goal || "Unknown"}`,
          `Current knowledge level: ${projectConfig?.knowledge_level || 0}%`,
          `Starting knowledge: ${projectConfig?.current_knowledge || "beginner"}`,
          `Total completed tasks: ${completedNodes.length}`,
          `Available next tasks: ${readyNodes.length}`,
          `Recent completions: ${recentTopics.map((t) => t.topic).join(", ") || "None"}`,
          `Knowledge gaps identified: ${knowledgeGaps.map((g) => g.question).join("; ") || "None"}`,
          `Current focus area: ${nextBlock?.strategic_purpose || readyNodes[0]?.branch_type || "Not set"}`,
          `Session context: ${projectConfig?.context || "No context provided"}`,
          `Constraints: ${projectConfig?.constraints || "None specified"}`,
          `Last updated: ${new Date().toISOString()}`,
        ],
        metadata: {
          project_id: projectId,
          goal: projectConfig?.goal,
          next_logical_task: readyNodes[0]?.title || "Use get_next_task",
          learning_velocity: recentTopics.length > 0 ? "active" : "starting",
          difficulty_trend: this.calculateDifficultyTrend(recentTopics),
          suggested_memory_queries: [
            `Recent progress in ${projectConfig?.goal}`,
            `Challenges with ${projectConfig?.goal} learning`,
            `Next steps for ${projectConfig?.goal} mastery`,
          ],
        },
      };
    } catch (syncError) {
      await this.logError("syncActiveProjectToMemory", syncError, {
        projectId,
      });
      return null;
    }
  }

  calculateDifficultyTrend(recentTopics) {
    if (recentTopics.length < 2) {
      return "unknown";
    }

    const recentDifficulties = recentTopics.map((t) => t.difficulty || 3);
    const avgRecent =
      recentDifficulties.reduce((a, b) => a + b, 0) / recentDifficulties.length;

    if (avgRecent > 4) {
      return "challenging";
    }
    if (avgRecent < 2) {
      return "too_easy";
    }
    return "appropriate";
  }

  // Universal goal analysis - no domain restrictions
  analyzeGoal(goal, context = "", credentials = []) {
    // Let the system analyze any goal without predetermined categories
    return {
      goal: goal,
      context: context,
      existing_knowledge: credentials,
      requires_creative_approach: true,
      timeframe: "determined_by_progress",
    };
  }

  // Exposed tool to trigger memory sync manually
  async syncForestMemory() {
    const projectId = await this.requireActiveProject();
    const memoryData = await this.syncActiveProjectToMemory(projectId);

    return {
      content: [
        {
          type: "text",
          text: `🧠 Forest Memory Sync Required:\n\nClaude should now call Memory MCP with:\n${JSON.stringify(memoryData, null, 2)}\n\nThis will maintain context awareness for sequencing.`,
        },
      ],
    };
  }

  generateId() {
    return Math.random().toString(36).substr(2, 9);
  }

  getTodayDate() {
    return new Date().toISOString().split("T")[0];
  }

  parseTime(timeStr) {
    try {
      const cleaned = timeStr.trim();

      // 24-hour format (no AM/PM suffix)
      if (!/[AP]M/i.test(cleaned)) {
        const [hStr, mStr] = cleaned.split(":");
        let hours = Number(hStr);
        const minutes = Number(mStr);
        if (Number.isNaN(hours) || Number.isNaN(minutes))
          throw new Error("Invalid time");
        if (hours === 24) hours = 0; // treat 24:00 as 00:00
        return hours * 60 + minutes;
      }

      // 12-hour format with AM/PM
      const [time, periodRaw] = cleaned.split(" ");
      const period = periodRaw.toUpperCase();
      let [hours] = time.split(":").map(Number);
      const [, minutes] = time.split(":").map(Number);

      if (period === "PM" && hours !== 12) hours += 12;
      if (period === "AM" && hours === 12) hours = 0;

      return hours * 60 + minutes;
    } catch (_err) {
      console.error(`Error parsing time: ${timeStr}`);
      return 0;
    }
  }

  formatTime(minutes) {
    try {
      const minsMod = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
      const hours = Math.floor(minsMod / 60);
      const mins = minsMod % 60;
      const period = hours >= 12 ? "PM" : "AM";
      const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
      return `${displayHours}:${mins.toString().padStart(2, "0")} ${period}`;
    } catch {
      console.error(`Error formatting time: ${minutes}`);
      return "12:00 AM";
    }
  }

  async createProject(args) {
    const {
      project_id: projectId,
      goal,
      specific_interests = [],
      learning_paths = [],
      context = "",
      constraints = {},
      existing_credentials = [],
      current_habits = {},
      life_structure_preferences = {},
      urgency_level = "medium",
      success_metrics = [],
    } = args;

    if (
      !projectId ||
      !goal ||
      !life_structure_preferences.wake_time ||
      !life_structure_preferences.sleep_time
    ) {
      throw new Error(
        "Missing required project parameters: project_id, goal, wake_time, sleep_time",
      );
    }

    const existingProject = await this.loadProjectData(
      projectId,
      "config.json",
    );
    if (existingProject) {
      throw new Error(`Project "${projectId}" already exists`);
    }

    // Calculate initial knowledge acceleration from existing credentials
    const knowledgeBoost = this.calculateKnowledgeBoost(
      existing_credentials,
      goal,
    );

    const projectConfig = {
      project_id: projectId,
      goal: goal,
      specific_interests: specific_interests,
      learning_paths: learning_paths,
      active_learning_path: null, // No path focused initially
      context: context,
      constraints: constraints,
      existing_credentials: existing_credentials,
      current_habits: current_habits,
      life_structure_preferences: life_structure_preferences,
      urgency_level: urgency_level,
      success_metrics: success_metrics,
      wake_time: life_structure_preferences.wake_time,
      sleep_time: life_structure_preferences.sleep_time,
      wake_minutes: this.parseTime(life_structure_preferences.wake_time),
      sleep_minutes: this.parseTime(life_structure_preferences.sleep_time),
      meal_times: life_structure_preferences.meal_times || [],
      focus_duration: life_structure_preferences.focus_duration || "flexible",
      break_preferences:
        life_structure_preferences.break_preferences ||
        "5 minute breaks every 25 minutes",
      transition_time:
        life_structure_preferences.transition_time || "5 minutes",
      created: new Date().toISOString(),
      total_days: 0,
      breakthroughs: 0,
      knowledge_level: knowledgeBoost, // Start higher if they have relevant credentials
      skills_acquired: [],
      credential_mapping: this.mapCredentialsToSkills(
        existing_credentials,
        goal,
      ),
    };

    const saved = await this.saveProjectData(
      projectId,
      "config.json",
      projectConfig,
    );
    if (!saved) {
      throw new Error("Failed to save project configuration");
    }

    const globalConfig = (await this.loadGlobalData("config.json")) || {
      projects: [],
      active_project: null,
    };

    if (!globalConfig.projects.includes(projectId)) {
      globalConfig.projects.push(projectId);
    }
    globalConfig.active_project = projectId;

    const globalSaved = await this.saveGlobalData("config.json", globalConfig);
    if (!globalSaved) {
      throw new Error("Failed to update global configuration");
    }

    this.activeProject = projectId;

    // Sync current state to memory system
    const memoryData = await this.syncActiveProjectToMemory(projectId);

    const sleep = projectConfig.sleep_minutes;
    const wake = projectConfig.wake_minutes;
    const totalMinutes = sleep > wake ? sleep - wake : sleep + 24 * 60 - wake;
    const totalHours = Math.round(totalMinutes / 60);
    const credentialSummary =
      existing_credentials.length > 0
        ? `\n📜 Leveraging: ${existing_credentials.map((c) => c.credential_type + " in " + c.subject_area).join(", ")}`
        : "";
    const habitSummary =
      current_habits.habit_goals?.length > 0
        ? `\n🏃 Building habits: ${current_habits.habit_goals.join(", ")}`
        : "";

    return {
      content: [
        {
          type: "text",
          text: `🌟 Comprehensive Life Project Created: "${projectId}"\n\n🎯 Goal: "${goal}"\n📍 Context: ${context}\n⚡ Urgency: ${urgency_level}\n📊 Success Metrics: ${success_metrics.join(", ")}\n⏰ Daily Structure: ${life_structure_preferences.wake_time} → ${life_structure_preferences.sleep_time} (${totalHours} hours)\n🎯 Focus Sessions: ${projectConfig.focus_duration}${credentialSummary}${habitSummary}\n📈 Starting Knowledge Level: ${knowledgeBoost}% (boosted by existing credentials)\n\n✅ Project configured for comprehensive daily orchestration!\n\n🧠 MEMORY SYNC: ${JSON.stringify(memoryData)}`,
        },
      ],
    };
  }

  calculateKnowledgeBoost(credentials, goal) {
    if (!credentials || credentials.length === 0) {
      return 0;
    }

    let boost = 0;
    const goalLower = goal.toLowerCase();

    credentials.forEach((cred) => {
      const subjectLower = cred.subject_area.toLowerCase();
      const relevance = cred.relevance_to_goal?.toLowerCase() || "";

      // Direct relevance scoring
      let relevanceScore = 0;
      if (
        goalLower.includes(subjectLower) ||
        subjectLower.includes(goalLower.split(" ")[0])
      ) {
        relevanceScore = 30; // Direct field match
      } else if (
        relevance.includes("related") ||
        relevance.includes("applicable")
      ) {
        relevanceScore = 20; // Stated relevance
      } else if (
        relevance.includes("transferable") ||
        relevance.includes("foundation")
      ) {
        relevanceScore = 15; // Foundational skills
      } else {
        relevanceScore = 5; // Generic education boost
      }

      // Level multiplier
      const levelMultiplier =
        {
          expert: 1.5,
          advanced: 1.3,
          intermediate: 1.1,
          beginner: 0.8,
        }[cred.level.toLowerCase()] || 1.0;

      boost += relevanceScore * levelMultiplier;
    });

    // Cap at 80% - never start at expert level
    return Math.min(80, Math.round(boost));
  }

  mapCredentialsToSkills(credentials, goal) {
    if (!credentials || credentials.length === 0) {
      return {};
    }

    const skillMap = {};
    const goalLower = goal.toLowerCase();

    credentials.forEach((cred) => {
      const key = `${cred.subject_area}_foundation`;
      skillMap[key] = {
        source: `${cred.credential_type} in ${cred.subject_area}`,
        level: cred.level,
        relevance: cred.relevance_to_goal,
        can_skip_basics: cred.level === "advanced" || cred.level === "expert",
        accelerated_path: goalLower.includes(cred.subject_area.toLowerCase()),
      };
    });

    return skillMap;
  }

  async switchProject(projectId) {
    const projectConfig = await this.loadProjectData(projectId, "config.json");
    if (!projectConfig) {
      throw new Error(`Project "${projectId}" not found`);
    }

    this.activeProject = projectId;

    const globalConfig = (await this.loadGlobalData("config.json")) || {
      projects: [],
      active_project: null,
    };
    globalConfig.active_project = projectId;
    await this.saveGlobalData("config.json", globalConfig);

    // Sync state to memory system
    const memoryData = await this.syncActiveProjectToMemory(projectId);

    return {
      content: [
        {
          type: "text",
          text: `🔄 Switched to project: "${projectId}"\n\n🎯 Goal: ${projectConfig.goal}\n📅 Context: ${projectConfig.context}\n📊 Knowledge Level: ${projectConfig.knowledge_level}%\n\nAll actions now focus on this goal. Use 'current_status' to see today's progress.\n\n🧠 MEMORY SYNC: ${JSON.stringify(memoryData)}`,
        },
      ],
    };
  }

  async listProjects() {
    const globalConfig = await this.loadGlobalData("config.json");
    if (
      !globalConfig ||
      !globalConfig.projects ||
      globalConfig.projects.length === 0
    ) {
      return {
        content: [
          {
            type: "text",
            text: "No projects created yet. Use create_project to start your first transformation!",
          },
        ],
      };
    }

    const projectList = [];
    for (const projectId of globalConfig.projects) {
      const config = await this.loadProjectData(projectId, "config.json");
      if (config) {
        const isActive =
          projectId === globalConfig.active_project ? " ⭐ ACTIVE" : "";
        const progress = config.knowledge_level || 0;
        projectList.push(
          `• ${projectId}: ${config.goal} (${progress}% progress)${isActive}`,
        );
      }
    }

    return {
      content: [
        {
          type: "text",
          text: `📁 Your Project Workspaces:\n\n${projectList.join("\n")}\n\nUse 'switch_project' to change focus between goals.`,
        },
      ],
    };
  }

  async getActiveProject() {
    const globalConfig = await this.loadGlobalData("config.json");
    if (!globalConfig || !globalConfig.active_project) {
      return {
        content: [
          {
            type: "text",
            text: "No active project. Use create_project or switch_project.",
          },
        ],
      };
    }

    const projectConfig = await this.loadProjectData(
      globalConfig.active_project,
      "config.json",
    );
    if (!projectConfig) {
      return {
        content: [
          {
            type: "text",
            text: "Active project not found. Use create_project or switch_project.",
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `⭐ Active Project: ${globalConfig.active_project}\n\n🎯 Goal: ${projectConfig.goal}\n📍 Context: ${projectConfig.context}\n📚 Current Knowledge: ${projectConfig.current_knowledge}\n📊 Progress: ${projectConfig.knowledge_level || 0}%\n⏰ Schedule: ${projectConfig.wake_time} → ${projectConfig.sleep_time}`,
        },
      ],
    };
  }

  async requireActiveProject() {
    const globalConfig = await this.loadGlobalData("config.json");
    if (!globalConfig || !globalConfig.active_project) {
      throw new Error(
        "No active project. Use create_project or switch_project first.",
      );
    }
    this.activeProject = globalConfig.active_project;
    return globalConfig.active_project;
  }

  async buildHTATree(pathName, learningStyle = "mixed", focusAreas = []) {
    const projectId = await this.requireActiveProject();
    const projectConfig = await this.loadProjectData(projectId, "config.json");
    if (!projectConfig) {
      throw new Error("Project configuration not found");
    }
    let targetPath = pathName;
    if (!targetPath) {
      targetPath = projectConfig.active_learning_path || "general";
    }
    let pathConfig = null;
    if (projectConfig.learning_paths) {
      pathConfig = projectConfig.learning_paths.find(
        (p) => p.path_name === targetPath,
      );
    }
    if (!pathConfig && targetPath !== "general") {
      pathConfig = {
        path_name: targetPath,
        interests: [],
        priority: "medium",
        created_dynamically: true,
      };
      if (!projectConfig.learning_paths) {
        projectConfig.learning_paths = [];
      }
      projectConfig.learning_paths.push(pathConfig);
      if (!projectConfig.active_learning_path) {
        projectConfig.active_learning_path = targetPath;
      }
      await this.saveProjectData(projectId, "config.json", projectConfig);
    }
    const learningHistory = (await this.loadPathData(
      projectId,
      targetPath,
      "learning_history.json",
    )) || {
      completed_topics: [],
      skill_levels: {},
      knowledge_gaps: [],
    };
    // Universal goal analysis - no domain restrictions
    const goalAnalysis = this.analyzeGoal(
      projectConfig.goal,
      projectConfig.context,
      projectConfig.existing_credentials,
    );
    // Generate branches and ensure they're arrays
    const generatedBranches = this.generateIntelligentBranches(
      projectConfig,
      learningHistory,
      focusAreas,
    );
    const generatedNodes = this.generateSequencedFrontierNodes(
      projectConfig,
      learningHistory,
    );

    const hta = {
      project_id: projectId,
      path_name: targetPath,
      north_star: pathConfig
        ? `${projectConfig.goal} - ${targetPath}`
        : projectConfig.goal,
      goal_type: "universal",
      unique_context: goalAnalysis.context,
      existing_knowledge: goalAnalysis.existing_knowledge,
      requires_creative_approach: goalAnalysis.requires_creative_approach,
      path_interests: pathConfig?.interests || [],
      context: projectConfig.context,
      learning_style: learningStyle,
      urgency_level: projectConfig.urgency_level,
      created: new Date().toISOString(),
      // Ensure branches and nodes are arrays
      branches: Array.isArray(generatedBranches) ? generatedBranches : [],
      frontier_nodes: Array.isArray(generatedNodes) ? generatedNodes : [],
      completed_nodes: [],
      last_evolution: new Date().toISOString(),
    };
    const saved = await this.savePathData(
      projectId,
      targetPath,
      "hta.json",
      hta,
    );
    if (!saved) {
      throw new Error("Failed to save HTA tree");
    }
    const branches = Array.isArray(hta.branches) ? hta.branches : [];
    const nodes = Array.isArray(hta.frontier_nodes) ? hta.frontier_nodes : [];

    const branchSummary =
      branches.length > 0
        ? branches
            .slice(0, 3)
            .map((b) => `• ${b?.title || "Untitled"}`)
            .join("\n")
        : "No branches available";
    const nodeSummary = nodes
      .slice(0, 3)
      .map((n) => `• ${n?.title || "Untitled"} (${n?.estimated_time || "TBD"})`)
      .join("\n");
    return {
      content: [
        {
          type: "text",
          text: `🌲 Intelligent HTA Framework Built for Path: "${targetPath}"!\n\n⭐ North Star: ${hta.north_star}\n🎯 Path Focus: ${targetPath}\n📋 Path Interests: ${hta.path_interests.join(", ") || "General exploration"}\n\n🌿 Strategic Branches:\n${branchSummary}\n\n🎯 Next Steps (properly sequenced):\n${nodeSummary}\n\n✨ This HTA tree is isolated for "${targetPath}" learning!\n💡 Use 'focus_learning_path ${targetPath}' to work on this path.`,
        },
      ],
    };
  }

  generateIntelligentBranches(projectConfig, _learningHistory, _focusAreas) {
    // Universal branch generation - adapts to ANY goal
    const goal = projectConfig.goal;
    const _context = projectConfig.context || "";
    const _interests = projectConfig.specific_interests || [];
    const credentials = projectConfig.existing_credentials || [];
    const _constraints = projectConfig.constraints || {};

    // Generate goal-agnostic strategic branches
    const universalBranches = [];

    // Branch 1: Foundation/Discovery - always needed
    universalBranches.push({
      id: this.generateId(),
      title: `${goal.split(" ").slice(0, 2).join(" ")} - Foundation Discovery`,
      description: `Explore the fundamental landscape of ${goal} and discover your natural entry points`,
      status: "active",
      priority: "critical",
      sequence: 1,
      goal_aligned: true,
    });

    // Branch 2: Hands-on Practice - universal for skill building
    universalBranches.push({
      id: this.generateId(),
      title: `${goal.split(" ").slice(0, 2).join(" ")} - Practical Application`,
      description: `Get hands-on experience and build real skills toward ${goal}`,
      status: "active",
      priority: "high",
      sequence: 2,
      goal_aligned: true,
    });

    // Branch 3: Knowledge Building - adapt to goal complexity
    universalBranches.push({
      id: this.generateId(),
      title: `${goal.split(" ").slice(0, 2).join(" ")} - Deep Learning`,
      description: `Develop comprehensive understanding and expertise in ${goal}`,
      status: "active",
      priority: "high",
      sequence: 3,
      goal_aligned: true,
    });

    // Branch 4: Connection/Community - valuable for most goals
    if (
      !goal.toLowerCase().includes("personal") &&
      !goal.toLowerCase().includes("private")
    ) {
      universalBranches.push({
        id: this.generateId(),
        title: `${goal.split(" ").slice(0, 2).join(" ")} - Community & Mentorship`,
        description: `Connect with others pursuing ${goal} and find mentors`,
        status: "future",
        priority: "medium",
        sequence: 4,
        goal_aligned: true,
      });
    }

    // Branch 5: Unique/Creative Path - leverage existing credentials if relevant
    if (credentials.length > 0) {
      const relevantCred = credentials.find(
        (c) =>
          goal.toLowerCase().includes(c.subject_area.toLowerCase()) ||
          c.relevance_to_goal?.toLowerCase().includes("related"),
      );
      if (relevantCred) {
        universalBranches.push({
          id: this.generateId(),
          title: `${goal.split(" ").slice(0, 2).join(" ")} - Unique Advantage Path`,
          description: `Leverage your ${relevantCred.subject_area} background for a unique approach to ${goal}`,
          status: "active",
          priority: "medium",
          sequence: 5,
          goal_aligned: true,
          leverages_existing: relevantCred.subject_area,
        });
      }
    }

    return universalBranches;
  }

  async generateSequencedFrontierNodes(projectConfig, learningHistory) {
    // Compose a prompt for the LLM
    const goal = projectConfig.goal;
    const context = projectConfig.context || "";
    const credentials = projectConfig.existing_credentials || [];
    const completedTopics =
      learningHistory.completed_topics?.map((t) => t.topic) || [];
    const focusDuration = projectConfig.focus_duration || "flexible";

    const prompt = `You are an expert in learning design and task analysis. Given the following user context, generate a sequenced list of actionable learning nodes (tasks) to achieve the goal. Each node should have a title, description, branch_type, estimated_time, priority, status, knowledge_level, prerequisites (array), and learning_outcomes (array). Do not use templates or generic steps—make each node specific to the user's goal and background.\n\nGoal: ${goal}\nContext: ${context}\nCredentials: ${JSON.stringify(credentials)}\nCompleted Topics: ${JSON.stringify(completedTopics)}\nFocus Duration: ${focusDuration}`;

    let nodes = await this.callClaudeForNodes(prompt);
    // Assign unique IDs to each node
    nodes = nodes.map((node) => ({ ...node, id: this.generateId() }));
    return nodes;
  }

  generatePathSpecificBranches(
    pathName,
    pathConfig,
    projectConfig,
    learningHistory,
    focusAreas,
  ) {
    const branches = [];
    const pathInterests = pathConfig?.interests || [];

    // Path-specific interest branches
    if (pathInterests.length > 0) {
      pathInterests.forEach((interest, index) => {
        branches.push({
          id: this.generateId(),
          title: `${pathName}: ${interest}`,
          description: `Master ${interest} within your ${pathName} learning path`,
          status: "active",
          priority: "critical",
          sequence: index + 1,
          path_specific: true,
        });
      });
    }

    // Universal path structure
    branches.push(
      {
        id: this.generateId(),
        title: `${pathName} Fundamentals`,
        description: `Core concepts and foundations specific to ${pathName}`,
        status: "active",
        priority: "high",
        sequence: pathInterests.length + 1,
        path_specific: true,
      },
      {
        id: this.generateId(),
        title: `${pathName} Practice & Application`,
        description: `Hands-on ${pathName} exercises and real-world application`,
        status: "active",
        priority: "high",
        sequence: pathInterests.length + 2,
        path_specific: true,
      },
      {
        id: this.generateId(),
        title: `${pathName} Advanced Techniques`,
        description: `Advanced ${pathName} skills and specialized techniques`,
        status: "future",
        priority: "medium",
        sequence: pathInterests.length + 3,
        path_specific: true,
      },
    );

    // Add custom focus areas
    if (focusAreas && focusAreas.length > 0) {
      focusAreas.forEach((area, index) => {
        branches.push({
          id: this.generateId(),
          title: `${pathName}: ${area}`,
          description: `Specialized focus on ${area} within ${pathName}`,
          status: "future",
          priority: "medium",
          sequence: branches.length + index + 1,
          path_specific: true,
        });
      });
    }

    return branches;
  }

  generatePathSpecificFrontierNodes(
    pathName,
    pathConfig,
    projectConfig,
    _learningHistory,
  ) {
    const nodes = [];
    const pathInterests = pathConfig?.interests || [];
    const focusStyle = projectConfig.focus_duration || "flexible";

    // Generate time estimates based on user's focus preference
    const getEstimatedTime = (complexity) => {
      if (
        focusStyle === "flexible" ||
        focusStyle.includes("natural") ||
        focusStyle.includes("variable")
      ) {
        return "As long as needed";
      }
      if (focusStyle.includes("25") || focusStyle.includes("pomodoro")) {
        return complexity === "simple" ? "25 minutes" : "50 minutes";
      }
      if (focusStyle.includes("hour") || focusStyle.includes("60")) {
        return complexity === "simple" ? "30-60 minutes" : "1-2 hours";
      }
      if (focusStyle.includes("deep") || focusStyle.includes("long")) {
        return complexity === "simple" ? "1-2 hours" : "2-4 hours";
      }
      return "Until natural stopping point";
    };

    // PATHWAY 1: Path has specific interests - start there
    if (pathInterests.length > 0) {
      const firstInterest = pathInterests[0];
      const interestId = this.generateId();

      nodes.push({
        id: interestId,
        title: `${pathName}: Quick Start - ${firstInterest}`,
        description: `Jump right into ${pathName} by working toward: ${firstInterest}`,
        branch_type: pathName,
        estimated_time: getEstimatedTime("simple"),
        priority: "critical",
        status: "ready",
        knowledge_level: "beginner",
        magnitude: 6,
        prerequisites: [],
        learning_outcomes: [
          `Take first steps toward ${firstInterest}`,
          `Learn ${pathName} basics through practice`,
          "Build motivation through progress",
        ],
        path_specific: true,
      });
    } else {
      // PATHWAY 2: No specific interests - gentle exploration
      const explorationId = this.generateId();
      const samplingId = this.generateId();

      nodes.push(
        {
          id: explorationId,
          title: `${pathName}: Explore Possibilities`,
          description: `Discover what's possible and interesting in ${pathName}`,
          branch_type: pathName,
          estimated_time: getEstimatedTime("simple"),
          priority: "critical",
          status: "ready",
          knowledge_level: "beginner",
          magnitude: 5,
          prerequisites: [],
          learning_outcomes: [
            `Explore ${pathName} landscape`,
            "Identify interesting areas",
            "Discover your natural starting point",
          ],
          path_specific: true,
        },
        {
          id: samplingId,
          title: `${pathName}: Try Something Basic`,
          description: `Get hands-on experience with basic ${pathName} concepts`,
          branch_type: pathName,
          estimated_time: getEstimatedTime("simple"),
          priority: "high",
          status: "ready",
          knowledge_level: "beginner",
          magnitude: 6,
          prerequisites: [explorationId],
          learning_outcomes: [
            `Get hands-on ${pathName} experience`,
            "Discover what you enjoy",
            "Build foundation skills",
          ],
          path_specific: true,
        },
      );
    }

    // Add foundational backup task
    const fundamentalsId = this.generateId();
    nodes.push({
      id: fundamentalsId,
      title: `${pathName}: Core Foundations`,
      description: `Essential ${pathName} concepts and foundational knowledge`,
      branch_type: pathName,
      estimated_time: getEstimatedTime("simple"),
      priority: pathInterests.length > 0 ? "medium" : "high",
      status: "ready",
      knowledge_level: "beginner",
      magnitude: 7,
      prerequisites: [],
      learning_outcomes: [
        `Understand ${pathName} fundamentals`,
        "Build solid foundation",
        "Prepare for advanced topics",
      ],
      path_specific: true,
    });

    return nodes;
  }

  generateLifeStructureBranches(projectConfig) {
    const branches = [
      {
        id: this.generateId(),
        title: "Daily Routine Optimization",
        description:
          "Establish and refine daily routines that support your learning goal",
        status: "active",
        priority: "high",
        sequence: 1,
        focus_areas: [
          "morning routine",
          "evening routine",
          "meal timing",
          "transition periods",
        ],
      },
      {
        id: this.generateId(),
        title: "Constraint Management",
        description:
          "Work effectively within your personal and practical constraints",
        status: "active",
        priority: "high",
        sequence: 2,
        focus_areas: [
          "time limitations",
          "energy management",
          "space optimization",
          "resource allocation",
        ],
      },
    ];

    // Add specific branches based on stated constraints
    if (projectConfig.constraints?.personal_challenges) {
      branches.push({
        id: this.generateId(),
        title: "Personal Challenge Integration",
        description:
          "Adapt learning approach to work with current personal challenges",
        status: "active",
        priority: "medium",
        sequence: 3,
        focus_areas: [
          "stress management",
          "flexibility planning",
          "backup strategies",
        ],
      });
    }

    if (projectConfig.current_habits?.bad_habits?.length > 0) {
      branches.push({
        id: this.generateId(),
        title: "Habit Replacement",
        description: "Replace limiting habits with goal-supporting behaviors",
        status: "active",
        priority: "medium",
        sequence: 4,
        focus_areas: projectConfig.current_habits.bad_habits,
      });
    }

    return branches;
  }

  generateHabitNodes(projectConfig) {
    const habitNodes = [];
    const habitGoals = projectConfig.current_habits?.habit_goals || [];
    const goodHabits = projectConfig.current_habits?.good_habits || [];

    // Create habit establishment nodes
    habitGoals.forEach((habit, index) => {
      habitNodes.push({
        id: this.generateId(),
        type: "habit_building",
        title: `Establish: ${habit}`,
        description: `Build the habit of ${habit} into your daily routine`,
        target_frequency: "daily",
        estimated_establishment_time: "21 days",
        priority: "medium",
        status: "ready",
        sequence: index + 1,
        tracking_metrics: ["consistency", "quality", "integration"],
        success_criteria: `${habit} performed daily for 7 consecutive days`,
      });
    });

    // Create habit maintenance nodes for existing good habits
    goodHabits.forEach((habit, index) => {
      habitNodes.push({
        id: this.generateId(),
        type: "habit_maintenance",
        title: `Maintain: ${habit}`,
        description: `Continue and optimize existing habit: ${habit}`,
        target_frequency: "daily",
        priority: "low",
        status: "active",
        sequence: 100 + index, // Lower priority than new habits
        tracking_metrics: ["consistency", "optimization_opportunities"],
        success_criteria: `Maintain ${habit} while integrating new learning activities`,
      });
    });

    return habitNodes;
  }

  async getHTAStatus() {
    const projectId = await this.requireActiveProject();
    const hta = await this.getActiveHTA(projectId);

    if (!hta) {
      return {
        content: [
          {
            type: "text",
            text: "No HTA tree found for this project/path. Use build_hta_tree first.",
          },
        ],
      };
    }

    const activeBranches = Array.isArray(hta.branches)
      ? hta.branches.filter((b) => b.status === "active")
      : [];
    const readyNodes = Array.isArray(hta.frontier_nodes)
      ? hta.frontier_nodes.filter((n) => n.status === "ready")
      : [];
    const completedNodes = Array.isArray(hta.completed_nodes)
      ? hta.completed_nodes
      : [];

    const branchStatus = activeBranches
      .map((b) => `• ${b.title}: ${b.priority} priority (step ${b.sequence})`)
      .join("\n");
    const frontierStatus = readyNodes
      .slice(0, 5)
      .map(
        (n) =>
          `• ${n?.title || "Untitled"} (${n?.estimated_time || "TBD"}) - ${n?.learning_outcomes?.[0] || "Learning outcome TBD"}`,
      )
      .join("\n");

    return {
      content: [
        {
          type: "text",
          text: `🌲 HTA Strategic Status: "${projectId}"\n\n⭐ North Star: ${hta.north_star}\n📚 Learning Style: ${hta.learning_style}\n\n🌿 Active Branches (${activeBranches.length}):\n${branchStatus}\n\n🎯 Ready Actions (${readyNodes.length}):\n${frontierStatus}\n\n📊 Progress: ${completedNodes.length} completed actions\n\nSystem is sequencing tasks based on your current knowledge level!`,
        },
      ],
    };
  }

  async generateDailySchedule(
    date,
    energyLevel = 3,
    availableHours = null,
    focusType = "mixed",
    requestContext = "User requested schedule",
  ) {
    const projectId = await this.requireActiveProject();
    const targetDate = date || this.getTodayDate();
    const projectConfig = await this.loadProjectData(projectId, "config.json");
    const hta = await this.getActiveHTA(projectId);
    const learningHistory = (await this.loadProjectData(
      projectId,
      "learning_history.json",
    )) || {
      completed_topics: [],
      skill_levels: {},
      knowledge_gaps: [],
    };

    if (!projectConfig) {
      throw new Error("Project configuration not found");
    }
    if (!hta) {
      throw new Error(
        "No HTA tree found for this project/path. Use build_hta_tree first.",
      );
    }

    // Create comprehensive gap-free daily schedule
    const schedule = await this.generateComprehensiveSchedule(
      projectConfig,
      hta,
      learningHistory,
      energyLevel,
      focusType,
      availableHours,
    );

    schedule.project_id = projectId;
    schedule.date = targetDate;
    schedule.created = new Date().toISOString();

    const saved = await this.saveProjectData(
      projectId,
      `day_${targetDate}.json`,
      schedule,
    );
    if (!saved) {
      throw new Error("Failed to save daily schedule");
    }

    // Sync memory with newly generated schedule
    const memoryData = await this.syncActiveProjectToMemory(projectId);

    const totalBlocks = schedule.time_blocks.length;
    const learningBlocks = schedule.time_blocks.filter(
      (b) => b.type === "learning",
    ).length;
    const habitBlocks = schedule.time_blocks.filter(
      (b) => b.type === "habit",
    ).length;
    const structureBlocks = schedule.time_blocks.filter(
      (b) => b.type === "life_structure",
    ).length;

    const schedulePreview = schedule.time_blocks
      .slice(0, 8)
      .map((block) => {
        const icon =
          {
            learning: "📚",
            habit: "🔄",
            life_structure: "🏗️",
            break: "☕",
            meal: "🍽️",
            transition: "🔄",
          }[block.type] || "📋";

        return `${block.time}: ${icon} ${block.action} (${block.duration})`;
      })
      .join("\n");

    return {
      content: [
        {
          type: "text",
          text: `📅 ON-DEMAND Daily Schedule Generated: ${targetDate}\n\n🎯 Goal: ${hta.north_star}\n⚡ Energy Level: ${energyLevel}/5\n📝 Context: ${requestContext}\n\n📊 Your Custom Structure:\n• ${totalBlocks} total blocks (no gaps!)\n• ${learningBlocks} learning blocks\n• ${habitBlocks} habit blocks\n• ${structureBlocks} life structure blocks\n\n⏰ Schedule Preview (first 8 blocks):\n${schedulePreview}\n\n✨ Schedule generated based on your current needs and constraints!\n💡 Use 'complete_block' as you work through each activity.\n🔄 Request new schedules anytime with 'generate_daily_schedule'.\n\n🧠 MEMORY SYNC: ${JSON.stringify(memoryData)}`,
        },
      ],
    };
  }

  async generateComprehensiveSchedule(
    projectConfig,
    hta,
    learningHistory,
    energyLevel,
    focusType,
    _availableHours,
  ) {
    const schedule = {
      north_star: hta.north_star,
      time_blocks: [],
      total_blocks: 0,
      completed: 0,
      energy_level: energyLevel,
      focus_type: focusType,
    };

    // Get all available components
    const learningNodes =
      hta.frontier_nodes?.filter((n) => n.status === "ready") || [];
    const habitNodes =
      hta.habit_nodes?.filter((n) => n.status === "ready") || [];
    const constraints = projectConfig.constraints || {};

    // Create time slots from wake to sleep
    const currentTime = projectConfig.wake_minutes;
    let endTime = projectConfig.sleep_minutes;

    // Handle midnight crossover - if sleep time is before wake time, it's the next day
    if (endTime <= currentTime) {
      endTime += 24 * 60; // Add 24 hours worth of minutes (1440 minutes)
    }
    const focusDuration = this.parseTimeAvailable(
      projectConfig.focus_duration || "25 minutes",
    );

    // Schedule fixed life structure first (meals, etc.)
    const fixedBlocks = this.scheduleFixedLifeStructure(
      projectConfig,
      currentTime,
      endTime,
    );

    // Fill remaining time with learning, habits, and breaks
    const timeSlots = this.createTimeSlots(currentTime, endTime, fixedBlocks);

    // Prioritize and schedule learning blocks during high-energy times
    const highEnergyPeriods = this.identifyHighEnergyPeriods(
      projectConfig,
      energyLevel,
    );
    const learningSchedule = this.scheduleLearningBlocks(
      learningNodes,
      timeSlots,
      highEnergyPeriods,
      focusDuration,
      energyLevel,
    );

    // Schedule habit blocks during natural transition times
    const habitSchedule = this.scheduleHabitBlocks(
      habitNodes,
      timeSlots,
      projectConfig,
    );

    // Fill remaining gaps with structure, breaks, and buffer time
    const structureSchedule = this.scheduleLifeStructure(
      timeSlots,
      projectConfig,
      constraints,
    );

    // Combine all schedules and sort by time
    const allBlocks = [
      ...fixedBlocks,
      ...learningSchedule,
      ...habitSchedule,
      ...structureSchedule,
    ];
    schedule.time_blocks = allBlocks.sort(
      (a, b) => this.parseTime(a.time) - this.parseTime(b.time),
    );
    schedule.total_blocks = schedule.time_blocks.length;

    return schedule;
  }

  scheduleFixedLifeStructure(projectConfig, startTime, endTime) {
    const fixedBlocks = [];
    const mealTimes = projectConfig.meal_times || ["12:00 PM", "6:00 PM"];

    mealTimes.forEach((mealTime, index) => {
      const mealMinutes = this.parseTime(mealTime);
      if (mealMinutes >= startTime && mealMinutes <= endTime - 30) {
        fixedBlocks.push({
          id: this.generateId(),
          type: "meal",
          time: this.formatTime(mealMinutes),
          duration: "30 min",
          action:
            index === 0
              ? "Lunch"
              : index === 1
                ? "Dinner"
                : `Meal ${index + 1}`,
          description: "Nourishment and mental break",
          fixed: true,
          energy_impact: "restorative",
        });
      }
    });

    return fixedBlocks;
  }

  createTimeSlots(startTime, endTime, fixedBlocks) {
    const slots = [];
    let currentTime = startTime;

    // Create slots avoiding fixed blocks
    while (currentTime < endTime) {
      const hasFixedBlock = fixedBlocks.some((block) => {
        const blockTime = this.parseTime(block.time);
        const blockDuration = this.parseTimeAvailable(block.duration);
        return (
          currentTime >= blockTime && currentTime < blockTime + blockDuration
        );
      });

      if (!hasFixedBlock) {
        slots.push({
          start: currentTime,
          formatted_time: this.formatTime(currentTime),
          available: true,
        });
      }

      currentTime += 15; // 15-minute increments
    }

    return slots;
  }

  identifyHighEnergyPeriods(projectConfig, _energyLevel) {
    // Default high-energy periods, can be customized based on energy patterns
    const morningStart = projectConfig.wake_minutes + 60; // 1 hour after wake
    const morningEnd = projectConfig.wake_minutes + 180; // 3 hours after wake
    const afternoonStart = this.parseTime("2:00 PM");
    const afternoonEnd = this.parseTime("4:00 PM");

    return [
      { start: morningStart, end: morningEnd, intensity: "high" },
      { start: afternoonStart, end: afternoonEnd, intensity: "medium" },
    ];
  }

  scheduleLearningBlocks(
    learningNodes,
    timeSlots,
    highEnergyPeriods,
    focusDuration,
    _energyLevel,
  ) {
    const learningBlocks = [];
    const availableSlots = timeSlots.filter((slot) => slot.available);

    // Prioritize high-energy periods for challenging learning
    const challengingNodes = learningNodes.filter((n) => n.magnitude >= 7);
    const easyNodes = learningNodes.filter((n) => n.magnitude < 7);

    let nodeIndex = 0;

    // Schedule challenging nodes during high-energy periods
    highEnergyPeriods.forEach((period) => {
      const periodSlots = availableSlots.filter(
        (slot) => slot.start >= period.start && slot.start <= period.end,
      );

      periodSlots.forEach((slot) => {
        if (nodeIndex < challengingNodes.length) {
          const node = challengingNodes[nodeIndex];
          learningBlocks.push({
            id: node.id,
            type: "learning",
            time: slot.formatted_time,
            duration: node.estimated_time || `${focusDuration} min`,
            action: node.title,
            description: node.description,
            strategic_purpose: node.branch_type,
            energy_type: "high-focus",
            learning_outcomes: node.learning_outcomes || [],
            magnitude: node.magnitude,
          });
          slot.available = false;
          nodeIndex++;
        }
      });
    });

    // Schedule easier nodes in remaining slots
    const remainingSlots = availableSlots.filter((slot) => slot.available);
    let easyNodeIndex = 0;

    remainingSlots.forEach((slot) => {
      if (easyNodeIndex < easyNodes.length) {
        const node = easyNodes[easyNodeIndex];
        learningBlocks.push({
          id: node.id,
          type: "learning",
          time: slot.formatted_time,
          duration: node.estimated_time || `${focusDuration} min`,
          action: node.title,
          description: node.description,
          strategic_purpose: node.branch_type,
          energy_type: "moderate",
          learning_outcomes: node.learning_outcomes || [],
          magnitude: node.magnitude,
        });
        slot.available = false;
        easyNodeIndex++;
      }
    });

    return learningBlocks;
  }

  scheduleHabitBlocks(habitNodes, timeSlots, projectConfig) {
    const habitBlocks = [];
    const availableSlots = timeSlots.filter((slot) => slot.available);

    // ENHANCED HABIT SCHEDULING: Multiple placement strategies
    const habitStrategies = this.generateHabitPlacementStrategies(
      projectConfig,
      availableSlots.length,
    );

    habitNodes.forEach((habit, _index) => {
      // Generate microsteps for this habit
      const microsteps = this.generateHabitMicrosteps(habit);

      // Place microsteps throughout the day using different strategies
      microsteps.forEach((microstep, stepIndex) => {
        const strategy = habitStrategies[stepIndex % habitStrategies.length];
        const targetSlot = this.findOptimalHabitSlot(
          availableSlots,
          strategy,
          microstep,
        );

        if (targetSlot) {
          habitBlocks.push({
            id: `${habit.id}_step_${stepIndex}`,
            type: "habit_microstep",
            time: targetSlot.formatted_time,
            duration: microstep.duration,
            action: microstep.action,
            description: microstep.description,
            habit_type: habit.type,
            microstep_level: microstep.level,
            parent_habit: habit.id,
            tracking_metrics: microstep.tracking_metrics || [],
            success_criteria: microstep.success_criteria,
            habit_stack: microstep.habit_stack,
            energy_requirement: microstep.energy_requirement,
          });
          targetSlot.available = false;
        }
      });
    });

    return habitBlocks;
  }

  scheduleLifeStructure(timeSlots, projectConfig, _constraints) {
    const structureBlocks = [];
    const availableSlots = timeSlots.filter((slot) => slot.available);
    const transitionTime = this.parseTimeAvailable(
      projectConfig.transition_time || "5 minutes",
    );

    // ENHANCED: Add micro-habits during transitions and breaks
    availableSlots.forEach((slot, index) => {
      if (index % 3 === 0 && availableSlots[index + 1]) {
        // Every 3rd slot
        // Generate context-appropriate micro-habits for this break
        const _microHabit = this.generateContextualMicroHabit(
          slot,
          index,
          projectConfig,
        );

        structureBlocks.push({
          id: this.generateId(),
          type: "break_with_microhabit",
          time: slot.formatted_time,
          duration: "10 min",
          action: "Restorative Break",
          description: "Rest, stretch, hydrate, or light movement",
          energy_impact: "restorative",
        });
        slot.available = false;
      }
    });

    // Fill remaining gaps with buffer/transition time
    const remainingSlots = timeSlots.filter((slot) => slot.available);
    remainingSlots.forEach((slot) => {
      structureBlocks.push({
        id: this.generateId(),
        type: "transition",
        time: slot.formatted_time,
        duration: `${transitionTime} min`,
        action: "Transition & Preparation",
        description:
          "Prepare for next activity, organize workspace, mindful transition",
        energy_impact: "neutral",
      });
    });

    return structureBlocks;
  }

  async completeBlock(
    blockId,
    outcome,
    learned = "",
    nextQuestions = "",
    energyLevel,
    difficultyRating = 3,
    breakthrough = false,
    // OPPORTUNITY DETECTION CONTEXT
    engagementLevel = 5,
    unexpectedResults = [],
    newSkillsRevealed = [],
    externalFeedback = [],
    socialReactions = [],
    viralPotential = false,
    industryConnections = [],
    serendipitousEvents = [],
  ) {
    const projectId = await this.requireActiveProject();
    const today = this.getTodayDate();
    const schedule = await this.loadProjectData(projectId, `day_${today}.json`);

    if (!schedule) {
      throw new Error("No schedule found for today in this project");
    }

    let block = schedule.time_blocks.find((b) => b.id === blockId);
    if (!block) {
      // Fallback: try match by action title (case-insensitive)
      block = schedule.time_blocks.find(
        (b) => b.action?.toLowerCase() === blockId.toLowerCase(),
      );
    }
    if (!block) {
      throw new Error(`Block ${blockId} not found`);
    }

    // Update block with completion data
    block.completed = new Date().toISOString();
    block.outcome = outcome;
    block.learned = learned;
    block.next_questions = nextQuestions;
    block.energy_after = energyLevel;
    block.difficulty_rating = difficultyRating;
    block.breakthrough = breakthrough;
    schedule.completed++;

    // Save updated schedule
    const saved = await this.saveProjectData(
      projectId,
      `day_${today}.json`,
      schedule,
    );
    if (!saved) {
      throw new Error("Failed to save schedule update");
    }

    // Update learning history
    const learningHistory = (await this.loadProjectData(
      projectId,
      "learning_history.json",
    )) || {
      completed_topics: [],
      skill_levels: {},
      knowledge_gaps: [],
      insights: [],
    };

    // Add this learning to history
    learningHistory.completed_topics.push({
      topic: block.action,
      date: today,
      learned: learned,
      difficulty: difficultyRating,
      breakthrough: breakthrough,
    });

    // Add new questions to knowledge gaps
    if (nextQuestions) {
      learningHistory.knowledge_gaps.push({
        question: nextQuestions,
        discovered: today,
        from_topic: block.action,
      });
    }

    // Save learning history
    await this.saveProjectData(
      projectId,
      "learning_history.json",
      learningHistory,
    );

    // Update project knowledge level
    const projectConfig = await this.loadProjectData(projectId, "config.json");
    projectConfig.knowledge_level = Math.min(
      100,
      (projectConfig.knowledge_level || 0) + 1,
    );
    if (breakthrough) {
      projectConfig.breakthroughs = (projectConfig.breakthroughs || 0) + 1;
    }
    await this.saveProjectData(projectId, "config.json", projectConfig);

    // Evolve HTA tree based on learnings
    // Create rich completion context for opportunity detection
    const completionContext = {
      engagementLevel,
      unexpectedResults,
      newSkillsRevealed,
      externalFeedback,
      socialReactions,
      viralPotential,
      industryConnections,
      serendipitousEvents,
      difficultyRating,
      breakthrough,
    };

    await this.evolveHTABasedOnLearning(
      projectId,
      block,
      learned,
      nextQuestions,
      completionContext,
    );

    const nextBlock = schedule.time_blocks.find((b) => !b.completed);
    let response = `✅ "${block.action}" completed!\n\n📝 Outcome: ${outcome}\n💡 Learned: ${learned || "No specific learnings noted"}\n❓ Next Questions: ${nextQuestions || "None identified"}\n⚡ Energy: ${energyLevel}/5\n📊 Difficulty: ${difficultyRating}/5`;

    if (breakthrough) {
      response += "\n\n🎉 BREAKTHROUGH logged! System evolving strategy...";
    }

    if (difficultyRating === 5) {
      response +=
        "\n\n⚠️ Task was very difficult. Future tasks will be adjusted.";
    } else if (difficultyRating === 1) {
      response +=
        "\n\n📈 Task was too easy. Increasing complexity for next blocks.";
    }

    if (nextBlock) {
      response += `\n\n⏭️ Next: ${nextBlock.time} - ${nextBlock.action}`;
      if (nextBlock.prerequisites?.length > 0) {
        response += `\n   Prerequisites: ✓ ${nextBlock.prerequisites.join(", ✓ ")}`;
      }
    } else {
      response += "\n\n🎉 Day complete! System learning from your progress...";
    }

    // Sync memory after block completion
    const memoryData = await this.syncActiveProjectToMemory(projectId);

    response += `\n\n🧠 MEMORY SYNC: ${JSON.stringify(memoryData)}`;

    return { content: [{ type: "text", text: response }] };
  }

  async evolveHTABasedOnLearning(
    projectId,
    completedBlock,
    learned,
    nextQuestions,
    completionContext = {},
  ) {
    const { difficultyRating = 3 } = completionContext;
    const hta = await this.getActiveHTA(projectId);
    if (!hta) {
      return;
    }

    // Move completed node to completed list
    const nodeIndex = hta.frontier_nodes.findIndex(
      (n) => n.id === completedBlock.id,
    );
    if (nodeIndex !== -1) {
      const completedNode = hta.frontier_nodes.splice(nodeIndex, 1)[0];
      completedNode.completed_date = new Date().toISOString();
      completedNode.actual_difficulty = difficultyRating;
      hta.completed_nodes.push(completedNode);
    }

    // Generate logical next steps based on what was learned
    const newTasks = [];

    // VALIDATION: Ensure incremental progression (the fix you requested)
    const validatedTasks = this.validateIncrementalProgression(
      completedBlock,
      learned,
      nextQuestions,
      projectConfig,
      completionContext,
    );
    if (validatedTasks.length > 0) {
      newTasks.push(...validatedTasks);
    } else {
      // Fallback to continuation task if validation produces no results
      const continuationTask = {
        id: this.generateId(),
        title: `Continue: Build on ${completedBlock.action}`,
        description: `Apply and extend what you learned from: ${completedBlock.action}`,
        branch_type: completedBlock.strategic_purpose || "practical",
        estimated_time: "As long as needed",
        priority: "high",
        status: "ready",
        knowledge_level: "intermediate",
        magnitude: Math.max(4, (completedBlock.magnitude || 6) - 1), // Slightly easier
        prerequisites: [completedBlock.id],
        learning_outcomes: [
          `Apply ${completedBlock.action} knowledge`,
          "Deepen understanding",
          "Build practical skills",
        ],
        generated_from: "task_completion",
      };
      newTasks.push(continuationTask);
    }

    // Add research task for questions if they exist
    if (nextQuestions) {
      const researchTask = {
        id: this.generateId(),
        title: `Research: ${nextQuestions.substring(0, 50)}...`,
        description: `Investigate: ${nextQuestions}`,
        branch_type: "research",
        estimated_time: "As long as needed",
        priority: "medium",
        status: "ready",
        knowledge_level: "intermediate",
        magnitude: 5, // Easier research task
        prerequisites: [completedBlock.id],
        learning_outcomes: [
          `Answer: ${nextQuestions}`,
          "Fill knowledge gaps",
          "Prepare for advanced topics",
        ],
        generated_from: "curiosity",
      };
      newTasks.push(researchTask);
    }

    // Dynamic Dependency Tracking - Task completion reveals new possibilities
    const completedTask = hta.completed_nodes[hta.completed_nodes.length - 1]; // Most recently completed
    const emergentOpportunities = this.detectEmergentOpportunities(
      completedTask || completedBlock,
      completionContext,
    );
    if (emergentOpportunities.length > 0) {
      newTasks.push(...emergentOpportunities);
    }

    // Adaptive Dependency Invalidation - Completed task may make others unnecessary
    hta.frontier_nodes = this.invalidateUnnecessaryTasks(
      hta.frontier_nodes,
      completedTask || completedBlock,
      completionContext,
    );

    // Add tasks to the end to maintain sequence flow
    hta.frontier_nodes.push(...newTasks);

    // Adjust difficulty of remaining nodes based on feedback
    if (difficultyRating === 5) {
      // Too hard - add easier stepping stones
      hta.frontier_nodes = hta.frontier_nodes.map((node) => ({
        ...node,
        magnitude: Math.max(3, node.magnitude - 1),
      }));
    } else if (difficultyRating === 1) {
      // Too easy - increase challenge
      hta.frontier_nodes = hta.frontier_nodes.map((node) => ({
        ...node,
        magnitude: Math.min(10, node.magnitude + 1),
      }));
    }

    hta.last_evolution = new Date().toISOString();
    const projectConfig = await this.loadProjectData(projectId, "config.json");
    const activePath = projectConfig?.active_learning_path || "general";
    const saved = await this.savePathData(
      projectId,
      activePath,
      "hta.json",
      hta,
    );
    if (!saved) {
      await this.saveProjectData(projectId, "hta.json", hta);
    }
  }

  async currentStatus() {
    const projectId = await this.requireActiveProject();
    const today = this.getTodayDate();
    const schedule = await this.loadProjectData(projectId, `day_${today}.json`);
    const projectConfig = await this.loadProjectData(projectId, "config.json");

    if (!schedule || !schedule.time_blocks) {
      return {
        content: [
          {
            type: "text",
            text: `📅 No schedule exists for today in project "${projectId}"\n\n🎯 Current Goal: ${projectConfig.goal}\n📈 Knowledge Level: ${projectConfig.knowledge_level || 0}%\n\n💡 Ready to plan your day?\n\n🔧 Ask Claude to run 'generate_daily_schedule' when you want a comprehensive schedule!\n\n⚡ You can also use 'get_next_task' for individual task recommendations.`,
          },
        ],
      };
    }

    const nextBlock = schedule.time_blocks.find((b) => !b.completed);
    const progress = `${schedule.completed}/${schedule.total_blocks}`;
    const knowledgeLevel = projectConfig.knowledge_level || 0;

    let status = `🎯 Active Project: ${projectId}\n📋 Goal: ${projectConfig.goal}\n📅 Today: ${today} (custom schedule active)\n📊 Progress: ${progress} blocks completed\n📈 Overall Knowledge: ${knowledgeLevel}%\n\n`;

    if (nextBlock) {
      const firstOutcome = nextBlock.learning_outcomes
        ? nextBlock.learning_outcomes[0]
        : "Outcome TBD";
      status += `⏰ NEXT ACTION:\n${nextBlock.time}: ${nextBlock.action}\nDuration: ${nextBlock.duration}\nPurpose: ${nextBlock.strategic_purpose}\n\n💡 You'll learn: ${firstOutcome}`;

      if (nextBlock.prerequisites?.length > 0) {
        status += `\n✅ Prerequisites completed: ${nextBlock.prerequisites.join(", ")}`;
      }
    } else {
      status +=
        '🎉 All scheduled actions complete! Day perfectly executed.\n\n💡 Generate a new schedule anytime with "generate_daily_schedule".\n🔄 Use "evolve_strategy" to optimize future planning based on today\'s learnings.';
    }

    return { content: [{ type: "text", text: status }] };
  }

  // Now integrate pacing context into get_next_task
  async getNextTask(
    contextFromMemory = "",
    energyLevel = 3,
    timeAvailable = "30 minutes",
  ) {
    const projectId = await this.requireActiveProject();
    const projectConfig = await this.loadProjectData(projectId, "config.json");

    // ENHANCED: Generate comprehensive pacing context
    const pacingContext = await this.generatePacingContext(projectId);

    // Load HTA tree for active path or general project
    const activePath = projectConfig.active_learning_path || "general";
    const hta =
      (await this.loadPathData(projectId, activePath, "hta.json")) ||
      (await this.loadProjectData(projectId, "hta.json"));

    const learningHistory = (await this.loadPathData(
      projectId,
      activePath,
      "learning_history.json",
    )) ||
      (await this.loadProjectData(projectId, "learning_history.json")) || {
        completed_topics: [],
        skill_levels: {},
        knowledge_gaps: [],
      };

    if (!hta) {
      throw new Error(
        "No HTA tree found for this project/path. Use build_hta_tree first.",
      );
    }

    // Get completed task IDs for proper prerequisite checking
    const completedTaskIds = hta.completed_nodes?.map((n) => n.id) || [];
    const completedTaskTitles = hta.completed_nodes?.map((n) => n.title) || [];

    // Find ready nodes with satisfied prerequisites
    const readyNodes = hta.frontier_nodes.filter((node) => {
      if (node.status !== "ready") return false;

      if (node.prerequisites && node.prerequisites.length > 0) {
        const prereqsMet = node.prerequisites.every((prereq) => {
          if (completedTaskIds.includes(prereq)) return true;
          if (completedTaskTitles.includes(prereq)) return true;
          return learningHistory.completed_topics.some(
            (topic) => topic.topic === prereq,
          );
        });
        if (!prereqsMet) return false;
      }

      const activePath = projectConfig.active_learning_path;
      if (activePath) {
        return this.isTaskRelevantToPath(node, activePath);
      }

      return true;
    });

    if (readyNodes.length === 0) {
      await this.generateAdaptiveTasks(
        projectId,
        learningHistory,
        contextFromMemory,
      );
      const updatedHTA = await this.loadProjectData(projectId, "hta.json");
      let newReadyNodes = updatedHTA.frontier_nodes.filter(
        (n) => n.status === "ready",
      );

      if (newReadyNodes.length === 0) {
        const completedTaskIds =
          updatedHTA.completed_nodes?.map((n) => n.id) || [];
        const continuationTasks = await this.generateSmartNextTasks(
          projectConfig,
          learningHistory,
          completedTaskIds,
        );

        if (continuationTasks.length > 0) {
          updatedHTA.frontier_nodes.push(...continuationTasks);
          await this.saveProjectData(projectId, "hta.json", updatedHTA);
          newReadyNodes = continuationTasks;
        }
      }

      if (newReadyNodes.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `🔧 Sequence appears stuck. Try repair_sequence to auto-fix the task flow.`,
            },
          ],
        };
      }

      readyNodes.push(...newReadyNodes);
    }

    const timeInMinutes = this.parseTimeAvailable(timeAvailable);

    // ENHANCED: Use pacing context to filter suitable nodes
    let suitableNodes = readyNodes.filter((node) => {
      const estimatedMinutes = this.parseTimeAvailable(node.estimated_time);
      const energyRequired =
        node.magnitude > 7 ? 4 : node.magnitude > 5 ? 3 : 2;

      // Apply pacing context constraints
      const withinComplexityCeiling =
        node.magnitude <= pacingContext.complexity_ceiling;
      const aboveChallengeFloor =
        node.magnitude >= pacingContext.challenge_floor;
      const appropriateDifficulty =
        node.magnitude <= pacingContext.current_capability.avg_difficulty + 1;

      return (
        estimatedMinutes <= timeInMinutes &&
        energyRequired <= energyLevel &&
        withinComplexityCeiling &&
        aboveChallengeFloor &&
        appropriateDifficulty
      );
    });

    if (suitableNodes.length === 0) {
      suitableNodes = readyNodes
        .sort((a, b) => a.magnitude - b.magnitude)
        .slice(0, 1);
    }

    // ENHANCED: Select optimal task using pacing context
    const nextTask = this.selectOptimalTaskWithPacing(
      suitableNodes,
      learningHistory,
      contextFromMemory,
      pacingContext,
    );

    // Enhanced context for memory integration with pacing insights
    const _memoryContext = {
      selected_task: nextTask.title,
      prerequisites_met: nextTask.prerequisites || [],
      learning_goal: nextTask.learning_outcomes[0],
      knowledge_area: nextTask.branch_type,
      pacing_analysis: {
        current_capability: pacingContext.current_capability.level,
        recommended_step_size: pacingContext.recommended_step_size.size,
        pacing_warnings: pacingContext.pacing_warnings.map((w) => w.message),
        momentum_status: pacingContext.momentum_status?.status || "unknown",
      },
    };

    const today = this.getTodayDate();
    let schedule = await this.loadProjectData(projectId, `day_${today}.json`);
    if (!schedule) {
      schedule = {
        project_id: projectId,
        date: today,
        north_star: hta.north_star,
        time_blocks: [],
        total_blocks: 0,
        completed: 0,
        energy_level: energyLevel,
        focus_type: "mixed",
        created: new Date().toISOString(),
      };
    }
    if (!schedule.time_blocks) schedule.time_blocks = [];
    const existsInSchedule = schedule.time_blocks.some(
      (b) => b.id === nextTask.id,
    );
    if (!existsInSchedule) {
      schedule.time_blocks.push({
        id: nextTask.id,
        time: this.formatTime(
          new Date().getHours() * 60 + new Date().getMinutes(),
        ),
        duration: nextTask.estimated_time || "30 min",
        action: nextTask.title,
        description: nextTask.description,
        type: "learning",
        strategic_purpose: nextTask.branch_type,
        hta_connected: true,
      });
      schedule.total_blocks = schedule.time_blocks.length;
      await this.saveProjectData(projectId, `day_${today}.json`, schedule);
    }

    // ----- EVOLVED TASK INTELLIGENCE INTEGRATION -----
    const progressSnapshot = {
      completed_tasks: learningHistory.completed_topics.length,
      knowledge_level: projectConfig.knowledge_level || 0,
      momentum_status: pacingContext.momentum_status?.status || "unknown",
    };

    const isEvolvedTask =
      nextTask?.prerequisites?.length > 0 && nextTask.branch_type === "evolved";

    const guidanceRequest = isEvolvedTask
      ? await this.claudeInterface.requestIntelligence("next_task", {
          current_task: nextTask,
          user_progress: progressSnapshot,
          energy_level: energyLevel,
          time_available: timeAvailable,
        })
      : null;

    return {
      task: nextTask,
      auto_triggered: isEvolvedTask,
      intelligent_guidance_request: guidanceRequest,
      reasoning: nextTask?.reasoning || "Next logical step",
    };
  }

  // Enhanced task selection with pacing context
  selectOptimalTaskWithPacing(
    nodes,
    learningHistory,
    contextFromMemory,
    pacingContext,
  ) {
    const scoredNodes = nodes.map((node) => {
      let score = 0;

      // HIGHEST PRIORITY: Pacing-appropriate tasks
      if (node.validated_step === true) score += 1000; // Incremental progression validated

      // PACING BONUS: Matches recommended step size
      const stepSizeMatch = this.matchesRecommendedStepSize(
        node,
        pacingContext.recommended_step_size,
      );
      if (stepSizeMatch) score += 500;

      // CAPABILITY ALIGNMENT: Matches current capability level
      const capabilityMatch = this.matchesCapabilityLevel(
        node,
        pacingContext.current_capability,
      );
      if (capabilityMatch) score += 400;

      // MOMENTUM CONSIDERATION: Aligns with momentum status
      if (
        pacingContext.momentum_status?.status === "accelerating" &&
        node.magnitude >= 6
      )
        score += 300;
      if (
        pacingContext.momentum_status?.status === "struggling" &&
        node.magnitude <= 4
      )
        score += 300;

      // Original scoring factors (lower priority)
      if (node.branch_type === "interest_driven" || node.interest_based)
        score += 200;
      if (node.priority === "critical") score += 150;
      if (node.priority === "high") score += 100;

      return { ...node, score };
    });

    return scoredNodes.sort((a, b) => b.score - a.score)[0];
  }

  matchesRecommendedStepSize(node, recommendedStepSize) {
    const nodeTime = this.parseTimeAvailable(node.estimated_time);

    if (recommendedStepSize.size === "tiny" && nodeTime <= 20) return true;
    if (recommendedStepSize.size === "small" && nodeTime <= 35 && nodeTime > 15)
      return true;
    if (
      recommendedStepSize.size === "medium" &&
      nodeTime <= 60 &&
      nodeTime > 30
    )
      return true;

    return false;
  }

  matchesCapabilityLevel(node, currentCapability) {
    const taskDifficulty = node.magnitude || 5;
    const userAvgDifficulty = currentCapability.avg_difficulty || 3;

    // Perfect match: task difficulty within 1 point of user's average
    return Math.abs(taskDifficulty - userAvgDifficulty) <= 1;
  }

  parseTimeAvailable(timeStr) {
    if (!timeStr) {
      return 60;
    } // default 1 hour

    const str = timeStr.toLowerCase();

    // Handle flexible/open-ended times
    if (
      str.includes("flexible") ||
      str.includes("needed") ||
      str.includes("natural") ||
      str.includes("stopping") ||
      str.includes("variable")
    ) {
      return 120; // Assume 2 hours for scheduling purposes, but allow flexibility
    }

    // Handle range times (take the upper bound for scheduling)
    const rangeMatch = str.match(/(\d+)-(\d+)\s*(hour|min)/);
    if (rangeMatch) {
      const upper = parseInt(rangeMatch[2]);
      return rangeMatch[3].includes("hour") ? upper * 60 : upper;
    }

    // Handle standard times
    const minutes = str.match(/(\d+)\s*min/);
    const hours = str.match(/(\d+)\s*hour/);

    if (minutes) {
      return parseInt(minutes[1]);
    }
    if (hours) {
      return parseInt(hours[1]) * 60;
    }
    return 60; // default 1 hour
  }

  selectOptimalTask(nodes, learningHistory, contextFromMemory) {
    // Score nodes based on multiple factors with SEQUENCE PRIORITY
    const scoredNodes = nodes.map((node) => {
      let score = 0;

      // ULTIMATE PRIORITY: Path-focused tasks when path is active
      if (node.path_priority === true) {
        score += 500;
      } // Highest possible priority

      // HIGHEST PRIORITY: Interest-driven and discovery tasks maintain motivation
      if (node.branch_type === "interest_driven" || node.interest_based) {
        score += 300;
      } else if (
        node.branch_type === "exploration" ||
        node.branch_type === "sampling"
      ) {
        score += 250;
      } // Help discover interests
      else if (node.branch_type === "fundamentals") {
        score += 200;
      } else if (node.branch_type === "tools") {
        score += 150;
      } else if (node.branch_type === "practical") {
        score += 100;
      } else if (node.branch_type === "research") {
        score += 25;
      } // Lower priority for dynamic tasks

      // Secondary: Priority level (but much lower weight than sequence)
      if (node.priority === "critical") {
        score += 50;
      } else if (node.priority === "high") {
        score += 35;
      } else if (node.priority === "medium") {
        score += 20;
      }

      // Penalize tasks with no prerequisites (likely generated, not sequential)
      if (!node.prerequisites || node.prerequisites.length === 0) {
        score -= 25; // Discourage orphaned tasks
      }

      // Consider knowledge gaps from memory context
      if (
        contextFromMemory &&
        node.description.toLowerCase().includes(contextFromMemory.toLowerCase())
      ) {
        score += 15;
      }

      // Slightly prefer shorter tasks for momentum
      const timeInMinutes = this.parseTimeAvailable(node.estimated_time);
      if (timeInMinutes <= 30) {
        score += 5;
      }

      return { ...node, score };
    });

    // Return highest scoring task
    return scoredNodes.sort((a, b) => b.score - a.score)[0];
  }

  async generateAdaptiveTasks(projectId, learningHistory, contextFromMemory) {
    const projectConfig = await this.loadProjectData(projectId, "config.json");
    const hta = await this.loadProjectData(projectId, "hta.json");

    if (!hta) {
      return;
    }

    const completedTopics = learningHistory.completed_topics.map(
      (t) => t.topic,
    );
    const knowledgeLevel = projectConfig.knowledge_level || 0;
    const focusDuration = this.parseTimeAvailable(
      projectConfig.focus_duration || "25 minutes",
    );

    // 🌟 INFINITE SCALING: Analyze complexity patterns to generate appropriate tasks
    const complexityAnalysis =
      this.analyzeComplexityIndicators(learningHistory);
    const complexityTasks = this.generateComplexityAppropriateTask(
      complexityAnalysis,
      projectConfig,
      learningHistory,
    );

    // Generate domain-agnostic next steps based on what's been completed
    const newTasks = [...complexityTasks];

    // Generate micro-tasks for very short focus periods (accessibility support)
    if (focusDuration <= 10) {
      newTasks.push({
        id: this.generateId(),
        title: `Quick Review: ${projectConfig.goal}`,
        description: `Spend ${focusDuration} minutes reviewing recent progress`,
        branch_type: "micro-review",
        estimated_time: `${focusDuration} minutes`,
        priority: "medium",
        status: "ready",
        knowledge_level: "any",
        magnitude: 3,
        prerequisites: [],
        learning_outcomes: [
          "Refresh memory",
          "Maintain momentum",
          "Low cognitive load",
        ],
      });

      newTasks.push({
        id: this.generateId(),
        title: `Micro-Learning: One Concept`,
        description: `Focus on understanding just one small concept for ${focusDuration} minutes`,
        branch_type: "micro-concept",
        estimated_time: `${focusDuration} minutes`,
        priority: "high",
        status: "ready",
        knowledge_level: "beginner",
        magnitude: 4,
        prerequisites: [],
        learning_outcomes: [
          "Learn one new thing",
          "Build understanding slowly",
          "Prevent overwhelm",
        ],
      });
    }

    // If they've completed basics, add intermediate tasks
    if (completedTopics.length >= 3 && knowledgeLevel >= 20) {
      newTasks.push({
        id: this.generateId(),
        title: `Intermediate Practice: ${projectConfig.goal}`,
        description: `Apply what you've learned so far in a practical exercise`,
        branch_type: "practical",
        estimated_time: "45 minutes",
        priority: "high",
        status: "ready",
        knowledge_level: "intermediate",
        magnitude: 6,
        prerequisites: completedTopics.slice(-2), // Require last 2 completed topics
        learning_outcomes: [
          "Apply knowledge practically",
          "Identify skill gaps",
          "Build confidence",
        ],
      });
    }

    // Add reflection task after several completions
    if (completedTopics.length >= 2 && completedTopics.length % 3 === 0) {
      newTasks.push({
        id: this.generateId(),
        title: "Learning Reflection & Planning",
        description:
          "Reflect on progress and identify next learning priorities",
        branch_type: "reflection",
        estimated_time: "20 minutes",
        priority: "medium",
        status: "ready",
        knowledge_level: "beginner",
        magnitude: 4,
        prerequisites: [],
        learning_outcomes: [
          "Assess current understanding",
          "Identify knowledge gaps",
          "Plan next steps",
        ],
      });
    }

    // Add context-driven tasks from memory
    if (contextFromMemory && learningHistory.knowledge_gaps.length > 0) {
      const recentGap =
        learningHistory.knowledge_gaps[
          learningHistory.knowledge_gaps.length - 1
        ];
      newTasks.push({
        id: this.generateId(),
        title: `Explore: ${recentGap.question.substring(0, 50)}...`,
        description: `Research and answer: ${recentGap.question}`,
        branch_type: "research",
        estimated_time: "35 minutes",
        priority: "high",
        status: "ready",
        knowledge_level: "intermediate",
        magnitude: 6,
        prerequisites: [recentGap.from_topic],
        learning_outcomes: [
          `Answer: ${recentGap.question}`,
          "Fill knowledge gap",
          "Advance understanding",
        ],
      });
    }

    // Add generated tasks to HTA
    if (newTasks.length > 0) {
      hta.frontier_nodes.push(...newTasks);
      hta.last_evolution = new Date().toISOString();
      await this.saveProjectData(projectId, "hta.json", hta);
    }
  }

  // Helper function to get active HTA tree
  // DEDUCTIVE REASONING ENGINE - analyzes patterns and draws logical conclusions
  async generateLogicalDeductions(projectId, completionHistory = []) {
    try {
      const projectConfig = await this.loadProjectData(
        projectId,
        "config.json",
      );
      const learningHistory = (await this.loadProjectData(
        projectId,
        "learning_history.json",
      )) || {
        completed_topics: [],
        knowledge_gaps: [],
        insights: [],
      };

      const deductiveAnalysis = {
        patterns_detected: this.detectCompletionPatterns(
          completionHistory,
          learningHistory,
        ),
        logical_chains: this.buildLogicalChains(
          completionHistory,
          projectConfig,
        ),
        strategic_implications: this.deduceStrategicImplications(
          completionHistory,
          projectConfig,
        ),
        competitive_advantages: this.identifyCompetitiveAdvantages(
          completionHistory,
          projectConfig,
        ),
        knowledge_synthesis:
          this.synthesizeKnowledgeConnections(learningHistory),
        contradiction_analysis: this.detectContradictions(
          completionHistory,
          learningHistory,
        ),
        opportunity_identification: this.identifyEmergentOpportunities(
          completionHistory,
          projectConfig,
        ),
        confidence_scores: this.calculateDeductionConfidence(completionHistory),
        recommended_pivots: this.recommendStrategicPivots(
          completionHistory,
          projectConfig,
        ),
        next_logical_focus: this.deduceNextLogicalFocus(
          completionHistory,
          projectConfig,
        ),
      };

      return {
        timestamp: new Date().toISOString(),
        project_goal: projectConfig.goal,
        analysis_depth: completionHistory.length,
        deductive_reasoning: deductiveAnalysis,
        system_intelligence_level:
          this.assessSystemIntelligence(deductiveAnalysis),
        actionable_insights: this.generateActionableInsights(deductiveAnalysis),
      };
    } catch (error) {
      await this.logError("generateLogicalDeductions", error, { projectId });
      return this.getDefaultDeductiveAnalysis(projectId);
    }
  }

  detectCompletionPatterns(completionHistory, learningHistory) {
    const patterns = [];

    // Pattern 1: Learning velocity and depth correlation
    const avgLearningDepth =
      completionHistory.reduce((sum, c) => sum + (c.learned?.length || 0), 0) /
      Math.max(completionHistory.length, 1);
    if (avgLearningDepth > 100) {
      patterns.push({
        type: "high_depth_learning",
        evidence: `Average learning depth: ${Math.round(avgLearningDepth)} characters`,
        implication:
          "User demonstrates deep analytical thinking and comprehensive understanding",
        confidence: 0.9,
      });
    }

    // Pattern 2: Breakthrough frequency analysis
    const breakthroughRate =
      completionHistory.filter((c) => c.breakthrough).length /
      Math.max(completionHistory.length, 1);
    if (breakthroughRate > 0.3) {
      patterns.push({
        type: "high_breakthrough_rate",
        evidence: `${Math.round(breakthroughRate * 100)}% breakthrough rate`,
        implication:
          "User consistently generates novel insights and strategic realizations",
        confidence: 0.85,
      });
    }

    // Pattern 3: Strategic thinking indicators
    const strategicKeywords = [
      "bridge",
      "pathway",
      "leverage",
      "advantage",
      "pivot",
      "strategy",
    ];
    const strategicMentions = completionHistory.reduce((count, c) => {
      const content = (c.learned || "") + (c.outcome || "");
      return (
        count +
        strategicKeywords.filter((keyword) =>
          content.toLowerCase().includes(keyword),
        ).length
      );
    }, 0);

    if (strategicMentions > completionHistory.length) {
      patterns.push({
        type: "strategic_thinking_pattern",
        evidence: `${strategicMentions} strategic concepts across ${completionHistory.length} completions`,
        implication:
          "User naturally thinks in strategic frameworks and systematic approaches",
        confidence: 0.8,
      });
    }

    // Pattern 4: Knowledge integration ability
    const integrationIndicators =
      learningHistory.insights?.filter(
        (insight) =>
          insight.feedback?.includes("insight") ||
          insight.feedback?.includes("connection"),
      ).length || 0;

    if (integrationIndicators > 1) {
      patterns.push({
        type: "knowledge_integration",
        evidence: `${integrationIndicators} documented knowledge connections`,
        implication:
          "User excels at connecting disparate concepts into coherent frameworks",
        confidence: 0.75,
      });
    }

    return patterns;
  }

  buildLogicalChains(completionHistory, projectConfig) {
    const chains = [];

    // Logical Chain 1: Credential + Experience = Unique Advantage
    const credentials = projectConfig.existing_credentials || [];
    const psychologyBackground = credentials.some((c) =>
      c.subject_area?.toLowerCase().includes("psychology"),
    );
    const _uxBackground = credentials.some(
      (c) =>
        c.subject_area?.toLowerCase().includes("ux") ||
        c.subject_area?.toLowerCase().includes("design"),
    );

    if (psychologyBackground && completionHistory.length > 0) {
      const fanAnalysisEvidence = completionHistory.some(
        (c) =>
          (c.learned || "").toLowerCase().includes("fan") ||
          (c.learned || "").toLowerCase().includes("audience"),
      );

      if (fanAnalysisEvidence) {
        chains.push({
          premise_1: "User has psychology degree",
          premise_2: "User demonstrates fan behavior analysis",
          premise_3: "Entertainment industry needs audience insight",
          logical_connection:
            "IF psychology expertise + fan analysis THEN unique market positioning",
          conclusion:
            "User possesses rare combination: psychological training + insider fan perspective",
          confidence: 0.9,
          strategic_value: "high",
        });
      }
    }

    // Logical Chain 2: Bridge Strategy Validation
    const bridgeStrategyEvidence = completionHistory.some(
      (c) =>
        (c.learned || "").toLowerCase().includes("bridge") ||
        (c.learned || "").toLowerCase().includes("marketing"),
    );

    if (bridgeStrategyEvidence) {
      chains.push({
        premise_1: "User identified marketing as bridge pathway",
        premise_2: "User has relevant foundational skills",
        premise_3: "Direct industry entry is extremely difficult",
        logical_connection:
          "IF bridge strategy + existing skills THEN higher probability of success",
        conclusion: "Adjacent industry pivot approach is strategically sound",
        confidence: 0.85,
        strategic_value: "critical",
      });
    }

    return chains;
  }

  deduceStrategicImplications(completionHistory, _projectConfig) {
    const implications = [];

    // Implication 1: Competitive Differentiation
    const uniqueInsights = completionHistory.filter(
      (c) => c.breakthrough || (c.learned?.length || 0) > 150,
    ).length;

    if (uniqueInsights >= 2) {
      implications.push({
        category: "competitive_positioning",
        insight: "User consistently generates unique analytical perspectives",
        strategic_implication:
          "Natural differentiation through depth of analysis and novel insights",
        business_impact:
          "Can provide perspectives competitors cannot replicate",
        confidence: 0.8,
      });
    }

    // Implication 2: Market Timing
    const _currentYear = new Date().getFullYear();
    implications.push({
      category: "market_timing",
      insight: "Entertainment industry undergoing rapid digital transformation",
      strategic_implication:
        "Psychology + digital marketing skills increasingly valuable",
      business_impact:
        "Timing favors interdisciplinary approaches to fan engagement",
      confidence: 0.75,
    });

    return implications;
  }

  identifyCompetitiveAdvantages(completionHistory, projectConfig) {
    const advantages = [];

    const credentials = projectConfig.existing_credentials || [];
    const psychologyBackground = credentials.find((c) =>
      c.subject_area?.toLowerCase().includes("psychology"),
    );

    if (psychologyBackground) {
      advantages.push({
        advantage_type: "educational_foundation",
        description: "Formal psychology training in human behavior analysis",
        market_rarity: "Rare in entertainment marketing",
        application:
          "Fan psychology, audience segmentation, engagement optimization",
        value_proposition:
          "Deeper audience insight than demographic-only approaches",
        confidence: 0.9,
      });
    }

    // Fan expertise advantage
    const fanEvidence = completionHistory.some(
      (c) =>
        (c.learned || "").includes("fan") ||
        (c.outcome || "").includes("audience"),
    );

    if (fanEvidence) {
      advantages.push({
        advantage_type: "insider_perspective",
        description: "Authentic fan perspective with analytical framework",
        market_rarity: "Most marketers are outsiders to fan communities",
        application:
          "Authentic fan engagement, community building, content strategy",
        value_proposition:
          "Avoids tone-deaf marketing that alienates core audience",
        confidence: 0.85,
      });
    }

    return advantages;
  }

  synthesizeKnowledgeConnections(learningHistory) {
    const connections = [];
    const insights = learningHistory.insights || [];
    const knowledgeGaps = learningHistory.knowledge_gaps || [];

    // Connection 1: Insight to Gap Resolution
    insights.forEach((insight) => {
      const relatedGaps = knowledgeGaps.filter((gap) => {
        const insightContent = insight.feedback?.toLowerCase() || "";
        const gapContent = gap.question?.toLowerCase() || "";
        return (
          insightContent.includes("marketing") &&
          gapContent.includes("marketing")
        );
      });

      if (relatedGaps.length > 0) {
        connections.push({
          type: "insight_gap_resolution",
          insight_source: insight.feedback?.substring(0, 100) + "...",
          resolves_gaps: relatedGaps.length,
          synthesis:
            "Previous insights provide framework for addressing current knowledge gaps",
          confidence: 0.7,
        });
      }
    });

    return connections;
  }

  detectContradictions(_completionHistory, _learningHistory) {
    // For now, return empty array - contradiction detection is complex
    // Future enhancement: detect when learning contradicts previous understanding
    return [];
  }

  identifyEmergentOpportunities(completionHistory, _projectConfig) {
    const opportunities = [];

    // Opportunity 1: Bridge strategy maturation
    const bridgeEvidence = completionHistory.some(
      (c) =>
        (c.learned || "").toLowerCase().includes("bridge") ||
        (c.learned || "").toLowerCase().includes("marketing"),
    );

    if (bridgeEvidence && completionHistory.length >= 2) {
      opportunities.push({
        opportunity_type: "strategic_pivot_readiness",
        description:
          "Bridge strategy sufficiently developed to begin implementation",
        timing: "immediate",
        requirements: [
          "Digital marketing skill building",
          "Portfolio development",
        ],
        potential_impact: "High - enables career transition execution",
        confidence: 0.8,
      });
    }

    return opportunities;
  }

  calculateDeductionConfidence(completionHistory) {
    const dataPoints = completionHistory.length;
    const breakthroughs = completionHistory.filter(
      (c) => c.breakthrough,
    ).length;
    const avgLearningDepth =
      completionHistory.reduce((sum, c) => sum + (c.learned?.length || 0), 0) /
      Math.max(dataPoints, 1);

    let confidence = 0.5; // Base confidence

    // More data points = higher confidence
    if (dataPoints >= 3) confidence += 0.2;
    if (dataPoints >= 5) confidence += 0.1;

    // Breakthroughs indicate quality insights
    if (breakthroughs >= 1) confidence += 0.15;
    if (breakthroughs >= 2) confidence += 0.1;

    // Deep learning indicates thorough analysis
    if (avgLearningDepth > 100) confidence += 0.1;

    return Math.min(confidence, 0.95); // Cap at 95%
  }

  recommendStrategicPivots(completionHistory, _projectConfig) {
    const pivots = [];

    // Pivot recommendation based on bridge strategy evidence
    const marketingEvidence = completionHistory.some((c) =>
      (c.learned || "").toLowerCase().includes("marketing"),
    );

    if (marketingEvidence) {
      pivots.push({
        pivot_type: "focus_shift",
        from: "General entertainment industry exploration",
        to: "Specialized entertainment marketing development",
        rationale:
          "Bridge strategy identified and validated through completion analysis",
        implementation:
          "Shift learning focus to digital marketing fundamentals",
        timeline: "Next 1-2 tasks",
        confidence: 0.85,
      });
    }

    return pivots;
  }

  deduceNextLogicalFocus(completionHistory, _projectConfig) {
    // Analyze completion patterns to deduce what should be focused on next
    const recentLearning = completionHistory.slice(-2);
    const bridgeStrategyEvidence = recentLearning.some(
      (c) =>
        (c.learned || "").toLowerCase().includes("bridge") ||
        (c.learned || "").toLowerCase().includes("marketing"),
    );

    if (bridgeStrategyEvidence) {
      return {
        focus_area: "Digital Marketing Skill Building",
        reasoning:
          "Bridge strategy established, now need foundational marketing skills",
        priority: "high",
        confidence: 0.9,
      };
    }

    return {
      focus_area: "Continue current strategic exploration",
      reasoning: "Insufficient evidence to recommend major focus shift",
      priority: "medium",
      confidence: 0.6,
    };
  }

  assessSystemIntelligence(deductiveAnalysis) {
    const patterns = deductiveAnalysis.patterns_detected?.length || 0;
    const chains = deductiveAnalysis.logical_chains?.length || 0;
    const implications = deductiveAnalysis.strategic_implications?.length || 0;

    const intelligenceScore =
      patterns * 0.3 + chains * 0.4 + implications * 0.3;

    if (intelligenceScore >= 2) return "high";
    if (intelligenceScore >= 1) return "medium";
    return "developing";
  }

  generateActionableInsights(deductiveAnalysis) {
    const insights = [];

    // Convert logical chains to actionable insights
    deductiveAnalysis.logical_chains?.forEach((chain) => {
      if (chain.confidence >= 0.8) {
        insights.push({
          insight: chain.conclusion,
          action: `Leverage this advantage: ${chain.logical_connection}`,
          priority: chain.strategic_value === "critical" ? "high" : "medium",
          confidence: chain.confidence,
        });
      }
    });

    // Convert opportunities to actions
    deductiveAnalysis.opportunity_identification?.forEach((opp) => {
      if (opp.timing === "immediate") {
        insights.push({
          insight: opp.description,
          action: `Focus on: ${opp.requirements?.join(", ")}`,
          priority: "high",
          confidence: opp.confidence,
        });
      }
    });

    return insights;
  }

  getDefaultDeductiveAnalysis(_projectId) {
    return {
      timestamp: new Date().toISOString(),
      project_goal: "Unknown",
      analysis_depth: 0,
      deductive_reasoning: {
        patterns_detected: [],
        logical_chains: [],
        strategic_implications: [],
        competitive_advantages: [],
        knowledge_synthesis: [],
        contradiction_analysis: [],
        opportunity_identification: [],
        confidence_scores: 0.5,
        recommended_pivots: [],
        next_logical_focus: {
          focus_area: "Build more completion data",
          reasoning: "Insufficient data for analysis",
          priority: "medium",
          confidence: 0.3,
        },
      },
      system_intelligence_level: "developing",
      actionable_insights: [],
    };
  }

  // COMPREHENSIVE PACING ANALYSIS - provides rich context for perfect task generation
  async generatePacingContext(projectId, recentCompletions = []) {
    try {
      // Load project configuration (may include pacing preferences, constraints, etc.)
      const projectConfig =
        (await this.loadProjectData(projectId, "config.json")) || {};

      // Build a minimal learningHistory structure so existing helper methods can operate
      const learningHistory = {
        completed_topics: recentCompletions,
      };

      const completionHistory = learningHistory.completed_topics || [];

      return {
        // Current capability assessment
        current_capability: this.assessCurrentCapability(recentCompletions),
        learning_velocity: this.calculateLearningVelocity(completionHistory),
        skill_acceleration: this.calculateSkillAcceleration(completionHistory),

        // Difficulty and challenge patterns
        difficulty_trend: this.analyzeDifficultyTrend(recentCompletions),
        optimal_difficulty: this.calculateOptimalDifficulty(recentCompletions),
        struggle_patterns: this.identifyStrugglePatterns(completionHistory),
        breakthrough_patterns:
          this.identifyBreakthroughPatterns(completionHistory),

        // Energy and engagement patterns
        energy_patterns: this.analyzeEnergyPatterns(recentCompletions),
        engagement_patterns: this.analyzeEngagementPatterns(recentCompletions),
        optimal_duration: this.calculateOptimalDuration(
          completionHistory,
          projectConfig,
        ),

        // Pacing health indicators
        pacing_warnings: this.detectPacingWarnings(completionHistory),
        momentum_status: this.assessMomentumStatus(recentCompletions),
        readiness_level: this.assessReadinessLevel(
          completionHistory,
          projectConfig,
        ),

        // Strategic context
        goal_alignment: projectConfig.goal,
        knowledge_level: projectConfig.knowledge_level || 0,
        time_constraints: projectConfig.constraints?.time_constraints,
        focus_preferences: projectConfig.focus_duration,

        // Next step sizing recommendations
        recommended_step_size: this.recommendStepSize(
          recentCompletions,
          projectConfig,
        ),
        complexity_ceiling: this.calculateComplexityCeiling(completionHistory),
        challenge_floor: this.calculateChallengeFloor(completionHistory),
      };
    } catch (error) {
      await this.logError("generatePacingContext", error, { projectId });
      return this.getDefaultPacingContext(projectId);
    }
  }

  assessCurrentCapability(recentCompletions) {
    if (!recentCompletions || recentCompletions.length === 0) {
      return { level: "beginner", confidence: "low", trend: "unknown" };
    }

    const avgDifficulty =
      recentCompletions.reduce((sum, c) => sum + (c.difficulty || 3), 0) /
      recentCompletions.length;
    const avgLearning =
      recentCompletions.filter((c) => c.learned && c.learned.length > 30)
        .length / recentCompletions.length;
    const breakthroughs = recentCompletions.filter(
      (c) => c.breakthrough,
    ).length;

    let level = "beginner";
    if (avgDifficulty >= 3.5 && avgLearning >= 0.7) level = "intermediate";
    if (avgDifficulty >= 4 && avgLearning >= 0.8 && breakthroughs >= 1)
      level = "advanced";

    const trend = this.calculateCapabilityTrend(recentCompletions);
    const confidence =
      avgLearning >= 0.6 ? "high" : avgLearning >= 0.3 ? "medium" : "low";

    return {
      level,
      confidence,
      trend,
      avg_difficulty: avgDifficulty,
      learning_rate: avgLearning,
    };
  }

  calculateLearningVelocity(completionHistory) {
    if (completionHistory.length < 2)
      return { rate: "unknown", pattern: "insufficient_data" };

    const recentWeek = completionHistory.filter((c) => {
      const completionDate = new Date(c.date);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return completionDate >= weekAgo;
    });

    const tasksPerWeek = recentWeek.length;
    const avgLearningDepth =
      recentWeek.reduce((sum, c) => sum + (c.learned?.length || 0), 0) /
      Math.max(recentWeek.length, 1);

    let rate = "slow";
    if (tasksPerWeek >= 5 && avgLearningDepth >= 50) rate = "fast";
    else if (tasksPerWeek >= 3 && avgLearningDepth >= 30) rate = "steady";
    else if (tasksPerWeek >= 1) rate = "moderate";

    return {
      rate,
      tasks_per_week: tasksPerWeek,
      avg_learning_depth: avgLearningDepth,
      pattern: this.identifyLearningPattern(completionHistory),
    };
  }

  analyzeDifficultyTrend(recentCompletions) {
    if (!recentCompletions || recentCompletions.length < 2) {
      return {
        trend: "unknown",
        current_level: 3,
        recommendation: "start_moderate",
      };
    }

    const difficulties = recentCompletions.map((c) => c.difficulty || 3);
    const avgRecent =
      difficulties.slice(-3).reduce((a, b) => a + b, 0) /
      Math.min(difficulties.length, 3);
    const avgEarlier =
      difficulties.slice(0, -3).reduce((a, b) => a + b, 0) /
      Math.max(difficulties.length - 3, 1);

    let trend = "stable";
    if (avgRecent > avgEarlier + 0.5) trend = "increasing";
    else if (avgRecent < avgEarlier - 0.5) trend = "decreasing";

    let recommendation = "maintain";
    if (avgRecent >= 4.5) recommendation = "reduce_difficulty";
    else if (
      avgRecent <= 2 &&
      recentCompletions.slice(-2).every((c) => c.learned?.length > 40)
    )
      recommendation = "increase_difficulty";

    return {
      trend,
      current_level: avgRecent,
      recommendation,
      struggling:
        avgRecent >= 4 &&
        recentCompletions.slice(-2).some((c) => (c.learned?.length || 0) < 20),
    };
  }

  detectPacingWarnings(completionHistory) {
    const warnings = [];
    const recent = completionHistory.slice(-5);

    // Warning: Consistent difficulty 4+ without learning
    if (
      recent.length >= 3 &&
      recent
        .slice(-3)
        .every((c) => c.difficulty >= 4 && (c.learned?.length || 0) < 30)
    ) {
      warnings.push({
        type: "overwhelm_risk",
        message: "User struggling with recent tasks - reduce complexity",
        severity: "high",
      });
    }

    // Warning: Consistent difficulty 1-2 with minimal engagement
    if (
      recent.length >= 3 &&
      recent
        .slice(-3)
        .every((c) => c.difficulty <= 2 && (c.learned?.length || 0) < 20)
    ) {
      warnings.push({
        type: "boredom_risk",
        message: "Tasks may be too easy - increase challenge",
        severity: "medium",
      });
    }

    // Warning: No completions in last week
    const lastWeek = completionHistory.filter((c) => {
      const completionDate = new Date(c.date);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return completionDate >= weekAgo;
    });

    if (lastWeek.length === 0 && completionHistory.length > 0) {
      warnings.push({
        type: "momentum_loss",
        message: "No activity in past week - restart with easy task",
        severity: "high",
      });
    }

    return warnings;
  }

  recommendStepSize(recentCompletions, projectConfig) {
    const capability = this.assessCurrentCapability(recentCompletions);
    const focusDuration = this.parseTimeAvailable(
      projectConfig.focus_duration || "25 minutes",
    );

    let baseSize = "small";

    // Adjust based on capability
    if (capability.level === "advanced" && capability.confidence === "high") {
      baseSize = "medium";
    } else if (
      capability.level === "beginner" ||
      capability.confidence === "low"
    ) {
      baseSize = "tiny";
    }

    // Adjust based on recent struggles
    if (recentCompletions.some((c) => c.difficulty >= 4)) {
      baseSize = baseSize === "medium" ? "small" : "tiny";
    }

    // Adjust based on focus duration
    if (focusDuration <= 15) {
      baseSize = "tiny";
    } else if (focusDuration >= 60) {
      baseSize = baseSize === "tiny" ? "small" : "medium";
    }

    return {
      size: baseSize,
      reasoning: this.explainStepSizeReasoning(
        capability,
        recentCompletions,
        focusDuration,
      ),
    };
  }

  explainStepSizeReasoning(capability, recentCompletions, focusDuration) {
    const reasons = [];

    if (capability.level === "beginner") reasons.push("beginner level");
    if (capability.confidence === "low") reasons.push("low confidence");
    if (recentCompletions.some((c) => c.difficulty >= 4))
      reasons.push("recent struggles");
    if (focusDuration <= 15) reasons.push("short focus duration");
    if (capability.level === "advanced" && capability.confidence === "high")
      reasons.push("advanced capability");

    return reasons.join(", ") || "standard progression";
  }

  getDefaultPacingContext(_projectId) {
    return {
      current_capability: {
        level: "beginner",
        confidence: "medium",
        trend: "unknown",
      },
      recommended_step_size: {
        size: "small",
        reasoning: "default for new project",
      },
      pacing_warnings: [],
      difficulty_trend: {
        trend: "unknown",
        current_level: 3,
        recommendation: "start_moderate",
      },
      goal_alignment: "Unknown goal",
    };
  }

  // INCREMENTAL PROGRESSION VALIDATION - prevents chapter jumping
  validateIncrementalProgression(
    completedBlock,
    learned,
    nextQuestions,
    projectConfig,
    completionContext = {},
  ) {
    const { difficultyRating = 3 } = completionContext;
    const validatedTasks = [];

    // Determine what the SMALLEST logical next step should be
    const currentCapability = this.assessCurrentCapability(
      completedBlock,
      learned,
      difficultyRating,
    );
    const nextStepSize = this.calculateOptimalStepSize(
      currentCapability,
      difficultyRating,
      projectConfig,
    );

    // Generate only ONE small step ahead, not multiple chapters
    const incrementalTask = this.generateIncrementalNextTask(
      completedBlock,
      learned,
      nextQuestions,
      nextStepSize,
      projectConfig,
    );

    if (incrementalTask) {
      validatedTasks.push(incrementalTask);
    }

    // Only add research task if it's truly the next logical step
    if (
      nextQuestions &&
      this.shouldResearchNext(completedBlock, learned, nextQuestions)
    ) {
      const researchTask = this.generateIncrementalResearchTask(
        completedBlock,
        nextQuestions,
        nextStepSize,
      );
      if (researchTask) {
        validatedTasks.push(researchTask);
      }
    }

    return validatedTasks;
  }

  assessCurrentCapability(completedBlock, learned, difficultyRating) {
    // Assess what user can actually do now based on completion
    let capability = "beginner";

    if (difficultyRating <= 2 && learned && learned.length > 50) {
      capability = "comfortable"; // Easy task with good learning
    } else if (difficultyRating === 3 && learned) {
      capability = "progressing"; // Normal difficulty with learning
    } else if (difficultyRating >= 4) {
      capability = "struggling"; // Hard task, need easier steps
    }

    return capability;
  }

  calculateOptimalStepSize(capability, difficultyRating, projectConfig) {
    // Calculate how big the next step should be
    const focusDuration = this.parseTimeAvailable(
      projectConfig.focus_duration || "25 minutes",
    );

    let stepSize = "small";

    if (capability === "struggling" || difficultyRating >= 4) {
      stepSize = "tiny"; // Much smaller steps
    } else if (capability === "comfortable" && difficultyRating <= 2) {
      stepSize = "medium"; // Can handle slightly bigger step
    }

    // Adjust for focus duration
    if (focusDuration <= 15) {
      stepSize = "tiny"; // Micro-learning
    }

    return stepSize;
  }

  generateIncrementalNextTask(
    completedBlock,
    learned,
    nextQuestions,
    stepSize,
    projectConfig,
  ) {
    const stepSizeMap = {
      tiny: { magnitude: 4, time: "15 minutes", complexity: "one small skill" },
      small: {
        magnitude: 5,
        time: "25 minutes",
        complexity: "build on what you just learned",
      },
      medium: {
        magnitude: 6,
        time: "35 minutes",
        complexity: "apply knowledge in new context",
      },
    };

    const step = stepSizeMap[stepSize] || stepSizeMap["small"];

    // Generate task that builds directly on what was just completed
    const taskTitle = this.generateIncrementalTitle(
      completedBlock.action,
      learned,
      stepSize,
    );
    const taskDescription = this.generateIncrementalDescription(
      completedBlock.action,
      learned,
      step.complexity,
    );

    return {
      id: this.generateId(),
      title: taskTitle,
      description: taskDescription,
      branch_type: completedBlock.strategic_purpose || "practical",
      estimated_time: step.time,
      priority: "high",
      status: "ready",
      knowledge_level: "intermediate",
      magnitude: step.magnitude,
      prerequisites: [completedBlock.id],
      learning_outcomes: [
        `Apply what you learned from: ${completedBlock.action}`,
        "Take one small step forward",
        "Build confidence and momentum",
      ],
      generated_from: "incremental_progression",
      validated_step: true,
    };
  }

  generateIncrementalTitle(previousAction, learned, stepSize) {
    // Create titles that clearly show progression
    const actionKeyword = previousAction.split(" ")[0] || "Continue";

    if (stepSize === "tiny") {
      return `Practice: ${actionKeyword} Basics`;
    } else if (stepSize === "small") {
      return `Apply: ${actionKeyword} Knowledge`;
    } else {
      return `Expand: ${actionKeyword} Skills`;
    }
  }

  generateIncrementalDescription(previousAction, learned, complexity) {
    return `Now that you've completed "${previousAction}", ${complexity}. This builds directly on your recent learning without jumping ahead.`;
  }

  shouldResearchNext(completedBlock, learned, nextQuestions) {
    // Only research if it's truly the logical next step
    if (!nextQuestions || nextQuestions.length < 20) {
      return false; // Too vague to research
    }

    // Research is appropriate if:
    // 1. User showed good comprehension (learned something substantial)
    // 2. Questions are specific enough to research
    // 3. Not jumping too far ahead

    return (
      (learned && learned.length > 30 && nextQuestions.includes("how")) ||
      nextQuestions.includes("what") ||
      nextQuestions.includes("why")
    );
  }

  generateIncrementalResearchTask(completedBlock, nextQuestions, stepSize) {
    const timeMap = {
      tiny: "15 minutes",
      small: "20 minutes",
      medium: "30 minutes",
    };

    return {
      id: this.generateId(),
      title: `Research: Next Step for ${completedBlock.action.split(" ").slice(0, 3).join(" ")}`,
      description: `Research this specific question that emerged: ${nextQuestions.substring(0, 100)}...`,
      branch_type: "research",
      estimated_time: timeMap[stepSize] || "20 minutes",
      priority: "medium",
      status: "ready",
      knowledge_level: "intermediate",
      magnitude: 5,
      prerequisites: [completedBlock.id],
      learning_outcomes: [
        `Answer: ${nextQuestions.substring(0, 50)}...`,
        "Fill specific knowledge gap",
        "Prepare for next practical step",
      ],
      generated_from: "incremental_research",
      validated_step: true,
    };
  }

  async analyzeReasoning(includeDetailedAnalysis = true) {
    const projectId = await this.requireActiveProject();
    const learningHistory = (await this.loadProjectData(
      projectId,
      "learning_history.json",
    )) || {
      completed_topics: [],
      knowledge_gaps: [],
      insights: [],
    };

    const completionHistory = learningHistory.completed_topics || [];

    if (completionHistory.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `🧠 Deductive Reasoning Analysis\n\n⚠️ Insufficient data for analysis. Complete at least 1 task to enable reasoning capabilities.\n\nThe system will analyze:\n• Completion patterns\n• Logical chains\n• Strategic implications\n• Competitive advantages\n• Emergent opportunities`,
          },
        ],
      };
    }

    const reasoning = await this.generateLogicalDeductions(
      projectId,
      completionHistory,
    );

    let response = `🧠 **DEDUCTIVE REASONING ANALYSIS**\n\n`;
    response += `📊 **Analysis Depth:** ${reasoning.analysis_depth} completions\n`;
    response += `🎯 **Goal:** ${reasoning.project_goal}\n`;
    response += `🤖 **System Intelligence:** ${reasoning.system_intelligence_level}\n\n`;

    // Patterns Detected
    if (reasoning.deductive_reasoning.patterns_detected.length > 0) {
      response += `🔍 **PATTERNS DETECTED:**\n`;
      reasoning.deductive_reasoning.patterns_detected.forEach((pattern) => {
        response += `• **${pattern.type}:** ${pattern.implication}\n`;
        response += `  Evidence: ${pattern.evidence} (${Math.round(pattern.confidence * 100)}% confidence)\n`;
      });
      response += `\n`;
    }

    // Logical Chains
    if (reasoning.deductive_reasoning.logical_chains.length > 0) {
      response += `🔗 **LOGICAL REASONING CHAINS:**\n`;
      reasoning.deductive_reasoning.logical_chains.forEach((chain, index) => {
        response += `\n**Chain ${index + 1}** (${Math.round(chain.confidence * 100)}% confidence, ${chain.strategic_value} value):\n`;
        response += `• ${chain.premise_1}\n`;
        response += `• ${chain.premise_2}\n`;
        response += `• ${chain.premise_3}\n`;
        response += `• **Logic:** ${chain.logical_connection}\n`;
        response += `• **Conclusion:** ${chain.conclusion}\n`;
      });
      response += `\n`;
    }

    // Strategic Implications
    if (reasoning.deductive_reasoning.strategic_implications.length > 0) {
      response += `💡 **STRATEGIC IMPLICATIONS:**\n`;
      reasoning.deductive_reasoning.strategic_implications.forEach((impl) => {
        response += `• **${impl.category}:** ${impl.strategic_implication}\n`;
        response += `  Business Impact: ${impl.business_impact}\n`;
      });
      response += `\n`;
    }

    // Competitive Advantages
    if (reasoning.deductive_reasoning.competitive_advantages.length > 0) {
      response += `🏆 **COMPETITIVE ADVANTAGES IDENTIFIED:**\n`;
      reasoning.deductive_reasoning.competitive_advantages.forEach((adv) => {
        response += `• **${adv.advantage_type}:** ${adv.description}\n`;
        response += `  Market Rarity: ${adv.market_rarity}\n`;
        response += `  Value Proposition: ${adv.value_proposition}\n`;
      });
      response += `\n`;
    }

    // Emergent Opportunities
    if (reasoning.deductive_reasoning.opportunity_identification.length > 0) {
      response += `🚀 **EMERGENT OPPORTUNITIES:**\n`;
      reasoning.deductive_reasoning.opportunity_identification.forEach(
        (opp) => {
          response += `• **${opp.opportunity_type}:** ${opp.description}\n`;
          response += `  Timing: ${opp.timing}\n`;
          response += `  Requirements: ${opp.requirements?.join(", ")}\n`;
          response += `  Impact: ${opp.potential_impact}\n`;
        },
      );
      response += `\n`;
    }

    // Strategic Pivots
    if (reasoning.deductive_reasoning.recommended_pivots.length > 0) {
      response += `🔄 **RECOMMENDED STRATEGIC PIVOTS:**\n`;
      reasoning.deductive_reasoning.recommended_pivots.forEach((pivot) => {
        response += `• **From:** ${pivot.from}\n`;
        response += `• **To:** ${pivot.to}\n`;
        response += `• **Rationale:** ${pivot.rationale}\n`;
        response += `• **Implementation:** ${pivot.implementation}\n`;
      });
      response += `\n`;
    }

    // Next Logical Focus
    const nextFocus = reasoning.deductive_reasoning.next_logical_focus;
    response += `🎯 **DEDUCED NEXT FOCUS:**\n`;
    response += `• **Area:** ${nextFocus.focus_area}\n`;
    response += `• **Reasoning:** ${nextFocus.reasoning}\n`;
    response += `• **Priority:** ${nextFocus.priority}\n`;
    response += `• **Confidence:** ${Math.round(nextFocus.confidence * 100)}%\n\n`;

    // Actionable Insights
    if (reasoning.actionable_insights.length > 0) {
      response += `✅ **ACTIONABLE INSIGHTS:**\n`;
      reasoning.actionable_insights.forEach((insight) => {
        response += `• **${insight.priority.toUpperCase()} PRIORITY:** ${insight.insight}\n`;
        response += `  Action: ${insight.action}\n`;
      });
      response += `\n`;
    }

    response += `---\n**Analysis Confidence:** ${Math.round(reasoning.deductive_reasoning.confidence_scores * 100)}%\n`;
    response += `**Timestamp:** ${reasoning.timestamp}`;

    return {
      content: [
        {
          type: "text",
          text: response,
        },
      ],
    };
  }

  // Helper function to check if task is relevant to learning path
  isTaskRelevantToPath(task, pathName) {
    if (!pathName || pathName === "general") return true;
    return (
      task.path_specific === true ||
      task.branch_type === pathName ||
      task.title.toLowerCase().includes(pathName.toLowerCase())
    );
  }

  // Helper function to detect emergent opportunities
  detectEmergentOpportunities(_completedTask, _completionContext) {
    // Placeholder for opportunity detection logic
    return [];
  }

  // Helper function to invalidate unnecessary tasks
  invalidateUnnecessaryTasks(frontierNodes, _completedTask, _completionContext) {
    // Return the frontier nodes as-is for now
    return frontierNodes;
  }

  // Helper function to generate smart next tasks
  async generateSmartNextTasks(
    projectConfig,
    learningHistory,
    completedTaskIds,
  ) {
    // Generate continuation tasks based on learning history
    const newTasks = [];
    const recentTopics = learningHistory.completed_topics.slice(-3);

    if (recentTopics.length > 0) {
      const lastTopic = recentTopics[recentTopics.length - 1];
      newTasks.push({
        id: this.generateId(),
        title: `Build on: ${lastTopic.topic}`,
        description: `Continue developing skills from ${lastTopic.topic}`,
        branch_type: "continuation",
        estimated_time: "30 minutes",
        priority: "high",
        status: "ready",
        knowledge_level: "intermediate",
        magnitude: 5,
        prerequisites: [],
        learning_outcomes: [
          "Deepen understanding",
          "Apply knowledge",
          "Build confidence",
        ],
      });
    }

    return newTasks;
  }

  async evolveStrategy(feedback = "") {
    const projectId = await this.requireActiveProject();
    const learningHistory = (await this.loadProjectData(
      projectId,
      "learning_history.json",
    )) || {
      completed_topics: [],
      skill_levels: {},
      knowledge_gaps: [],
      insights: [],
    };

    // Analyze patterns
    const recentCompletions = learningHistory.completed_topics.slice(-10);
    const avgDifficulty =
      recentCompletions.reduce((sum, t) => sum + (t.difficulty || 3), 0) /
      (recentCompletions.length || 1);
    const breakthroughRate =
      recentCompletions.filter((t) => t.breakthrough).length /
      (recentCompletions.length || 1);

    let analysis = `📈 Strategy Evolution Analysis\n\n`;
    analysis += `📊 Recent Performance:\n`;
    analysis += `• Completed topics: ${learningHistory.completed_topics.length}\n`;
    analysis += `• Average difficulty: ${avgDifficulty.toFixed(1)}/5\n`;
    analysis += `• Breakthrough rate: ${(breakthroughRate * 100).toFixed(0)}%\n\n`;

    analysis += `🧠 Insights:\n`;
    if (avgDifficulty > 4) {
      analysis += `• Tasks have been very challenging. Recommending easier stepping stones.\n`;
    } else if (avgDifficulty < 2) {
      analysis += `• Tasks have been too easy. Time to increase complexity.\n`;
    }

    if (learningHistory.knowledge_gaps.length > 0) {
      analysis += `• ${learningHistory.knowledge_gaps.length} knowledge gaps identified for future exploration.\n`;
    }

    if (feedback) {
      analysis += `\n💬 Your Feedback: "${feedback}"\n`;
      analysis += `✅ Feedback recorded and will influence future recommendations.\n`;

      // Save feedback
      learningHistory.insights.push({
        date: this.getTodayDate(),
        feedback: feedback,
        context: "strategy_evolution",
      });
      await this.saveProjectData(
        projectId,
        "learning_history.json",
        learningHistory,
      );
    }

    analysis += `\n🔄 System continuously learning from your progress!`;

    return {
      content: [
        {
          type: "text",
          text: analysis,
        },
      ],
    };
  }

  async generateTiimoExport(includeBreaks = true) {
    const projectId = await this.requireActiveProject();
    const today = this.getTodayDate();
    const schedule = await this.loadProjectData(projectId, `day_${today}.json`);

    if (!schedule) {
      throw new Error(
        "No schedule found for today. Use orchestrate_day first.",
      );
    }

    let markdown = `# ${schedule.north_star} - ${today}\n\n`;
    markdown += `## Daily Learning Blocks\n\n`;

    for (const block of schedule.time_blocks) {
      markdown += `### ${block.time} - ${block.action}\n`;
      markdown += `**Duration:** ${block.duration}\n`;
      markdown += `**Focus:** ${block.strategic_purpose}\n`;
      markdown += `**Goal:** ${block.learning_outcomes[0]}\n\n`;

      if (block.description) {
        markdown += `${block.description}\n\n`;
      }

      if (includeBreaks && block.magnitude > 7) {
        markdown += `### Break - 5 minutes\n`;
        markdown += `Stand up, stretch, hydrate\n\n`;
      }
    }

    markdown += `---\n\n`;
    markdown += `*Generated by Forest HTA System*\n`;
    markdown += `*Remember: Each block builds on the previous one!*`;

    // Save to file system if available
    // const filename = `tiimo_export_${today}.md`; // Reserved for future file export

    return {
      content: [
        {
          type: "text",
          text: `📱 Tiimo Export Generated!\n\n${markdown}\n\n💾 Save this markdown and import into Tiimo for today's schedule.`,
        },
      ],
    };
  }

  async analyzePerformance() {
    const projectId = await this.requireActiveProject();
    try {
      const projectDir = this.getProjectDir(projectId);
      const files = await fs.readdir(projectDir);
      const dayFiles = files.filter(
        (f) => f.startsWith("day_") && f.endsWith(".json"),
      );

      if (dayFiles.length === 0) {
        return {
          content: [
            { type: "text", text: "No daily data found for this project." },
          ],
        };
      }

      // Load all day files
      let totalBlocks = 0;
      let completedBlocks = 0;
      let breakthroughs = 0;
      const energyData = [];
      const difficultyData = [];

      for (const file of dayFiles) {
        const dayData = await this.loadProjectData(projectId, file);
        if (dayData) {
          totalBlocks += dayData.total_blocks || 0;
          completedBlocks += dayData.completed || 0;

          dayData.time_blocks?.forEach((block) => {
            if (block.completed) {
              if (block.breakthrough) {
                breakthroughs++;
              }
              if (block.energy_after) {
                energyData.push(block.energy_after);
              }
              if (block.difficulty_rating) {
                difficultyData.push(block.difficulty_rating);
              }
            }
          });
        }
      }

      const completionRate =
        totalBlocks > 0
          ? ((completedBlocks / totalBlocks) * 100).toFixed(1)
          : 0;
      const avgEnergy =
        energyData.length > 0
          ? (energyData.reduce((a, b) => a + b, 0) / energyData.length).toFixed(
              1,
            )
          : 0;
      const avgDifficulty =
        difficultyData.length > 0
          ? (
              difficultyData.reduce((a, b) => a + b, 0) / difficultyData.length
            ).toFixed(1)
          : 0;

      return {
        content: [
          {
            type: "text",
            text: `📊 Performance Analysis for "${projectId}"\n\n📅 Days tracked: ${dayFiles.length}\n✅ Completion rate: ${completionRate}%\n🎯 Total blocks completed: ${completedBlocks}/${totalBlocks}\n🎉 Breakthroughs: ${breakthroughs}\n\n⚡ Average energy after tasks: ${avgEnergy}/5\n📈 Average task difficulty: ${avgDifficulty}/5\n\n💡 Insights:\n${completionRate > 80 ? "• Excellent consistency! Keep it up!" : "• Room for improvement in daily completion."}\n${avgEnergy > 3 ? "• Tasks are energizing you!" : "• Consider easier tasks to maintain energy."}\n${breakthroughs > 0 ? `• ${breakthroughs} breakthroughs show real progress!` : "• Keep pushing for those breakthrough moments!"}`,
          },
        ],
      };
    } catch {
      return {
        content: [{ type: "text", text: "Error analyzing performance data." }],
      };
    }
  }

  async reviewPeriod(days) {
    const projectId = await this.requireActiveProject();
    try {
      const projectDir = this.getProjectDir(projectId);
      const files = await fs.readdir(projectDir);
      const dayFiles = files
        .filter((f) => f.startsWith("day_") && f.endsWith(".json"))
        .slice(-days);

      if (dayFiles.length === 0) {
        return {
          content: [
            { type: "text", text: `No data found for the last ${days} days.` },
          ],
        };
      }

      const learningHistory = (await this.loadProjectData(
        projectId,
        "learning_history.json",
      )) || {
        completed_topics: [],
        insights: [],
      };

      const recentTopics = learningHistory.completed_topics.slice(-20);
      const recentBreakthroughs = recentTopics.filter((t) => t.breakthrough);
      const topicsLearned = recentTopics.map((t) => t.topic).join(", ");

      let review = `📅 ${days}-Day Review for "${projectId}"\n\n`;
      review += `📚 Topics Explored: ${recentTopics.length}\n`;
      review += `🎉 Breakthroughs: ${recentBreakthroughs.length}\n\n`;

      if (recentBreakthroughs.length > 0) {
        review += `💡 Recent Breakthroughs:\n`;
        recentBreakthroughs.forEach((b) => {
          review += `• ${b.topic} (${b.date})\n`;
        });
        review += "\n";
      }

      review += `🔍 Key Areas Covered:\n${topicsLearned}\n\n`;
      review += `🚀 Keep building on this momentum!`;

      return {
        content: [
          {
            type: "text",
            text: review,
          },
        ],
      };
    } catch {
      return { content: [{ type: "text", text: "Error generating review." }] };
    }
  }

  async debugTaskSequence() {
    const projectId = await this.requireActiveProject();
    const projectConfig = await this.loadProjectData(projectId, "config.json");
    const activePath = projectConfig?.active_learning_path || "general";

    // Use same data loading logic as get_next_task
    let hta = await this.loadPathData(projectId, activePath, "hta.json");
    if (!hta) {
      hta = await this.loadProjectData(projectId, "hta.json");
    }

    if (!hta) {
      return {
        content: [
          { type: "text", text: "No HTA tree found for this project." },
        ],
      };
    }

    const completedTaskIds = hta.completed_nodes?.map((n) => n.id) || [];
    const completedTaskTitles = hta.completed_nodes?.map((n) => n.title) || [];
    const learningHistory = (await this.loadPathData(
      projectId,
      activePath,
      "learning_history.json",
    )) ||
      (await this.loadProjectData(projectId, "learning_history.json")) || {
        completed_topics: [],
      };

    let debug = `🔍 TASK SEQUENCE DEBUG for "${projectId}"\\n\\n`;

    // Show completed tasks
    debug += `✅ COMPLETED TASKS (${hta.completed_nodes?.length || 0}):\\n`;
    hta.completed_nodes?.forEach((node, index) => {
      debug += `${index + 1}. ${node.title} (ID: ${node.id})\\n`;
    });

    debug += `\\n🎯 FRONTIER TASKS (${hta.frontier_nodes?.length || 0}):\\n`;
    hta.frontier_nodes?.forEach((node, index) => {
      // Use same prerequisite checking logic as get_next_task
      const prereqStatus =
        node.prerequisites
          ?.map((prereq) => {
            // Primary: Check exact ID match
            if (completedTaskIds.includes(prereq)) {
              return `${prereq}✅`;
            }
            // Fallback: Check exact title match
            if (completedTaskTitles.includes(prereq)) {
              return `${prereq}✅`;
            }
            // Last resort: Check completed topics
            if (
              learningHistory.completed_topics.some(
                (topic) => topic.topic === prereq,
              )
            ) {
              return `${prereq}✅`;
            }
            return `${prereq}❌`;
          })
          .join(", ") || "None";

      const readyStatus = node.status === "ready" ? "🟢" : "🔴";

      // Use same prerequisite validation as get_next_task
      const allPrereqsMet =
        !node.prerequisites?.length ||
        node.prerequisites.every((prereq) => {
          if (completedTaskIds.includes(prereq)) {
            return true;
          }
          if (completedTaskTitles.includes(prereq)) {
            return true;
          }
          return learningHistory.completed_topics.some(
            (topic) => topic.topic === prereq,
          );
        });

      // Use same path relevance check as get_next_task
      const isPathRelevant = this.isTaskRelevantToPath(node, activePath);
      const pathStatus = isPathRelevant ? "🎯" : "⚪";

      debug += `${index + 1}. ${readyStatus}${pathStatus} ${node.title}\\n`;
      debug += `   Branch: ${node.branch_type} | Priority: ${node.priority} | Magnitude: ${node.magnitude}\\n`;
      debug += `   Prerequisites: ${prereqStatus}\\n`;
      debug += `   Status: ${node.status} | All Met: ${allPrereqsMet ? "✅" : "❌"} | Path Relevant: ${isPathRelevant ? "✅" : "❌"}\\n\\n`;
    });

    // Show what get_next_task would actually return
    debug += `\\n🎯 WHAT GET_NEXT_TASK WOULD RETURN:\\n`;
    const readyTasks =
      hta.frontier_nodes?.filter((node) => {
        const prereqsMet =
          !node.prerequisites?.length ||
          node.prerequisites.every((prereq) => {
            if (completedTaskIds.includes(prereq)) {
              return true;
            }
            if (completedTaskTitles.includes(prereq)) {
              return true;
            }
            return learningHistory.completed_topics.some(
              (topic) => topic.topic === prereq,
            );
          });
        const isReady = node.status === "ready";
        const isPathRelevant = this.isTaskRelevantToPath(node, activePath);
        return isReady && prereqsMet && isPathRelevant;
      }) || [];

    if (readyTasks.length > 0) {
      debug += `Found ${readyTasks.length} task(s) that meet all criteria:\\n`;
      readyTasks.forEach((task, i) => {
        debug += `${i + 1}. ${task.title} (Priority: ${task.priority}, Magnitude: ${task.magnitude})\\n`;
      });
    } else {
      debug += `No tasks currently meet all criteria (ready status + prerequisites + path relevance)\\n`;
      debug += `get_next_task would generate new adaptive tasks or suggest sequence repair\\n`;
    }

    return {
      content: [
        {
          type: "text",
          text: debug,
        },
      ],
    };
  }

  async repairSequence(forceRebuild = false) {
    const projectId = await this.requireActiveProject();
    const projectConfig = await this.loadProjectData(projectId, "config.json");
    const hta = await this.loadProjectData(projectId, "hta.json");
    const learningHistory = (await this.loadProjectData(
      projectId,
      "learning_history.json",
    )) || {
      completed_topics: [],
      skill_levels: {},
      knowledge_gaps: [],
    };

    if (!hta || !projectConfig) {
      return {
        content: [
          {
            type: "text",
            text: "Missing project data. Cannot repair sequence.",
          },
        ],
      };
    }

    const repairActions = [];
    let newFrontierNodes = [];

    if (forceRebuild) {
      // Complete rebuild - generate fresh frontier based on current progress
      repairActions.push("🔄 Complete rebuild requested");
      newFrontierNodes = this.generateSequencedFrontierNodes(
        projectConfig,
        learningHistory,
      );
      repairActions.push(`✨ Generated ${newFrontierNodes.length} fresh tasks`);
    } else {
      // Smart repair - fix existing issues
      const completedTaskIds = hta.completed_nodes?.map((n) => n.id) || [];
      const orphanedTasks = [];
      const validTasks = [];

      // Validate each frontier task
      hta.frontier_nodes.forEach((node) => {
        if (!node.prerequisites || node.prerequisites.length === 0) {
          validTasks.push(node); // No prerequisites to validate
        } else {
          const invalidPrereqs = node.prerequisites.filter(
            (prereq) =>
              !completedTaskIds.includes(prereq) &&
              !hta.frontier_nodes.some((fn) => fn.id === prereq),
          );

          if (invalidPrereqs.length > 0) {
            repairActions.push(
              `🔧 Fixed orphaned task: ${node.title} (removed invalid prereqs: ${invalidPrereqs.join(", ")})`,
            );
            node.prerequisites = node.prerequisites.filter(
              (prereq) => !invalidPrereqs.includes(prereq),
            );
            orphanedTasks.push(node);
          }
          validTasks.push(node);
        }
      });

      // Generate new tasks if frontier is empty or broken
      if (validTasks.length === 0) {
        repairActions.push(
          "⚠️ No valid frontier tasks found - generating new sequence",
        );
        newFrontierNodes = this.generateSequencedFrontierNodes(
          projectConfig,
          learningHistory,
        );
      } else {
        newFrontierNodes = validTasks;

        // Add fresh tasks if we're running low
        if (newFrontierNodes.filter((n) => n.status === "ready").length < 2) {
          const additionalTasks = await this.generateSmartNextTasks(
            projectConfig,
            learningHistory,
            completedTaskIds,
          );
          newFrontierNodes.push(...additionalTasks);
          repairActions.push(
            `📈 Added ${additionalTasks.length} new tasks to maintain flow`,
          );
        }
      }
    }

    // Update HTA with repaired frontier
    hta.frontier_nodes = newFrontierNodes;
    hta.last_evolution = new Date().toISOString();
    hta.sequence_repairs = (hta.sequence_repairs || 0) + 1;

    const saved = await this.saveProjectData(projectId, "hta.json", hta);
    if (!saved) {
      return {
        content: [
          { type: "text", text: "❌ Failed to save repaired sequence" },
        ],
      };
    }

    const readyTasks = newFrontierNodes.filter((n) => n.status === "ready");

    return {
      content: [
        {
          type: "text",
          text: `🔧 Sequence Repair Complete\n\n${repairActions.join("\n")}\n\n📊 Result:\n• ${newFrontierNodes.length} total tasks in frontier\n• ${readyTasks.length} tasks ready to work on\n• Sequence should flow smoothly now\n\n✅ Try 'get_next_task' to continue learning!`,
        },
      ],
    };
  }

  async generateSmartNextTasks(
    projectConfig,
    learningHistory,
    completedTaskIds,
  ) {
    const interests = projectConfig.specific_interests || [];
    const recentCompletions = learningHistory.completed_topics.slice(-3);
    const tasks = [];

    // Generate tasks based on recent learning momentum
    if (recentCompletions.length > 0) {
      const lastTopic = recentCompletions[recentCompletions.length - 1];

      // Build on what they just learned
      tasks.push({
        id: this.generateId(),
        title: `Build On: ${lastTopic.topic}`,
        description: `Apply and extend what you learned from: ${lastTopic.topic}`,
        branch_type: "practical",
        estimated_time: "As long as needed",
        priority: "high",
        status: "ready",
        knowledge_level: "intermediate",
        magnitude: 6,
        prerequisites: [],
        learning_outcomes: [
          `Apply ${lastTopic.topic} knowledge`,
          "Deepen understanding",
          "Build confidence",
        ],
        generated_from: "recent_completion",
      });
    }

    // Generate interest-driven tasks if we have interests but no current tasks targeting them
    if (interests.length > 0) {
      interests.forEach((interest) => {
        tasks.push({
          id: this.generateId(),
          title: `Progress Toward: ${interest}`,
          description: `Continue working toward your goal: ${interest}`,
          branch_type: "interest_driven",
          estimated_time: "As long as needed",
          priority: "critical",
          status: "ready",
          knowledge_level: "beginner",
          magnitude: 6,
          prerequisites: [],
          learning_outcomes: [
            `Make progress on ${interest}`,
            "Maintain motivation",
            "Build practical skills",
          ],
          interest_based: true,
          generated_from: "interest_continuation",
        });
      });
    }

    return tasks.slice(0, 3); // Limit to prevent overwhelming
  }

  async focusLearningPath(pathName, duration) {
    const projectId = await this.requireActiveProject();
    const projectConfig = await this.loadProjectData(projectId, "config.json");

    if (!projectConfig) {
      throw new Error("Project configuration not found");
    }

    // Validate path exists or allow dynamic creation
    const existingPaths = projectConfig.learning_paths || [];
    const pathExists = existingPaths.some(
      (p) => p.path_name.toLowerCase() === pathName.toLowerCase(),
    );

    if (!pathExists && existingPaths.length > 0) {
      // Add new path dynamically
      existingPaths.push({
        path_name: pathName,
        interests: [],
        priority: "medium",
        created_dynamically: true,
      });
      projectConfig.learning_paths = existingPaths;
    }

    // Set active path
    projectConfig.active_learning_path = pathName;
    projectConfig.path_focus_duration = duration;
    projectConfig.path_focused_at = new Date().toISOString();

    const saved = await this.saveProjectData(
      projectId,
      "config.json",
      projectConfig,
    );
    if (!saved) {
      throw new Error("Failed to save path focus");
    }

    // Filter tasks to show only path-relevant ones
    const hta = await this.loadProjectData(projectId, "hta.json");
    if (hta) {
      // Mark path-relevant tasks as priority
      hta.frontier_nodes.forEach((node) => {
        if (this.isTaskRelevantToPath(node, pathName)) {
          node.path_priority = true;
          node.path_focus = pathName;
        } else {
          node.path_priority = false;
        }
      });
      await this.saveProjectData(projectId, "hta.json", hta);
    }

    // Show current path-focused tasks
    const pathTasks =
      hta?.frontier_nodes?.filter(
        (n) => n.status === "ready" && this.isTaskRelevantToPath(n, pathName),
      ) || [];

    return {
      content: [
        {
          type: "text",
          text: `🎯 Focused on Learning Path: "${pathName}"\\n\\n⏱️ Duration: ${duration}\\n🎵 Goal: ${projectConfig.goal}\\n\\n📋 Path-Relevant Tasks Available: ${pathTasks.length}\\n${pathTasks
            .slice(0, 3)
            .map((t) => `• ${t.title}`)
            .join(
              "\\n",
            )}\\n\\n✨ All task recommendations will now prioritize "${pathName}" work.\\n💡 Use 'get_next_task' to continue or 'list_learning_paths' to see all paths.`,
        },
      ],
    };
  }

  async listLearningPaths() {
    const projectId = await this.requireActiveProject();
    const projectConfig = await this.loadProjectData(projectId, "config.json");
    const hta = await this.loadProjectData(projectId, "hta.json");

    if (!projectConfig) {
      throw new Error("Project configuration not found");
    }

    let pathList = [];
    const activePath = projectConfig.active_learning_path;

    // Show explicitly defined paths
    if (
      projectConfig.learning_paths &&
      projectConfig.learning_paths.length > 0
    ) {
      projectConfig.learning_paths.forEach((path) => {
        const isActive = path.path_name === activePath ? " 🎯 ACTIVE" : "";
        const taskCount =
          hta?.frontier_nodes?.filter((n) =>
            this.isTaskRelevantToPath(n, path.path_name),
          ).length || 0;

        pathList.push(`• **${path.path_name}**${isActive}`);
        pathList.push(
          `  Interests: ${path.interests?.join(", ") || "General exploration"}`,
        );
        pathList.push(
          `  Priority: ${path.priority || "medium"} | Available tasks: ${taskCount}`,
        );
        pathList.push("");
      });
    }

    // Show auto-discovered paths from task branches
    const discoveredPaths = new Set();
    if (hta?.frontier_nodes) {
      hta.frontier_nodes.forEach((node) => {
        if (
          node.branch_type &&
          !["fundamentals", "tools", "practical", "research"].includes(
            node.branch_type,
          )
        ) {
          discoveredPaths.add(node.branch_type);
        }
      });
    }

    if (discoveredPaths.size > 0) {
      pathList.push("🔍 **Auto-Discovered Paths:**");
      discoveredPaths.forEach((path) => {
        const isActive = path === activePath ? " 🎯 ACTIVE" : "";
        const taskCount =
          hta?.frontier_nodes?.filter((n) => this.isTaskRelevantToPath(n, path))
            .length || 0;
        pathList.push(`• ${path}${isActive} (${taskCount} tasks)`);
      });
    }

    if (pathList.length === 0) {
      pathList.push("No learning paths defined yet.");
      pathList.push(
        "💡 Use interests to auto-create paths or use focus_learning_path to create one.",
      );
    }

    return {
      content: [
        {
          type: "text",
          text: `📚 Learning Paths in "${projectId}"\\n\\n${pathList.join("\\n")}\\n\\n💡 Use 'focus_learning_path' to switch focus between paths.`,
        },
      ],
    };
  }

  isTaskRelevantToPath(task, pathName) {
    const pathLower = pathName.toLowerCase();

    // Check if task explicitly tagged for this path
    if (task.path_focus === pathName) return true;

    // Check task title and description
    if (task.title.toLowerCase().includes(pathLower)) return true;
    if (task.description?.toLowerCase().includes(pathLower)) return true;

    // Check branch type
    if (task.branch_type === pathLower) return true;

    // Check learning outcomes
    if (
      task.learning_outcomes?.some((outcome) =>
        outcome.toLowerCase().includes(pathLower),
      )
    )
      return true;

    // Check if task relates to path-specific interests
    if (task.interest_based && task.title.toLowerCase().includes(pathLower))
      return true;

    return false;
  }

  // Fetch HTA tree based on the active learning path; fallback to project-wide HTA
  async getActiveHTA(projectId) {
    const projectConfig = await this.loadProjectData(projectId, "config.json");
    if (!projectConfig) return null;
    const activePath = projectConfig.active_learning_path || "general";
    let hta = await this.loadPathData(projectId, activePath, "hta.json");
    if (!hta) {
      hta = await this.loadProjectData(projectId, "hta.json");
    }
    return hta;
  }

  // IMPOSSIBLE DREAM ORCHESTRATION: Detect emergent opportunities from task completion
  detectEmergentOpportunities(completedTask, completionContext = {}) {
    const opportunities = [];
    const {
      engagementLevel = 5,
      unexpectedResults = [],
      newSkillsRevealed = [],
      externalFeedback = [],
    } = completionContext;

    // HIGH ENGAGEMENT BREAKTHROUGH DETECTION
    if (engagementLevel >= 8) {
      opportunities.push({
        id: this.generateId(),
        title: `Amplify Success: ${completedTask.title}`,
        description: `Your high engagement with "${completedTask.title}" suggests deeper potential. Let's explore this further.`,
        branch_type: "breakthrough_amplification",
        estimated_time: completedTask.estimated_time || "25 minutes",
        priority: "high",
        status: "ready",
        magnitude: Math.max(3, completedTask.magnitude - 1),
        prerequisites: [completedTask.id],
        generated_from: "high_engagement_detection",
        learning_outcomes: [
          "Explore natural talent",
          "Build on momentum",
          "Discover hidden capabilities",
        ],
      });
    }

    // UNEXPECTED RESULT PATHWAY GENERATION
    unexpectedResults.forEach((result, _index) => {
      opportunities.push({
        id: this.generateId(),
        title: `Explore Unexpected: ${result}`,
        description: `The unexpected result "${result}" from "${completedTask.title}" may open new pathways we hadn't considered.`,
        branch_type: "serendipity_pathway",
        estimated_time: "15 minutes",
        priority: "medium",
        status: "ready",
        magnitude: 4,
        prerequisites: [completedTask.id],
        generated_from: "unexpected_result_detection",
        learning_outcomes: [
          "Investigate serendipity",
          "Explore new directions",
          "Follow emerging opportunities",
        ],
      });
    });

    // NEW SKILL REVELATION EXPANSION
    newSkillsRevealed.forEach((skill, _index) => {
      opportunities.push({
        id: this.generateId(),
        title: `Develop Hidden Talent: ${skill}`,
        description: `Completing "${completedTask.title}" revealed you have natural ability in ${skill}. Let's build on this.`,
        branch_type: "hidden_talent_development",
        estimated_time: "30 minutes",
        priority: "high",
        status: "ready",
        magnitude: 5,
        prerequisites: [completedTask.id],
        generated_from: "skill_revelation_detection",
        learning_outcomes: [
          `Develop ${skill}`,
          "Build confidence",
          "Explore natural abilities",
        ],
      });
    });

    // EXTERNAL FEEDBACK OPPORTUNITY AMPLIFICATION
    externalFeedback.forEach((feedback, _index) => {
      if (
        feedback.sentiment === "positive" ||
        feedback.includes("viral") ||
        feedback.includes("interested")
      ) {
        opportunities.push({
          id: this.generateId(),
          title: `Leverage External Interest: ${feedback.source || "Unknown"}`,
          description: `External feedback on "${completedTask.title}": "${feedback.content || feedback}". This could be an opportunity.`,
          branch_type: "external_opportunity",
          estimated_time: "20 minutes",
          priority: "critical",
          status: "ready",
          magnitude: 6,
          prerequisites: [completedTask.id],
          generated_from: "external_feedback_detection",
          learning_outcomes: [
            "Capitalize on interest",
            "Build external connections",
            "Amplify reach",
          ],
        });
      }
    });

    return opportunities;
  }

  // ADAPTIVE DEPENDENCY INVALIDATION: Remove tasks that become unnecessary
  invalidateUnnecessaryTasks(
    frontierNodes,
    completedTask,
    completionContext = {},
  ) {
    const {
      newSkillsRevealed = [],
      unexpectedResults = [],
      shorterPathDiscovered = false,
    } = completionContext;

    return frontierNodes.filter((node) => {
      // If the completed task revealed skills that make other tasks unnecessary
      const skillBasedInvalidation = newSkillsRevealed.some(
        (skill) =>
          node.title.toLowerCase().includes(skill.toLowerCase()) &&
          node.branch_type === "fundamentals" &&
          completedTask.branch_type !== "fundamentals",
      );

      // If unexpected results show a task is no longer needed
      const resultBasedInvalidation = unexpectedResults.some(
        (result) =>
          node.description &&
          node.description.toLowerCase().includes(result.toLowerCase()) &&
          node.magnitude <= completedTask.magnitude,
      );

      // If a shorter path was discovered that bypasses certain preparatory steps
      const pathBasedInvalidation =
        shorterPathDiscovered &&
        node.branch_type === "preparation" &&
        node.prerequisites.includes(completedTask.id);

      // Keep the task unless it's been invalidated
      return !(
        skillBasedInvalidation ||
        resultBasedInvalidation ||
        pathBasedInvalidation
      );
    });
  }

  // Domain-agnostic goal analysis helper function
  detectGoalDomain(goal) {
    const prompt = `Analyze the user goal: "${goal}" and classify it into a broad domain category. Return strictly as JSON with keys: domain (one or two words), complexity (1-5 scale), timeframe (estimated completion time), and keyAreas (3-5 main focus areas for this goal).`;
    try {
      const result = this.callClaude(prompt, "json"); // synchronous hand-off in MCP runtime
      const data = typeof result === "string" ? JSON.parse(result) : result;
      if (data && data.domain) {
        return {
          domain: data.domain,
          complexity: data.complexity || 3,
          timeframe: data.timeframe || 'medium-term',
          keyAreas: data.keyAreas || [],
          careerPaths: data.careerPaths || [],
          timeToEmployability: data.timeToEmployability || "unknown",
        };
      }
      throw new Error("Malformed Claude response");
    } catch (err) {
      console.error("detectGoalDomain fallback:", err.message);
      // Generic fallback (domain-agnostic)
      return {
        domain: "general",
        urgentSkills: ["Research", "Planning", "Execution", "Feedback"],
        careerPaths: ["Goal-specific roles"],
        timeToEmployability: "variable",
      };
    }
  }

  /* ------------------------------------------------------------------
   * LLM Integration Helpers (Claude)
   * These provide a single point for making requests to Claude and
   * parsing responses. They can be swapped out when you connect to
   * the real Memory-MCP / Anthropic endpoint.
   * ------------------------------------------------------------------ */
  async callClaude(prompt, responseType = "json") {
    /*
      Placeholder implementation.
      Replace with your actual call to Memory-MCP or Anthropic.
      Expected to return either a JSON string or already-parsed object
      depending on your API wrapper.
    */
    console.warn("[callClaude] No Claude backend configured. Falling back.");
    throw new Error("Claude backend not configured");
  }

  async callClaudeForBranches(prompt) {
    try {
      const raw = await this.callClaude(prompt, "json");
      const data = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (Array.isArray(data)) {
        return data;
      }
      throw new Error("Claude returned non-array for branches");
    } catch (err) {
      console.error("Claude branch generation error:", err.message);
      throw err; // Upstream catch will trigger fallback
    }
  }

  async callClaudeForNodes(prompt) {
    try {
      const raw = await this.callClaude(prompt, "json");
      const data = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (Array.isArray(data)) {
        return data;
      }
      throw new Error("Claude returned non-array for nodes");
    } catch (err) {
      console.error("Claude node generation error:", err.message);
      throw err; // Upstream catch will trigger fallback
    }
  }

  // ========================================
  // 🌟 INFINITE SCALING COMPLEXITY ENGINE
  // ========================================

  // COMPLEXITY DETECTION ENGINE - Recognizes when user is ready for higher complexity
  analyzeComplexityIndicators(learningHistory, completionContext = {}) {
    const recentCompletions =
      learningHistory.completed_topics?.slice(-10) || [];
    const indicators = {
      // FINANCIAL COMPLEXITY DETECTION
      financial_tracking: {
        level: 0,
        signals: [],
        detected: false,
      },

      // PEOPLE COORDINATION COMPLEXITY
      people_coordination: {
        level: 0,
        signals: [],
        detected: false,
      },

      // TIME HORIZON COMPLEXITY
      time_horizons: {
        level: 0,
        signals: [],
        detected: false,
      },

      // DECISION WEIGHT COMPLEXITY
      decision_weight: {
        level: 0,
        signals: [],
        detected: false,
      },

      // STRATEGIC THINKING COMPLEXITY
      strategic_thinking: {
        level: 0,
        signals: [],
        detected: false,
      },
    };

    // ANALYZE FINANCIAL COMPLEXITY PATTERNS
    recentCompletions.forEach((completion) => {
      const content = (
        completion.topic +
        " " +
        (completion.learned || "") +
        " " +
        (completion.outcome || "")
      ).toLowerCase();

      // Financial indicators
      if (
        content.match(
          /\$[\d,]+|revenue|profit|cost|budget|pricing|sales|income|expense/,
        )
      ) {
        indicators.financial_tracking.signals.push(completion.topic);
        if (content.match(/\$[\d,]{4,}|revenue.*\d+k|profit.*\d+/)) {
          indicators.financial_tracking.level = Math.max(
            indicators.financial_tracking.level,
            2,
          );
        } else {
          indicators.financial_tracking.level = Math.max(
            indicators.financial_tracking.level,
            1,
          );
        }
      }

      // People coordination indicators
      if (
        content.match(
          /team|people|coordinate|manage|lead|delegate|hire|meeting|collaborate|staff/,
        )
      ) {
        indicators.people_coordination.signals.push(completion.topic);
        if (content.match(/hire|staff|manage.*team|lead.*people/)) {
          indicators.people_coordination.level = Math.max(
            indicators.people_coordination.level,
            2,
          );
        } else {
          indicators.people_coordination.level = Math.max(
            indicators.people_coordination.level,
            1,
          );
        }
      }

      // Time horizon indicators
      if (
        content.match(
          /quarter|year|long.?term|strategy|plan.*month|roadmap|vision/,
        )
      ) {
        indicators.time_horizons.signals.push(completion.topic);
        if (content.match(/year|quarterly|annual|long.?term.*strategy/)) {
          indicators.time_horizons.level = Math.max(
            indicators.time_horizons.level,
            2,
          );
        } else {
          indicators.time_horizons.level = Math.max(
            indicators.time_horizons.level,
            1,
          );
        }
      }

      // Decision weight indicators
      if (
        content.match(
          /decision|choose|strategy|invest|acquire|partner|contract|legal/,
        )
      ) {
        indicators.decision_weight.signals.push(completion.topic);
        if (
          content.match(
            /invest|acquire|partner.*company|legal.*contract|strategic.*decision/,
          )
        ) {
          indicators.decision_weight.level = Math.max(
            indicators.decision_weight.level,
            2,
          );
        } else {
          indicators.decision_weight.level = Math.max(
            indicators.decision_weight.level,
            1,
          );
        }
      }

      // Strategic thinking indicators
      if (
        content.match(
          /market|competition|industry|scale|growth|expansion|opportunity/,
        )
      ) {
        indicators.strategic_thinking.signals.push(completion.topic);
        if (
          content.match(
            /market.*analysis|industry.*trends|scale.*operation|growth.*strategy/,
          )
        ) {
          indicators.strategic_thinking.level = Math.max(
            indicators.strategic_thinking.level,
            2,
          );
        } else {
          indicators.strategic_thinking.level = Math.max(
            indicators.strategic_thinking.level,
            1,
          );
        }
      }
    });

    // DETERMINE DETECTION STATUS
    Object.keys(indicators).forEach((key) => {
      indicators[key].detected = indicators[key].level > 0;
    });

    // CALCULATE OVERALL COMPLEXITY LEVEL
    const totalComplexity = Object.values(indicators).reduce(
      (sum, indicator) => sum + indicator.level,
      0,
    );
    const activeIndicators = Object.values(indicators).filter(
      (indicator) => indicator.detected,
    ).length;

    return {
      indicators,
      overall_complexity_level: totalComplexity,
      active_complexity_domains: activeIndicators,
      ready_for_scaling: totalComplexity >= 3 && activeIndicators >= 2,
      complexity_tier: this.determineComplexityTier(
        totalComplexity,
        activeIndicators,
      ),
    };
  }

  // COMPLEXITY TIER DETERMINATION
  determineComplexityTier(totalComplexity, activeIndicators) {
    if (totalComplexity === 0) return "individual"; // Personal tasks only
    if (totalComplexity <= 3 && activeIndicators <= 2) return "coordination"; // Basic coordination
    if (totalComplexity <= 6 && activeIndicators <= 3) return "management"; // Multi-domain management
    if (totalComplexity <= 10 && activeIndicators <= 4) return "strategic"; // Strategic operations
    return "enterprise"; // Full enterprise complexity
  }

  // PATTERN-BASED TASK SCALING
  generateComplexityAppropriateTask(
    complexityAnalysis,
    projectConfig,
    learningHistory,
  ) {
    const { complexity_tier, indicators } = complexityAnalysis;
    const tasks = [];

    // GENERATE TASKS BASED ON DETECTED COMPLEXITY PATTERNS
    if (
      indicators.financial_tracking.detected &&
      indicators.financial_tracking.level >= 1
    ) {
      if (complexity_tier === "coordination") {
        tasks.push({
          id: this.generateId(),
          title: "Track Weekly Revenue Patterns",
          description:
            "Monitor and analyze your weekly revenue trends to identify growth opportunities",
          complexity_level: "coordination",
          estimated_time: "30 minutes",
          magnitude: 5,
          prerequisites: [],
          branch_type: "financial_intelligence",
          generated_from: "financial_complexity_detection",
        });
      } else if (complexity_tier === "strategic") {
        tasks.push({
          id: this.generateId(),
          title: "Develop Financial Forecasting Model",
          description:
            "Create systematic approach to predicting and planning financial growth",
          complexity_level: "strategic",
          estimated_time: "2 hours",
          magnitude: 7,
          prerequisites: [],
          branch_type: "strategic_planning",
          generated_from: "financial_complexity_scaling",
        });
      }
    }

    if (
      indicators.people_coordination.detected &&
      indicators.people_coordination.level >= 1
    ) {
      if (complexity_tier === "coordination") {
        tasks.push({
          id: this.generateId(),
          title: "Establish Team Communication Rhythm",
          description:
            "Create systematic approach to coordinating with people in your network",
          complexity_level: "coordination",
          estimated_time: "45 minutes",
          magnitude: 6,
          prerequisites: [],
          branch_type: "coordination_systems",
          generated_from: "people_complexity_detection",
        });
      } else if (complexity_tier === "strategic") {
        tasks.push({
          id: this.generateId(),
          title: "Design Organizational Structure",
          description:
            "Plan how to scale team coordination as your operation grows",
          complexity_level: "strategic",
          estimated_time: "1.5 hours",
          magnitude: 8,
          prerequisites: [],
          branch_type: "organizational_design",
          generated_from: "people_complexity_scaling",
        });
      }
    }

    if (
      indicators.strategic_thinking.detected &&
      complexity_tier === "strategic"
    ) {
      tasks.push({
        id: this.generateId(),
        title: "Market Positioning Analysis",
        description:
          "Analyze your position in the broader market and identify strategic opportunities",
        complexity_level: "strategic",
        estimated_time: "2 hours",
        magnitude: 8,
        prerequisites: [],
        branch_type: "market_intelligence",
        generated_from: "strategic_complexity_detection",
      });
    }

    return tasks;
  }

  // COMPLEXITY EVOLUTION ANALYSIS TOOL
  async analyzeComplexityEvolution() {
    const projectId = await this.requireActiveProject();
    const projectConfig = await this.loadProjectData(projectId, "config.json");
    const learningHistory = (await this.loadProjectData(
      projectId,
      "learning_history.json",
    )) || { completed_topics: [] };

    // Run complexity analysis
    const complexityAnalysis =
      this.analyzeComplexityIndicators(learningHistory);
    const {
      indicators,
      overall_complexity_level,
      active_complexity_domains,
      ready_for_scaling,
      complexity_tier,
    } = complexityAnalysis;

    // Generate scaling opportunities
    const scalingTasks = this.generateComplexityAppropriateTask(
      complexityAnalysis,
      projectConfig,
      learningHistory,
    );

    let analysis = `🌟 INFINITE SCALING COMPLEXITY ANALYSIS for "${projectConfig.goal}"\\n\\n`;

    // Current complexity tier
    analysis += `🎯 CURRENT COMPLEXITY TIER: ${complexity_tier.toUpperCase()}\\n`;
    analysis += `📊 Overall Complexity Level: ${overall_complexity_level}\\n`;
    analysis += `🔥 Active Domains: ${active_complexity_domains}/5\\n`;
    analysis += `🚀 Ready for Scaling: ${ready_for_scaling ? "YES" : "Not yet"}\\n\\n`;

    // Domain analysis
    analysis += `🧠 COMPLEXITY DOMAIN ANALYSIS:\\n`;
    Object.entries(indicators).forEach(([domain, data]) => {
      const status = data.detected
        ? `ACTIVE (Level ${data.level})`
        : "Not detected";
      const emoji = data.detected ? "✅" : "⚪";
      analysis += `${emoji} ${domain.replace(/_/g, " ").toUpperCase()}: ${status}\\n`;
      if (data.signals.length > 0) {
        analysis += `   Signals: ${data.signals.slice(-3).join(", ")}\\n`;
      }
    });

    // Scaling opportunities
    analysis += `\\n🎯 SCALING OPPORTUNITIES DETECTED:\\n`;
    if (scalingTasks.length > 0) {
      scalingTasks.forEach((task, index) => {
        analysis += `${index + 1}. ${task.title} (${task.complexity_level})\\n`;
        analysis += `   Generated from: ${task.generated_from}\\n`;
        analysis += `   Duration: ${task.estimated_time}\\n\\n`;
      });
    } else {
      analysis += `No scaling opportunities detected yet. Continue current path to reveal complexity patterns.\\n\\n`;
    }

    // Growth pathway explanation
    analysis += `🌉 SCALING PATHWAY:\\n`;
    const pathways = {
      individual: "Personal tasks and skill building",
      coordination: "Basic coordination and simple financial tracking",
      management: "Multi-domain management and team coordination",
      strategic: "Strategic operations and market positioning",
      enterprise: "Full enterprise complexity orchestration",
    };

    const tierOrder = [
      "individual",
      "coordination",
      "management",
      "strategic",
      "enterprise",
    ];
    const currentIndex = tierOrder.indexOf(complexity_tier);

    tierOrder.forEach((tier, index) => {
      const emoji =
        index < currentIndex ? "✅" : index === currentIndex ? "🔥" : "⚪";
      const status = index === currentIndex ? " ← CURRENT" : "";
      analysis += `${emoji} ${tier.toUpperCase()}: ${pathways[tier]}${status}\\n`;
    });

    analysis += `\\n💫 The same system that orchestrates your current "${complexity_tier}" tasks will seamlessly scale to enterprise complexity without you ever outgrowing it!`;

    return {
      content: [
        {
          type: "text",
          text: analysis,
        },
      ],
    };
  }

  // IDENTITY-BASED TRANSFORMATION ENGINE
  // Facilitates becoming the type of person who naturally belongs at the end goal

  analyzeCurrentIdentity(projectConfig, learningHistory, dailyPatterns = {}) {
    const completedTopics = learningHistory.completed_topics || [];
    const recentActivity = completedTopics.slice(-10);

    // Analyze current identity markers
    const currentIdentity = {
      daily_routines: this.assessDailyRoutines(recentActivity, dailyPatterns),
      social_circles: this.assessSocialCircles(recentActivity),
      language_patterns: this.assessLanguagePatterns(recentActivity),
      environment_cues: this.assessEnvironment(recentActivity),
      decision_patterns: this.assessDecisionPatterns(recentActivity),
      professional_habits: this.assessProfessionalHabits(recentActivity),
      learning_orientation: this.assessLearningOrientation(recentActivity),
      network_engagement: this.assessNetworkEngagement(recentActivity),
      industry_immersion: this.assessIndustryImmersion(recentActivity),
    };

    return {
      identity_snapshot: currentIdentity,
      identity_strength: this.calculateIdentityStrength(currentIdentity),
      transformation_readiness:
        this.assessTransformationReadiness(currentIdentity),
    };
  }

  assessDailyRoutines(recentActivity, dailyPatterns) {
    const routineKeywords = recentActivity.filter((activity) => {
      const content = (
        activity.topic +
        " " +
        (activity.learned || "")
      ).toLowerCase();
      return content.match(/routine|morning|daily|habit|schedule|practice/);
    });

    if (routineKeywords.length === 0) {
      return {
        status: "consumer_oriented",
        evidence: "No professional routine development detected",
      };
    } else if (routineKeywords.length <= 2) {
      return {
        status: "transitioning",
        evidence: "Some routine optimization beginning",
      };
    } else {
      return {
        status: "professional_oriented",
        evidence: "Consistent professional routine development",
      };
    }
  }

  assessSocialCircles(recentActivity) {
    const socialActivity = recentActivity.filter((activity) => {
      const content = (
        activity.topic +
        " " +
        (activity.learned || "")
      ).toLowerCase();
      return content.match(
        /network|connect|people|professional|industry|contact|relationship|community/,
      );
    });

    if (socialActivity.length === 0) {
      return {
        status: "isolated",
        evidence: "No professional networking detected",
      };
    } else if (socialActivity.length <= 2) {
      return { status: "emerging", evidence: "Early networking attempts" };
    } else {
      return {
        status: "connected",
        evidence: "Active professional network building",
      };
    }
  }

  assessLanguagePatterns(recentActivity) {
    const industryLanguage = recentActivity.filter((activity) => {
      const content = (
        activity.topic +
        " " +
        (activity.learned || "")
      ).toLowerCase();
      return content.match(
        /industry|professional|development|production|creative|strategic|business/,
      );
    });

    if (industryLanguage.length === 0) {
      return {
        status: "fan_language",
        evidence: "Consumer/fan perspective dominant",
      };
    } else if (industryLanguage.length <= 3) {
      return {
        status: "mixed_language",
        evidence: "Beginning to adopt professional terminology",
      };
    } else {
      return {
        status: "professional_language",
        evidence: "Consistent industry terminology usage",
      };
    }
  }

  assessEnvironment(recentActivity) {
    const environmentActivity = recentActivity.filter((activity) => {
      const content = (
        activity.topic +
        " " +
        (activity.learned || "")
      ).toLowerCase();
      return content.match(
        /workspace|environment|setup|tools|office|studio|professional/,
      );
    });

    if (environmentActivity.length === 0) {
      return {
        status: "personal_space",
        evidence: "No professional environment development",
      };
    } else {
      return {
        status: "professional_space",
        evidence: "Working on professional environment",
      };
    }
  }

  assessDecisionPatterns(recentActivity) {
    const decisionActivity = recentActivity.filter((activity) => {
      const content = (
        activity.topic +
        " " +
        (activity.learned || "")
      ).toLowerCase();
      return content.match(
        /decision|strategy|plan|goal|opportunity|risk|invest/,
      );
    });

    if (decisionActivity.length <= 1) {
      return {
        status: "reactive",
        evidence: "Limited strategic decision making",
      };
    } else if (decisionActivity.length <= 3) {
      return { status: "developing", evidence: "Growing strategic thinking" };
    } else {
      return {
        status: "strategic",
        evidence: "Consistent strategic decision making",
      };
    }
  }

  assessProfessionalHabits(recentActivity) {
    const professionalActivity = recentActivity.filter((activity) => {
      const content = (
        activity.topic +
        " " +
        (activity.learned || "")
      ).toLowerCase();
      return content.match(
        /professional|skill|competency|expertise|craft|discipline/,
      );
    });

    return {
      status: professionalActivity.length >= 3 ? "professional" : "developing",
      evidence: `${professionalActivity.length} professional development activities`,
    };
  }

  assessLearningOrientation(recentActivity) {
    const strategicLearning = recentActivity.filter((activity) => {
      const content = (
        activity.topic +
        " " +
        (activity.learned || "")
      ).toLowerCase();
      return content.match(/analysis|framework|system|methodology|approach/);
    });

    return {
      status: strategicLearning.length >= 2 ? "systematic" : "casual",
      evidence: `${strategicLearning.length} systematic learning approaches`,
    };
  }

  assessNetworkEngagement(recentActivity) {
    const networkActivity = recentActivity.filter((activity) => {
      const content = (
        activity.topic +
        " " +
        (activity.learned || "")
      ).toLowerCase();
      return content.match(
        /contact|connect|relationship|network|community|professional/,
      );
    });

    return {
      status: networkActivity.length >= 2 ? "active" : "passive",
      evidence: `${networkActivity.length} networking activities`,
    };
  }

  assessIndustryImmersion(recentActivity) {
    const industryActivity = recentActivity.filter((activity) => {
      const content = (
        activity.topic +
        " " +
        (activity.learned || "")
      ).toLowerCase();
      return content.match(
        /industry|company|business|market|trends|news|insider/,
      );
    });

    return {
      status: industryActivity.length >= 3 ? "immersed" : "surface",
      evidence: `${industryActivity.length} industry-focused activities`,
    };
  }

  calculateIdentityStrength(currentIdentity) {
    const strengthMap = {
      professional_oriented: 3,
      transitioning: 2,
      consumer_oriented: 1,
      connected: 3,
      emerging: 2,
      isolated: 1,
      professional_language: 3,
      mixed_language: 2,
      fan_language: 1,
      professional_space: 2,
      personal_space: 1,
      strategic: 3,
      developing: 2,
      reactive: 1,
      professional: 2,
      developing: 1,
      systematic: 2,
      casual: 1,
      active: 2,
      passive: 1,
      immersed: 2,
      surface: 1,
    };

    const scores = [
      strengthMap[currentIdentity.daily_routines.status] || 1,
      strengthMap[currentIdentity.social_circles.status] || 1,
      strengthMap[currentIdentity.language_patterns.status] || 1,
      strengthMap[currentIdentity.environment_cues.status] || 1,
      strengthMap[currentIdentity.decision_patterns.status] || 1,
      strengthMap[currentIdentity.professional_habits.status] || 1,
      strengthMap[currentIdentity.learning_orientation.status] || 1,
      strengthMap[currentIdentity.network_engagement.status] || 1,
      strengthMap[currentIdentity.industry_immersion.status] || 1,
    ];

    const totalScore = scores.reduce((sum, score) => sum + score, 0);
    const maxScore = 9 * 3; // 9 categories, max 3 points each

    return {
      score: totalScore,
      max_score: maxScore,
      percentage: Math.round((totalScore / maxScore) * 100),
      level:
        totalScore <= 12
          ? "beginner"
          : totalScore <= 18
            ? "developing"
            : "established",
    };
  }

  assessTransformationReadiness(currentIdentity) {
    const readinessFactors = [];

    // Check for signs of readiness to change
    if (currentIdentity.daily_routines.status !== "consumer_oriented") {
      readinessFactors.push("routine_development");
    }
    if (currentIdentity.learning_orientation.status === "systematic") {
      readinessFactors.push("systematic_learning");
    }
    if (currentIdentity.decision_patterns.status !== "reactive") {
      readinessFactors.push("strategic_thinking");
    }

    return {
      ready: readinessFactors.length >= 2,
      factors: readinessFactors,
      recommendation:
        readinessFactors.length >= 2
          ? "Ready for identity transformation interventions"
          : "Focus on building foundational habits first",
    };
  }

  defineTargetIdentity(projectConfig) {
    const goal = projectConfig.goal?.toLowerCase() || "";
    let targetIdentity = {};

    // Base professional identity characteristics
    const baseIdentity = {
      daily_rituals: {
        morning: "Industry news review and strategic planning",
        work_blocks: "Deep focus on craft development",
        evening: "Network engagement and reflection",
      },
      social_circles: {
        primary: "Industry practitioners and thought leaders",
        secondary: "Peers in target field",
        aspirational: "Senior professionals and mentors",
      },
      language_patterns: {
        internal_dialogue: "Strategic and opportunity-focused",
        external_communication: "Professional terminology and insights",
        decision_framework: "Industry standards and best practices",
      },
      environment_design: {
        workspace: "Professional setup optimized for craft",
        information_diet: "Industry publications and professional content",
        physical_cues: "Visual reminders of professional identity",
      },
      decision_patterns: {
        opportunity_recognition: "Continuously scanning for strategic openings",
        risk_assessment: "Calculated professional risks",
        resource_allocation: "Investment in long-term professional development",
      },
    };

    // Customize based on specific goal
    if (
      goal.includes("lucasfilm") ||
      goal.includes("creative") ||
      goal.includes("entertainment")
    ) {
      targetIdentity = {
        ...baseIdentity,
        daily_rituals: {
          ...baseIdentity.daily_rituals,
          morning: "Industry trade publication review (Variety, Deadline, THR)",
          creative_practice: "Daily creative development exercises",
        },
        social_circles: {
          primary: "Creative development professionals and storytellers",
          secondary: "Film industry practitioners and content creators",
          aspirational: "Senior creative executives and successful filmmakers",
        },
        language_patterns: {
          ...baseIdentity.language_patterns,
          industry_terminology:
            "Development, IP, pipeline, greenlight, creative executive",
          perspective: "Creative business strategist rather than fan",
        },
        environment_design: {
          workspace: "Creative workspace with industry references",
          information_diet:
            "Trade publications, industry podcasts, professional content",
          physical_cues: "Professional creative tools and industry artwork",
        },
      };
    }

    return targetIdentity;
  }

  generateIdentityShifts(currentState, targetState, _projectConfig) {
    const shifts = [];
    const currentIdentity = currentState.identity_snapshot;
    const _targetIdentity = targetState;

    // Daily routine shifts
    if (currentIdentity.daily_routines.status === "consumer_oriented") {
      shifts.push({
        category: "daily_routine",
        type: "micro_habit",
        title: "Industry Morning Briefing",
        description: "Read one industry article during morning coffee",
        implementation:
          "Add 10 minutes to morning routine for trade publication",
        frequency: "daily",
        identity_signal: "Professional stays informed about industry",
        difficulty: "easy",
        estimated_time: "10 minutes",
      });
    }

    // Language pattern shifts
    if (currentIdentity.language_patterns.status === "fan_language") {
      shifts.push({
        category: "language_patterns",
        type: "cognitive_reframe",
        title: "Professional Perspective Practice",
        description: "Reframe observations using industry terminology",
        implementation:
          'When discussing projects, ask "What would a development exec think?"',
        frequency: "during discussions",
        identity_signal: "Think like an industry professional",
        difficulty: "medium",
        estimated_time: "ongoing",
      });
    }

    // Social circle shifts
    if (currentIdentity.social_circles.status === "isolated") {
      shifts.push({
        category: "social_circles",
        type: "network_building",
        title: "Professional Connection",
        description:
          "Follow and engage with 3 industry professionals on LinkedIn",
        implementation:
          "Find and follow professionals, comment thoughtfully on posts",
        frequency: "weekly",
        identity_signal: "Part of professional community",
        difficulty: "medium",
        estimated_time: "20 minutes weekly",
      });
    }

    // Environment design shifts
    if (currentIdentity.environment_cues.status === "personal_space") {
      shifts.push({
        category: "environment",
        type: "space_design",
        title: "Professional Workspace Setup",
        description:
          "Create dedicated professional workspace with industry materials",
        implementation: "Designate workspace area, add professional references",
        frequency: "one-time setup",
        identity_signal: "Professional environment reinforces identity",
        difficulty: "easy",
        estimated_time: "1 hour setup",
      });
    }

    // Decision pattern shifts
    if (currentIdentity.decision_patterns.status === "reactive") {
      shifts.push({
        category: "decision_patterns",
        type: "strategic_thinking",
        title: "Strategic Decision Framework",
        description:
          'Before major decisions, ask "How does this advance my professional goals?"',
        implementation: "Pause before decisions, apply strategic lens",
        frequency: "as needed",
        identity_signal: "Strategic thinker and planner",
        difficulty: "medium",
        estimated_time: "5 minutes per decision",
      });
    }

    // Professional habits
    if (currentIdentity.professional_habits.status === "developing") {
      shifts.push({
        category: "professional_habits",
        type: "skill_development",
        title: "Daily Craft Practice",
        description:
          "Dedicate time to developing core professional competencies",
        implementation: "Block 30 minutes daily for skill building",
        frequency: "daily",
        identity_signal: "Committed professional developing expertise",
        difficulty: "medium",
        estimated_time: "30 minutes daily",
      });
    }

    // Industry immersion
    if (currentIdentity.industry_immersion.status === "surface") {
      shifts.push({
        category: "industry_immersion",
        type: "information_diet",
        title: "Industry Intelligence Routine",
        description:
          "Replace casual content with professional industry content",
        implementation:
          "Substitute entertainment for trade publications and industry podcasts",
        frequency: "daily",
        identity_signal: "Industry insider with professional awareness",
        difficulty: "easy",
        estimated_time: "same time, different content",
      });
    }

    return shifts.slice(0, 3); // Return top 3 most impactful shifts
  }

  async generateIdentityBasedTasks(identityShifts, _projectConfig) {
    const tasks = [];

    identityShifts.forEach((shift) => {
      tasks.push({
        id: this.generateId(),
        title: shift.title,
        description:
          shift.description + "\\n\\nIdentity Signal: " + shift.identity_signal,
        type: "identity_transformation",
        category: shift.category,
        implementation_notes: shift.implementation,
        frequency: shift.frequency,
        difficulty: shift.difficulty,
        estimated_time: shift.estimated_time,
        identity_impact: "high",
        prerequisites: [],
        branch_type: "identity_shift",
        generated_from: "identity_transformation_engine",
      });
    });

    return tasks;
  }

  async analyzeIdentityTransformation() {
    const projectId = await this.requireActiveProject();
    const projectConfig = await this.loadProjectData(projectId, "config.json");
    const learningHistory = (await this.loadProjectData(
      projectId,
      "learning_history.json",
    )) || { completed_topics: [] };

    // Analyze current identity
    const currentState = this.analyzeCurrentIdentity(
      projectConfig,
      learningHistory,
    );

    // Define target identity
    const targetState = this.defineTargetIdentity(projectConfig);

    // Generate identity shifts
    const identityShifts = this.generateIdentityShifts(
      currentState,
      targetState,
      projectConfig,
    );

    // Create identity-based tasks
    const _identityTasks = await this.generateIdentityBasedTasks(
      identityShifts,
      projectConfig,
    );

    let analysis = `🎭 IDENTITY TRANSFORMATION ANALYSIS for "${projectConfig.goal}"\\n\\n`;

    analysis += `📊 CURRENT IDENTITY PROFILE:\\n`;
    analysis += `Overall Identity Strength: ${currentState.identity_strength.percentage}% (${currentState.identity_strength.level})\\n`;
    analysis += `Transformation Readiness: ${currentState.transformation_readiness.ready ? "✅ Ready" : "⚠️ Building Foundation"}\\n\\n`;

    analysis += `🔍 IDENTITY ASSESSMENT BY DIMENSION:\\n`;
    Object.entries(currentState.identity_snapshot).forEach(
      ([dimension, data]) => {
        const statusEmoji =
          data.status.includes("professional") ||
          data.status === "connected" ||
          data.status === "strategic"
            ? "✅"
            : data.status.includes("developing") ||
                data.status === "emerging" ||
                data.status === "mixed"
              ? "🔄"
              : "🎯";
        analysis += `${statusEmoji} ${dimension.replace(/_/g, " ").toUpperCase()}: ${data.status} - ${data.evidence}\\n`;
      },
    );

    analysis += `\\n🎯 IDENTITY TRANSFORMATION INTERVENTIONS:\\n`;
    identityShifts.forEach((shift, index) => {
      analysis += `\\n${index + 1}. **${shift.title}** (${shift.category})\\n`;
      analysis += `   • Implementation: ${shift.implementation}\\n`;
      analysis += `   • Identity Signal: ${shift.identity_signal}\\n`;
      analysis += `   • Frequency: ${shift.frequency} | Difficulty: ${shift.difficulty}\\n`;
    });

    analysis += `\\n🧬 IDENTITY EVOLUTION PATHWAY:\\n`;
    analysis += `Current → Target Identity Profile:\\n`;
    analysis += `• Daily Routines: Consumer habits → Professional rituals\\n`;
    analysis += `• Social Circles: Isolation → Industry community\\n`;
    analysis += `• Language: Fan perspective → Professional insider\\n`;
    analysis += `• Environment: Personal space → Professional workspace\\n`;
    analysis += `• Decisions: Reactive → Strategic opportunity-focused\\n\\n`;

    analysis += `💡 IMPLEMENTATION STRATEGY:\\n`;
    analysis += `Start with ${identityShifts.length} micro-shifts that gradually reshape daily reality.\\n`;
    analysis += `Each shift sends identity signals that compound over time.\\n`;
    analysis += `Focus on becoming the type of person who naturally belongs at your goal.\\n\\n`;

    if (currentState.transformation_readiness.ready) {
      analysis += `🚀 You're ready for identity transformation! Begin implementing shifts immediately.\\n`;
    } else {
      analysis += `🏗️ Focus on building foundational habits before advanced identity work.\\n`;
      analysis += `Recommendation: ${currentState.transformation_readiness.recommendation}\\n`;
    }

    return {
      content: [
        {
          type: "text",
          text: analysis,
        },
      ],
    };
  }
}

// Export for testing
export default ForestServer;

// Start the server using stdio transport (only if this is the main module)
// Check if running directly (not being imported for testing)
if (
  process.argv[1] &&
  process.argv[1].includes("server.js") &&
  !process.env.NODE_ENV?.includes("test")
) {
  const server = new ForestServer();
  const transport = new StdioServerTransport();
  (async () => {
    await server.server.connect(transport);
  })();
}

if (ENABLE_HTTP_API && import.meta.url === `file://${process.argv[1]}`) {
  const serverInstance = new ForestServer();
  const httpServer = http.createServer(async (req, res) => {
    if (req.method === "POST" && req.url === "/tool") {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", async () => {
        try {
          const { tool, args } = JSON.parse(body);
          let result;
          switch (tool) {
            case "create_project":
              result = await serverInstance.createProject(args);
              break;
            case "build_hta_tree":
              result = await serverInstance.buildHTATree(
                args.path_name,
                args.learning_style || "mixed",
                args.focus_areas || [],
              );
              break;
            case "get_hta_status":
              result = await serverInstance.getHTAStatus();
              break;
            default:
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Unknown tool" }));
              return;
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(result));
        } catch (err) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    } else {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
    }
  });
  httpServer.listen(3000, () => {
    console.log("ForestServer HTTP API listening on port 3000");
  });
}

export { ForestServer };

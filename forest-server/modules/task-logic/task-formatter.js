/**
 * Task Formatter Module
 * Handles formatting of task responses and user-facing messages
 */

import { TaskScorer } from './task-scorer.js';
import { DEFAULT_PATHS } from '../constants.js';

export class TaskFormatter {
  /**
   * Format a task into a user-friendly response
   * @param {Object} task - Task to format
   * @param {number} energyLevel - User's current energy level
   * @param {string} timeAvailable - Available time string
   * @returns {string} Formatted task response
   */
  static formatTaskResponse(task, energyLevel, timeAvailable) {
    const difficultyStars = '⭐'.repeat(task.difficulty || 1);
    const duration = task.duration || '30 minutes';

    let response = '**Next Recommended Task**\n\n';
    response += `**${task.title}**\n`;
    response += `${task.description || 'No description available'}\n\n`;
    response += `**Duration**: ${duration}\n`;
    response += `**Difficulty**: ${task.difficulty || 1}/5\n`;
    response += `**Branch**: ${task.branch || DEFAULT_PATHS.GENERAL}\n`;

    if (task.learningOutcome) {
      response += `**Learning Outcome**: ${task.learningOutcome}\n`;
    }

    response += `\n**Energy Match**: ${this.getEnergyMatchText(task.difficulty || 3, energyLevel)}\n`;
    response += `**Time Match**: ${this.getTimeMatchText(duration, timeAvailable)}\n`;

    response += `\nUse \`complete_block\` with block_id: "${task.id}" when finished`;

    return response;
  }

  /**
   * Get energy level match description
   * @param {number} taskDifficulty - Task difficulty level
   * @param {number} energyLevel - User's energy level
   * @returns {string} Energy match description
   */
  static getEnergyMatchText(taskDifficulty, energyLevel) {
    const diff = Math.abs(taskDifficulty - energyLevel);
    if (diff <= 1) { return 'Excellent match'; }
    if (diff <= 2) { return 'Good match'; }
    return 'Consider adjusting energy or task difficulty';
  }

  /**
   * Get time availability match description
   * @param {string} taskDuration - Task duration string
   * @param {string} timeAvailable - Available time string
   * @returns {string} Time match description
   */
  static getTimeMatchText(taskDuration, timeAvailable) {
    const taskMinutes = TaskScorer.parseTimeToMinutes(taskDuration);
    const availableMinutes = TaskScorer.parseTimeToMinutes(timeAvailable);

    if (taskMinutes <= availableMinutes) {
      return 'Perfect fit ✅';
    } else if (taskMinutes <= availableMinutes * 1.2) {
      return 'Close fit (consider extending slightly)';
    } else if (taskMinutes <= availableMinutes * 1.5) {
      const adaptation = Math.round(availableMinutes * 0.8);
      return `Too long - try for ${adaptation} minutes instead`;
    } else {
      const adaptation = Math.round(availableMinutes * 0.8);
      return `Much too long - do first ${adaptation} minutes only`;
    }
  }

  /**
   * Format strategy evolution response
   * @param {Object} analysis - Strategy analysis data
   * @param {Array} newTasks - Array of newly generated tasks
   * @param {string} feedback - User feedback
   * @returns {string} Formatted strategy evolution response
   */
  static formatStrategyEvolutionResponse(analysis, newTasks, feedback) {
    let response = '🧠 **Strategy Evolution Complete**\n\n';

    response += '📊 **Current Status**:\n';
    response += `• Completed tasks: ${analysis.completedTasks}/${analysis.totalTasks}\n`;
    response += `• Available tasks: ${analysis.availableTasks}\n`;

    if (analysis.stuckIndicators.length > 0) {
      response += `• Detected issues: ${analysis.stuckIndicators.join(', ')}\n`;
    }

    response += `\n**Evolution Strategy**: ${analysis.recommendedEvolution.replace(/_/g, ' ')}\n`;

    if (newTasks.length > 0) {
      response += `\n**New Tasks Generated** (${newTasks.length}):\n`;
      for (const task of newTasks.slice(0, 3)) {
        response += `- ${task.title} (${task.duration || '30 min'})\n`;
      }

      if (newTasks.length > 3) {
        response += `- ... and ${newTasks.length - 3} more\n`;
      }
    }

    if (feedback) {
      response += `\n**Feedback Processed**: ${analysis.userFeedback.sentiment} sentiment detected\n`;
    }

    response += '\n**Next Step**: Use `get_next_task` to get your optimal next task';

    return response;
  }
}
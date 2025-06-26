// @ts-nocheck
/**
 * Task Quality Verifier
 * Provides lightweight heuristics to detect generic placeholder tasks and ensure
 * tasks reference user/project context where possible.  All functions are
 * pure and side-effect free so they can be reused in different layers.
 */

import { GENERIC_TASK_PATTERNS, ACTION_TASK_MIN_DURATION, ACTION_TASK_MAX_DURATION } from './constants.js';
import { validateHierarchy, getLeafTasks } from './utils/hta-hierarchy-utils.js';

/**
 * Determine which task titles match a generic placeholder pattern.
 * @param {Array<{title?: string}>} tasks
 * @returns {string[]} Array of titles considered generic
 */
export function detectGenericTitles(tasks = []) {
  if (!Array.isArray(tasks)) return [];
  return tasks
    .filter(t => {
      if (!t || typeof t.title !== 'string') return false;
      return GENERIC_TASK_PATTERNS.some(re => re.test(t.title.trim()));
    })
    .map(t => t.title);
}

/**
 * Very lightweight relevance check – searches for at least one keyword from
 * project context inside each task title or description.
 * @param {Array<{title?: string, description?: string}>} tasks
 * @param {any} projectContext – typically the output of buildRichContext()
 * @returns {boolean} True if every task contains at least one context keyword
 */
export function validateTaskContextRelevance(tasks = [], projectContext = {}, threshold = 0.8) {
  if (!Array.isArray(tasks) || tasks.length === 0) return false;

  // Build a naive keyword list – this stays domain-agnostic.
  const keywords = [];
  if (projectContext && typeof projectContext === 'object') {
    const traverse = obj => {
      for (const key in obj) {
        const val = obj[key];
        if (typeof val === 'string') {
          keywords.push(...val.split(/[^a-zA-Z0-9]+/).filter(Boolean));
        } else if (Array.isArray(val)) {
          val.forEach(v => traverse(v));
        } else if (typeof val === 'object' && val !== null) {
          traverse(val);
        }
      }
    };
    traverse(projectContext);
  }

  if (keywords.length === 0) return true; // No context → nothing to validate

  const lowerKeywords = keywords.map(k => k.toLowerCase());

  const matches = tasks.filter(task => {
    const haystack = `${task.title || ''} ${task.description || ''}`.toLowerCase();
    return lowerKeywords.some(k => haystack.includes(k));
  }).length;

  return matches / tasks.length >= threshold;
}

/**
 * Decide whether a Claude/LLM response should be rejected based on quality checks.
 * @param {any[]} tasks
 * @param {any} projectContext
 */
export function shouldRejectResponse(tasks = [], projectContext = {}) {
  const genericMatches = detectGenericTitles(tasks);
  const contextRelevant = validateTaskContextRelevance(tasks, projectContext, 0.8);
  // Hierarchy validation only makes sense once nodes contain internal IDs.  Raw
  // Claude responses (nested branch objects without ids) will naturally fail a
  // strict parent\child validation.  We therefore skip hierarchy validation at
  // this early stage unless at least one object has an explicit `id` field.

  const containsIds = Array.isArray(tasks) && tasks.some(t => typeof t === 'object' && t && 'id' in t);
  const hierarchyCheck = containsIds ? validateHierarchy(tasks) : { valid: true };
  const granularityOk = Array.isArray(tasks)
    ? getLeafTasks(tasks).every(t => {
        const dur = typeof t.duration === 'number'
          ? t.duration
          : (parseInt(String(t.duration).match(/(\d+)/)?.[1] || '30', 10));
        return dur >= ACTION_TASK_MIN_DURATION && dur <= ACTION_TASK_MAX_DURATION;
      })
    : true;

  // Soft-failure logic: Generic titles now produce warnings rather than outright
  // rejection.  We only reject if **all** safety checks fail.
  const tooManyGeneric = genericMatches.length / (Array.isArray(tasks) ? tasks.length : 1) > 0.5;

  return !contextRelevant || !hierarchyCheck.valid || !granularityOk || tooManyGeneric;
}

/**
 * Provide a simple report so callers can log or surface rejection reasons.
 */
export function generateQualityReport(tasks = [], projectContext = {}) {
  const generic = detectGenericTitles(tasks);
  const contextRelevant = validateTaskContextRelevance(tasks, projectContext);
  const hierarchy = validateHierarchy(tasks);
  const leafTasks = getLeafTasks(tasks);
  const granularityIssues = leafTasks.filter(t => {
    const dur = typeof t.duration === 'number' ? t.duration : parseInt(String(t.duration).match(/(\d+)/)?.[1] || '30', 10);
    return dur < ACTION_TASK_MIN_DURATION || dur > ACTION_TASK_MAX_DURATION;
  }).map(t => t.title);
  return {
    generic_titles: generic,
    generic_count: generic.length,
    context_relevance: contextRelevant,
    hierarchy_valid: hierarchy.valid,
    hierarchy_errors: hierarchy.errors,
    granularity_issue_count: granularityIssues.length,
    granularity_issues: granularityIssues,
    should_reject: generic.length > 0 || !contextRelevant,
  };
}

export default {
  detectGenericTitles,
  validateTaskContextRelevance,
  validateHierarchy,
  shouldRejectResponse,
  generateQualityReport,
}; 
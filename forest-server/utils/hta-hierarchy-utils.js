/**
 * HTA Hierarchy Utility Functions (NEW)
 * ------------------------------------
 * These lightweight helpers make it easier for other modules to work with
 * hierarchical HTA structures without duplicating traversal logic.
 * 
 * All functions are written in plain JavaScript and avoid any domain-specific
 * assumptions so they remain fully domain-agnostic.
 */

// @ts-nocheck

import { HTA_LEVELS } from '../constants.js';

/**
 * Build a parent→children lookup map for quick ancestry traversal.
 * @param {Array<{id:string, parent_id?:string|null}>} nodes
 * @returns {Map<string, Array<object>>}
 */
export function buildParentMap(nodes = []) {
  /** @type {Map<string, Array<object>>} */
  const map = new Map();
  if (!Array.isArray(nodes)) return map;
  for (const node of nodes) {
    const parent = node.parent_id ?? '__root__';
    if (!map.has(parent)) map.set(parent, []);
    map.get(parent).push(node);
  }
  return map;
}

/**
 * Get direct children of a parent node.
 * @param {Array<object>} nodes
 * @param {string|null} parentId
 * @returns {Array<object>}
 */
export function getChildren(nodes = [], parentId = null) {
  const map = buildParentMap(nodes);
  return map.get(parentId ?? '__root__') || [];
}

/**
 * Extract actionable leaf-level tasks (level >= ACTION or nodes with no children).
 * @param {Array<object>} nodes
 * @returns {Array<object>} Actionable tasks
 */
export function getLeafTasks(nodes = []) {
  if (!Array.isArray(nodes)) return [];
  const map = buildParentMap(nodes);
  return nodes.filter(n => {
    // Explicit action-level flag takes precedence
    if (n.level !== undefined && n.level !== null) {
      return n.level >= HTA_LEVELS.ACTION;
    }
    // Fallback: treat as leaf if no children recorded
    return !(map.get(n.id) && map.get(n.id).length > 0);
  });
}

/**
 * Detect common hierarchy problems such as orphaned nodes or cycles.
 * The implementation purposefully errs on the side of leniency to avoid
 * false positives at runtime.
 *
 * @param {Array<{id:string,parent_id?:string|null}>} nodes
 * @returns {{valid:boolean, errors:string[]}}
 */
export function validateHierarchy(nodes = []) {
  const errors = [];
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return { valid: true, errors }; // nothing to validate
  }

  // 1. Check orphaned nodes (parent not present)
  const ids = new Set(nodes.map(n => n.id));
  for (const n of nodes) {
    if (n.parent_id && !ids.has(n.parent_id)) {
      errors.push(`Orphaned node ${n.id} references missing parent ${n.parent_id}`);
    }
  }

  // 2. Simple cycle detection via DFS (depth limited to avoid blow-ups)
  /** @type {Map<string,string|null>} */
  const parentMap = new Map();
  for (const n of nodes) parentMap.set(n.id, n.parent_id ?? null);
  for (const n of nodes) {
    const visited = new Set();
    let current = n.id;
    let depthGuard = 0;
    while (current !== null && depthGuard < 100) {
      if (visited.has(current)) {
        errors.push(`Cyclic dependency detected starting at ${n.id}`);
        break;
      }
      visited.add(current);
      current = parentMap.get(current) ?? null;
      depthGuard++;
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Flatten only actionable tasks into a single array for schedule generators.
 * @param {Array<object>} nodes
 * @returns {Array<object>}
 */
export function flattenToActionTasks(nodes = []) {
  return getLeafTasks(nodes);
}

/**
 * Build a prerequisite adjacency list keyed by task ID.
 * @param {Array<{id:string, prerequisites?:string[]}>} nodes
 * @returns {Map<string,string[]>}
 */
export function buildDependencyGraph(nodes = []) {
  /** @type {Map<string,string[]>} */
  const graph = new Map();
  if (!Array.isArray(nodes)) return graph;
  for (const n of nodes) {
    graph.set(n.id, Array.isArray(n.prerequisites) ? n.prerequisites : []);
  }
  return graph;
}

export default {
  buildParentMap,
  getChildren,
  getLeafTasks,
  flattenToActionTasks,
  validateHierarchy,
  buildDependencyGraph,
  HTA_LEVELS,
}; 
// Create hta-metrics.js content here - this will be moved to a separate file
const htaMetricsContent = `/**
 * Unified Task Counting Utility
 * 
 * This module provides standardized task counting functions to resolve
 * mathematical inconsistencies caused by different field naming conventions
 * and calculation methods across HTA status and analytics modules.
 */

/**
 * Count frontier nodes with field name compatibility
 * @param {Object} htaData - HTA data object
 * @returns {number} Number of frontier nodes
 */
export function countFrontierNodes(htaData) {
  if (!htaData) return 0;
  
  // Check both field name variants for compatibility
  const nodes = htaData.frontierNodes || htaData.frontierNodes || [];
  return Array.isArray(nodes) ? nodes.length : 0;
}

/**
 * Count completed nodes from all sources
 * @param {Object} htaData - HTA data object
 * @returns {number} Number of completed nodes
 */
export function countCompletedNodes(htaData) {
  if (!htaData) return 0;
  
  const completedNodes = htaData.completedNodes || [];
  const frontierNodes = htaData.frontierNodes || htaData.frontierNodes || [];
  const completedInFrontier = Array.isArray(frontierNodes) 
    ? frontierNodes.filter(n => n && n.completed).length 
    : 0;
  
  return (Array.isArray(completedNodes) ? completedNodes.length : 0) + completedInFrontier;
}

/**
 * Get available (ready to work on) nodes
 * @param {Object} htaData - HTA data object
 * @returns {Array} Array of available nodes
 */
export function getAvailableNodes(htaData) {
  if (!htaData) return [];
  
  const frontierNodes = htaData.frontierNodes || htaData.frontierNodes || [];
  if (!Array.isArray(frontierNodes)) return [];
  
  return frontierNodes.filter(node => 
    node && 
    !node.completed && 
    !node.blocked && 
    node.status !== 'blocked' &&
    node.status !== 'completed'
  );
}

/**
 * Get blocked nodes
 * @param {Object} htaData - HTA data object
 * @returns {Array} Array of blocked nodes
 */
export function getBlockedNodes(htaData) {
  if (!htaData) return [];
  
  const frontierNodes = htaData.frontierNodes || htaData.frontierNodes || [];
  if (!Array.isArray(frontierNodes)) return [];
  
  return frontierNodes.filter(node => 
    node && 
    !node.completed && 
    (node.blocked || node.status === 'blocked')
  );
}

/**
 * Get ready nodes (alias for available nodes for backward compatibility)
 * @param {Object} htaData - HTA data object
 * @returns {Array} Array of ready nodes
 */
export function getReadyNodes(htaData) {
  return getAvailableNodes(htaData);
}

/**
 * Calculate comprehensive progress metrics
 * @param {Object} htaData - HTA data object
 * @returns {Object} Progress metrics object
 */
export function calculateProgress(htaData) {
  if (!htaData) {
    return { completed: 0, total: 0, percentage: 0, available: 0, blocked: 0 };
  }
  
  const frontierCount = countFrontierNodes(htaData);
  const completedCount = countCompletedNodes(htaData);
  const availableCount = getAvailableNodes(htaData).length;
  const blockedCount = getBlockedNodes(htaData).length;
  
  // Total includes both frontier and completed nodes
  const total = frontierCount + (htaData.completedNodes?.length || 0);
  const percentage = total > 0 ? Math.round((completedCount / total) * 100) : 0;
  
  return {
    completed: completedCount,
    total: total,
    percentage: percentage,
    available: availableCount,
    blocked: blockedCount,
    frontier: frontierCount
  };
}

/**
 * Count tasks by branch
 * @param {Object} htaData - HTA data object
 * @param {string} branchName - Branch name to count
 * @returns {Object} Branch-specific counts
 */
export function countTasksByBranch(htaData, branchName) {
  if (!htaData || !branchName) {
    return { total: 0, completed: 0, available: 0, blocked: 0 };
  }
  
  const frontierNodes = htaData.frontierNodes || htaData.frontierNodes || [];
  const completedNodes = htaData.completedNodes || [];
  
  // Filter frontier nodes by branch
  const branchFrontierNodes = Array.isArray(frontierNodes) 
    ? frontierNodes.filter(node => node && node.branch === branchName)
    : [];
  
  // Filter completed nodes by branch
  const branchCompletedNodes = Array.isArray(completedNodes)
    ? completedNodes.filter(node => node && node.branch === branchName)
    : [];
  
  const completedInFrontier = branchFrontierNodes.filter(n => n.completed).length;
  const availableInFrontier = branchFrontierNodes.filter(n => 
    !n.completed && !n.blocked && n.status !== 'blocked'
  ).length;
  const blockedInFrontier = branchFrontierNodes.filter(n => 
    !n.completed && (n.blocked || n.status === 'blocked')
  ).length;
  
  return {
    total: branchFrontierNodes.length + branchCompletedNodes.length,
    completed: completedInFrontier + branchCompletedNodes.length,
    available: availableInFrontier,
    blocked: blockedInFrontier
  };
}

/**
 * Get branch progress summary
 * @param {Object} htaData - HTA data object
 * @returns {Object} Branch progress summary
 */
export function getBranchProgress(htaData) {
  if (!htaData) return {};
  
  const frontierNodes = htaData.frontierNodes || htaData.frontierNodes || [];
  const branches = new Set();
  
  // Collect all branch names
  if (Array.isArray(frontierNodes)) {
    frontierNodes.forEach(node => {
      if (node && node.branch) {
        branches.add(node.branch);
      }
    });
  }
  
  if (htaData.completedNodes && Array.isArray(htaData.completedNodes)) {
    htaData.completedNodes.forEach(node => {
      if (node && node.branch) {
        branches.add(node.branch);
      }
    });
  }
  
  // Calculate progress for each branch
  const branchProgress = {};
  for (const branch of branches) {
    branchProgress[branch] = countTasksByBranch(htaData, branch);
  }
  
  return branchProgress;
}

/**
 * Validate HTA data structure
 * @param {Object} htaData - HTA data object
 * @returns {Object} Validation result
 */
export function validateHTAData(htaData) {
  const issues = [];
  const warnings = [];
  
  if (!htaData) {
    issues.push('HTA data is null or undefined');
    return { valid: false, issues, warnings };
  }
  
  // Check for required fields
  if (!htaData.frontierNodes && !htaData.frontierNodes) {
    issues.push('Missing frontier nodes (both frontierNodes and frontierNodes are undefined)');
  }
  
  // Check field consistency
  if (htaData.frontierNodes && htaData.frontierNodes) {
    warnings.push('Both frontierNodes and frontierNodes are present - using frontierNodes');
  }
  
  // Validate frontier nodes structure
  const frontierNodes = htaData.frontierNodes || htaData.frontierNodes || [];
  if (!Array.isArray(frontierNodes)) {
    issues.push('Frontier nodes is not an array');
  } else {
    frontierNodes.forEach((node, index) => {
      if (!node) {
        warnings.push(\`Frontier node at index \${index} is null/undefined\`);
      } else {
        if (!node.id && !node.title) {
          warnings.push(\`Frontier node at index \${index} missing id and title\`);
        }
        if (node.completed && typeof node.completed !== 'boolean') {
          warnings.push(\`Frontier node at index \${index} has non-boolean completed field\`);
        }
      }
    });
  }
  
  // Validate completed nodes structure
  if (htaData.completedNodes && !Array.isArray(htaData.completedNodes)) {
    issues.push('Completed nodes is not an array');
  }
  
  return {
    valid: issues.length === 0,
    issues,
    warnings
  };
}

/**
 * Get comprehensive HTA metrics
 * @param {Object} htaData - HTA data object
 * @returns {Object} Comprehensive metrics
 */
export function getHTAMetrics(htaData) {
  const validation = validateHTAData(htaData);
  const progress = calculateProgress(htaData);
  const branchProgress = getBranchProgress(htaData);
  
  return {
    validation,
    progress,
    branchProgress,
    summary: {
      totalTasks: progress.total,
      completedTasks: progress.completed,
      availableTasks: progress.available,
      blockedTasks: progress.blocked,
      completionPercentage: progress.percentage,
      branchCount: Object.keys(branchProgress).length
    }
  };
}`;

// Write the content to hta-metrics.js file
import { writeFileSync } from 'fs';
try {
  writeFileSync('./forest-server/utils/hta-metrics.js', htaMetricsContent);
  console.log('✅ Created hta-metrics.js file');
} catch (error) {
  console.error('❌ Failed to create hta-metrics.js:', error.message);
}



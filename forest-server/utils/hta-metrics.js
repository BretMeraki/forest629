/**
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
  const nodes = htaData.frontier_nodes || htaData.frontierNodes || [];
  return Array.isArray(nodes) ? nodes.length : 0;
}

/**
 * Count completed nodes from all sources
 * @param {Object} htaData - HTA data object
 * @returns {number} Number of completed nodes
 */
export function countCompletedNodes(htaData) {
  if (!htaData) return 0;
  
  const completedNodes = htaData.completed_nodes || [];
  const frontierNodes = htaData.frontier_nodes || htaData.frontierNodes || [];
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
  
  const frontierNodes = htaData.frontier_nodes || htaData.frontierNodes || [];
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
  
  const frontierNodes = htaData.frontier_nodes || htaData.frontierNodes || [];
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
  const total = frontierCount + (htaData.completed_nodes?.length || 0);
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
  
  const frontierNodes = htaData.frontier_nodes || htaData.frontierNodes || [];
  const completedNodes = htaData.completed_nodes || [];
  
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
  
  const frontierNodes = htaData.frontier_nodes || htaData.frontierNodes || [];
  const branches = new Set();
  
  // Collect all branch names
  if (Array.isArray(frontierNodes)) {
    frontierNodes.forEach(node => {
      if (node && node.branch) {
        branches.add(node.branch);
      }
    });
  }
  
  if (htaData.completed_nodes && Array.isArray(htaData.completed_nodes)) {
    htaData.completed_nodes.forEach(node => {
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
  if (!htaData.frontier_nodes && !htaData.frontierNodes) {
    issues.push('Missing frontier nodes (both frontier_nodes and frontierNodes are undefined)');
  }
  
  // Check field consistency
  if (htaData.frontier_nodes && htaData.frontierNodes) {
    warnings.push('Both frontier_nodes and frontierNodes are present - using frontier_nodes');
  }
  
  // Validate frontier nodes structure
  const frontierNodes = htaData.frontier_nodes || htaData.frontierNodes || [];
  if (!Array.isArray(frontierNodes)) {
    issues.push('Frontier nodes is not an array');
  } else {
    frontierNodes.forEach((node, index) => {
      if (!node) {
        warnings.push(`Frontier node at index ${index} is null/undefined`);
      } else {
        if (!node.id && !node.title) {
          warnings.push(`Frontier node at index ${index} missing id and title`);
        }
        if (node.completed && typeof node.completed !== 'boolean') {
          warnings.push(`Frontier node at index ${index} has non-boolean completed field`);
        }
      }
    });
  }
  
  // Validate completed nodes structure
  if (htaData.completed_nodes && !Array.isArray(htaData.completed_nodes)) {
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
}
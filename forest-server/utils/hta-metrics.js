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

  // Get all valid branch identifiers (id, title, name) from strategic branches
  const strategicBranches = htaData.strategicBranches || [];
  const validBranchIdentifiers = new Set();
  
  strategicBranches.forEach(branch => {
    if (branch.id) validBranchIdentifiers.add(branch.id);
    if (branch.title) validBranchIdentifiers.add(branch.title);
    if (branch.name) validBranchIdentifiers.add(branch.name);
  });

  return frontierNodes.filter(node => 
    node && 
    !node.completed && 
    !node.blocked && 
    node.status !== 'blocked' &&
    node.status !== 'completed' &&
    node.branch && validBranchIdentifiers.has(node.branch)
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
  
  // FIX: Handle both branch.id and branch.title matching
  // First try to find a strategic branch that matches the branchName
  const strategicBranches = htaData.strategicBranches || [];
  let targetBranchIdentifier = branchName;
  
  // Check if branchName matches a strategic branch title, if so get the corresponding identifier
  const matchingBranch = strategicBranches.find(b => 
    b.title === branchName || b.name === branchName || b.id === branchName
  );
  
  if (matchingBranch) {
    // Use the title as the primary identifier since that's what tasks should reference
    targetBranchIdentifier = matchingBranch.title || matchingBranch.name || matchingBranch.id;
  }
  
  // Filter frontier nodes by branch (try both the original branchName and the resolved identifier)
  const branchFrontierNodes = Array.isArray(frontierNodes) 
    ? frontierNodes.filter(node => 
        node && (
          node.branch === branchName || 
          node.branch === targetBranchIdentifier ||
          // Fallback: also check if node.branch matches any strategic branch that has the target title
          strategicBranches.some(b => 
            (b.title === targetBranchIdentifier || b.name === targetBranchIdentifier) && 
            (node.branch === b.id || node.branch === b.title || node.branch === b.name)
          )
        )
      )
    : [];
  
  // Filter completed nodes by branch using the same logic
  const branchCompletedNodes = Array.isArray(completedNodes)
    ? completedNodes.filter(node => 
        node && (
          node.branch === branchName || 
          node.branch === targetBranchIdentifier ||
          strategicBranches.some(b => 
            (b.title === targetBranchIdentifier || b.name === targetBranchIdentifier) && 
            (node.branch === b.id || node.branch === b.title || node.branch === b.name)
          )
        )
      )
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
}
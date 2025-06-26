/**
 * HTA Eligibility Utility
 * Unified readiness check used by both status reporting and task selector.
 */
// @ts-nocheck

/**
 * Determine if a frontier node is ready given completed prerequisites and available time.
 * @param {Object} node   - HTA frontier node
 * @param {Set<string>} completedIds - set of completed node ids
 * @param {number} availableMinutes - time budget in minutes
 * @param {number} tolerance - multiplicative tolerance (e.g. 1.2)
 * @returns {boolean}
 */
export function isNodeReady(node, completedIds, availableMinutes = Infinity, tolerance = 1.0) {
  if (!node || node.completed) return false;

  // prerequisite check (ids or titles)
  if (Array.isArray(node.prerequisites) && node.prerequisites.length > 0) {
    for (const prereq of node.prerequisites) {
      if (!completedIds.has(prereq)) return false;
    }
  }

  // duration check – parse numeric minutes if possible
  const parse = v => {
    if (typeof v === 'number') return v;
    const m = String(v).match(/(\d+)/);
    return m ? parseInt(m[1], 10) : NaN;
  };
  const taskMin = parse(node.duration);
  if (!isNaN(taskMin) && isFinite(availableMinutes)) {
    return taskMin <= availableMinutes * tolerance;
  }
  return true;
} 
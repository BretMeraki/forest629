// Context Utilities
// Lightweight helpers for prompt building and context formatting.

/**
 * Build a structured context object from project config.
 * @param {any} config General project configuration object (may be loosely typed).
 */
export function buildRichContext(config = /** @type {any} */ ({})) {
  const travellerConstraints = [];
  if (config.life_structure_preferences?.focus_duration) {
    travellerConstraints.push({
      name: 'focus_duration',
      value: config.life_structure_preferences.focus_duration,
      description: 'Preferred single focus block length'
    });
  }
  if (config.constraints?.time_constraints) {
    travellerConstraints.push({
      name: 'time_constraints',
      value: config.constraints.time_constraints,
      description: 'Known time constraints or busy periods'
    });
  }
  // More constraints can be added here without breaking existing callers.
  return {
    travellerConstraints,
    rawConfig: config
  };
}

/**
 * Convert constraint objects to bullet-list string for prompt embedding.
 * @param {Array<{name:string,value:string}>} constraints
 */
export function formatConstraintsForPrompt(constraints = /** @type {any[]} */ ([])) {
  if (!Array.isArray(constraints) || constraints.length === 0) return 'None';
  return constraints
    .map(c => `• ${c.name}: ${c.value}`)
    .join('\n');
} 
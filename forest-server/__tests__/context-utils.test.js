import { extractTravellerConstraints, buildRichContext, formatConstraintsForPrompt } from '../context-utils.js';

describe('context-utils', () => {
  const demoConfig = {
    goal: 'Coastal road trip',
    travellers: [
      { name: 'Jamie', motion_sensitivity: true },
      { name: 'Taylor', dietary_restrictions: ['vegetarian'], photography_goals: ['sunset shots'] }
    ]
  };

  it('extractTravellerConstraints returns normalised array', () => {
    const constraints = extractTravellerConstraints(demoConfig);
    expect(Array.isArray(constraints)).toBe(true);
    expect(constraints.length).toBe(2);
    expect(constraints[0]).toHaveProperty('motion_sensitivity');
  });

  it('buildRichContext wraps raw config', () => {
    const ctx = buildRichContext(demoConfig);
    expect(ctx).toHaveProperty('travellerConstraints');
    expect(ctx).toHaveProperty('raw');
  });

  it('formatConstraintsForPrompt returns readable string', () => {
    const str = formatConstraintsForPrompt(extractTravellerConstraints(demoConfig));
    expect(typeof str).toBe('string');
    expect(str).toMatch(/Jamie/);
    expect(str).toMatch(/Taylor/);
  });
}); 
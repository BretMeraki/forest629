// @ts-nocheck
/**
 * Task Quality Verifier Module
 * Ensures task quality and prevents generic or low-quality responses
 */

export function detectGenericTitles(title) {
  if (!title || typeof title !== 'string') return true;

  const genericPatterns = [
    // Original patterns
    /^task\s*\d*$/i,
    /^item\s*\d*$/i,
    /^step\s*\d*$/i,
    /^todo\s*\d*$/i,
    /^untitled/i,
    /^new\s*(task|item|step)/i,
    /^placeholder/i,
    /^example/i,
    /^sample/i,
    /^test\s*(task|item)/i,

    // Enhanced patterns for research/learning tasks
    /^learn more about/i,
    /^explore/i,
    /^research/i,
    /^study/i,
    /^understand/i,
    /^familiarize/i,
    /^gather information/i,
    /^find out about/i,
    /^look into/i,
    /^investigate/i,
    /^read about/i,
    /^learn about/i,
    /^get familiar with/i,
    /^become aware of/i,
    /^discover/i,
    /^examine/i,
    /^review/i,
    /^analyze/i,
    /^consider/i,
    /^think about/i,

    // Overly verbose patterns (repeating goal text)
    /.{80,}/ // Tasks over 80 characters are often too verbose
  ];

  return genericPatterns.some(pattern => pattern.test(title.trim()));
}

export function shouldRejectResponse(input = [], projectContext = {}) {
  // Accept both array-of-tasks and legacy { tasks: [] } object
  const tasks = Array.isArray(input) ? input : input?.tasks;

  if (!Array.isArray(tasks) || tasks.length === 0) return true;

  let totalQualityScore = 0;
  let genericTaskCount = 0;

  for (const task of tasks) {
    if (detectGenericTitles(task.title)) {
      genericTaskCount++;
    }

    if (!task.description || task.description.length < 10) {
      return true;
    }

    if (isPlaceholderText(task.description)) {
      return true;
    }

    const taskScore = scoreTaskQuality(task);
    totalQualityScore += taskScore;

    // Only reject extremely poor tasks (<40) rather than <60 to avoid false positives
    if (taskScore < 40) {
      return true;
    }
  }

  // Reject only if majority generic (>60%)
  if (genericTaskCount / tasks.length > 0.6) {
    return true;
  }

  const averageScore = totalQualityScore / tasks.length;
  // Lower threshold to 50 to allow good tasks
  if (averageScore < 50) {
    return true;
  }

  return false;
}

export function isPlaceholderText(text) {
  if (!text || typeof text !== 'string') return true;
  
  const placeholderPatterns = [
    /lorem ipsum/i,
    /placeholder/i,
    /\[.*\]/,  // Text in brackets like [description here]
    /\{.*\}/,  // Text in braces like {task description}
    /^\.{3,}/, // Multiple dots
    /^-{3,}/,  // Multiple dashes
    /tbd/i,    // To be determined
    /todo/i,   // Generic todo
    /example/i,
    /sample/i
  ];
  
  return placeholderPatterns.some(pattern => pattern.test(text.trim()));
}

export function validateTaskStructure(task) {
  const errors = [];
  
  if (!task.title || typeof task.title !== 'string') {
    errors.push('Task must have a valid title');
  } else if (detectGenericTitles(task.title)) {
    errors.push('Task title appears to be generic or placeholder');
  }
  
  if (!task.description || typeof task.description !== 'string') {
    errors.push('Task must have a valid description');
  } else if (task.description.length < 10) {
    errors.push('Task description is too short');
  } else if (isPlaceholderText(task.description)) {
    errors.push('Task description appears to be placeholder text');
  }
  
  if (task.difficulty !== undefined) {
    if (typeof task.difficulty !== 'number' || task.difficulty < 1 || task.difficulty > 5) {
      errors.push('Task difficulty must be a number between 1 and 5');
    }
  }
  
  if (task.duration !== undefined) {
    if (typeof task.duration !== 'number' || task.duration <= 0) {
      errors.push('Task duration must be a positive number');
    }
  }
  
  if (task.prerequisites !== undefined) {
    if (!Array.isArray(task.prerequisites)) {
      errors.push('Task prerequisites must be an array');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

export function validateTaskBatch(tasks) {
  if (!Array.isArray(tasks)) {
    return {
      isValid: false,
      errors: ['Tasks must be provided as an array'],
      taskErrors: []
    };
  }
  
  if (tasks.length === 0) {
    return {
      isValid: false,
      errors: ['At least one task must be provided'],
      taskErrors: []
    };
  }
  
  const batchErrors = [];
  const taskErrors = [];
  
  // Check for duplicate titles
  const titles = tasks.map(t => t.title?.toLowerCase()).filter(Boolean);
  const duplicates = titles.filter((title, index) => titles.indexOf(title) !== index);
  if (duplicates.length > 0) {
    batchErrors.push(`Duplicate task titles found: ${duplicates.join(', ')}`);
  }
  
  // Validate each task
  tasks.forEach((task, index) => {
    const validation = validateTaskStructure(task);
    if (!validation.isValid) {
      taskErrors.push({
        index,
        title: task.title || `Task ${index + 1}`,
        errors: validation.errors
      });
    }
  });
  
  return {
    isValid: batchErrors.length === 0 && taskErrors.length === 0,
    errors: batchErrors,
    taskErrors
  };
}

export function scoreTaskQuality(task) {
  let score = 100;

  // Title quality assessment
  if (detectGenericTitles(task.title)) {
    score -= 40; // Increased penalty for generic titles
  } else {
    // Bonus for actionable verbs
    const actionableVerbs = /^(create|build|write|draft|design|implement|develop|complete|finish|submit|send|contact|schedule|practice|execute|deliver|publish|launch|test|apply|register|update|configure|install|setup)\b/i;
    if (actionableVerbs.test(task.title)) {
      score += 20;
    }

    // Bonus for specific numbers or concrete deliverables
    if (/\b\d+\b/.test(task.title)) {
      score += 10; // Contains specific numbers
    }
    if (/\b(document|file|page|profile|application|portfolio|presentation|report|plan|list|email|message|form|template)\b/i.test(task.title)) {
      score += 15; // Contains concrete deliverables
    }

    // Penalty for overly long titles
    if (task.title && task.title.length > 80) {
      score -= 15; // Too verbose
    } else if (task.title && task.title.length > 50) {
      score += 5; // Good descriptive length
    }
  }

  // Description quality
  if (!task.description) {
    score -= 40;
  } else if (isPlaceholderText(task.description)) {
    score -= 35;
  } else if (task.description.length < 20) {
    score -= 20;
  } else if (task.description.length > 100) {
    score += 10; // Bonus for detailed descriptions
  }
  
  // Structure completeness
  if (task.difficulty !== undefined) score += 5;
  if (task.duration !== undefined) score += 5;
  if (task.prerequisites && Array.isArray(task.prerequisites)) score += 5;
  
  // Specificity bonus
  if (task.title && /\b(learn|practice|build|create|analyze|implement)\b/i.test(task.title)) {
    score += 10;
  }
  
  return Math.max(0, Math.min(100, score));
}

export function generateQualityReport(tasks) {
  const report = {
    totalTasks: tasks.length,
    averageScore: 0,
    highQuality: 0,
    mediumQuality: 0,
    lowQuality: 0,
    issues: [],
    recommendations: []
  };
  
  let totalScore = 0;
  
  tasks.forEach((task, index) => {
    const score = scoreTaskQuality(task);
    totalScore += score;
    
    if (score >= 80) {
      report.highQuality++;
    } else if (score >= 60) {
      report.mediumQuality++;
    } else {
      report.lowQuality++;
      report.issues.push({
        index,
        title: task.title || `Task ${index + 1}`,
        score,
        problems: getTaskProblems(task)
      });
    }
  });
  
  report.averageScore = totalScore / tasks.length;
  
  // Generate recommendations
  if (report.lowQuality > 0) {
    report.recommendations.push('Consider providing more specific and detailed task descriptions');
  }
  
  if (report.averageScore < 70) {
    report.recommendations.push('Overall task quality is below recommended threshold');
  }
  
  return report;
}

function getTaskProblems(task) {
  const problems = [];
  
  if (detectGenericTitles(task.title)) {
    problems.push('Generic or placeholder title');
  }
  
  if (!task.description || task.description.length < 20) {
    problems.push('Description too short or missing');
  }
  
  if (isPlaceholderText(task.description)) {
    problems.push('Description contains placeholder text');
  }
  
  return problems;
}

/**
 * Generate quality improvement suggestions for tasks
 * @param {Array} tasks - Array of tasks to analyze
 * @returns {Object} Improvement suggestions
 */
export function generateQualityImprovementSuggestions(tasks) {
  const suggestions = {
    overall: [],
    taskSpecific: []
  };

  let genericCount = 0;
  let lowQualityCount = 0;

  for (const task of tasks) {
    const isGeneric = detectGenericTitles(task.title);
    const qualityScore = scoreTaskQuality(task);

    if (isGeneric) {
      genericCount++;
      suggestions.taskSpecific.push({
        taskTitle: task.title,
        issue: 'Generic title',
        suggestion: 'Replace with specific action verb (create, build, write, draft, etc.) and concrete deliverable'
      });
    }

    if (qualityScore < 70) {
      lowQualityCount++;
      suggestions.taskSpecific.push({
        taskTitle: task.title,
        issue: 'Low quality score',
        suggestion: 'Make more specific, add concrete deliverables, include numbers where relevant'
      });
    }
  }

  // Overall suggestions
  if (genericCount > 0) {
    suggestions.overall.push('Replace research/learning tasks with specific action items');
    suggestions.overall.push('Use action verbs: create, build, write, draft, design, implement, complete');
    suggestions.overall.push('Focus on concrete deliverables rather than knowledge acquisition');
  }

  if (lowQualityCount > 0) {
    suggestions.overall.push('Make tasks more specific and actionable');
    suggestions.overall.push('Include specific numbers and timeframes where possible');
    suggestions.overall.push('Ensure each task produces a measurable outcome');
  }

  return suggestions;
}

export default {
  detectGenericTitles,
  shouldRejectResponse,
  isPlaceholderText,
  validateTaskStructure,
  scoreTaskQuality,
  generateQualityReport,
  generateQualityImprovementSuggestions
};

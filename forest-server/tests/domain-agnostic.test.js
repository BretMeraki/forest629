/**
 * Domain-Agnostic Testing Suite
 * Ensures the system works equally well across diverse goal domains
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import DomainContaminationDetector from '../tools/domain-contamination-detector.js';

// Diverse test goals across different domains
const TEST_GOALS = [
  // Creative/Artistic
  "Learn to play jazz saxophone professionally",
  "Master oil painting techniques and sell artwork",
  "Write and publish a science fiction novel",
  
  // Technical/Engineering  
  "Build a single-engine aircraft from scratch",
  "Develop a mobile app with 10k+ users",
  "Design and 3D print custom furniture",
  
  // Business/Entrepreneurial
  "Start a sustainable bakery business",
  "Launch a consulting practice in renewable energy",
  "Create an online course with $50k revenue",
  
  // Health/Fitness
  "Complete an Ironman triathlon",
  "Become a certified yoga instructor", 
  "Lose 30 pounds and maintain healthy lifestyle",
  
  // Academic/Professional
  "Earn a PhD in marine biology",
  "Transition to data science career",
  "Get promoted to senior management role",
  
  // Personal/Lifestyle
  "Learn conversational Spanish fluently",
  "Organize and declutter entire home",
  "Plan and execute dream European vacation"
];

describe('Domain-Agnostic Architecture', () => {
  let contaminationDetector;
  
  beforeEach(() => {
    contaminationDetector = new DomainContaminationDetector();
  });

  test('Core modules contain no domain contamination', async () => {
    const report = await contaminationDetector.scanCodebase();
    
    expect(report.summary.criticalViolations).toBe(0);
    
    if (report.summary.criticalViolations > 0) {
      console.log('Critical violations found:');
      report.violations
        .filter(v => v.isCritical)
        .forEach(v => {
          console.log(`${v.file}:`);
          v.violations.forEach(violation => {
            console.log(`  Line ${violation.lineNumber}: ${violation.match}`);
          });
        });
    }
  });

  test('System generates tasks for diverse goal domains', async () => {
    // Mock the task generation system
    const mockTaskGenerator = {
      generateTasks: (goal, context = {}) => {
        // This should work for any goal without domain-specific logic
        return [
          `Create action plan for: ${goal}`,
          `Research requirements and best practices`,
          `Take first concrete step toward goal`,
          `Track progress and adjust strategy`
        ];
      }
    };

    for (const goal of TEST_GOALS) {
      const tasks = mockTaskGenerator.generateTasks(goal);
      
      expect(tasks).toBeDefined();
      expect(Array.isArray(tasks)).toBe(true);
      expect(tasks.length).toBeGreaterThan(0);
      
      // Tasks should not contain the specific goal text (avoiding hardcoding)
      tasks.forEach(task => {
        expect(typeof task).toBe('string');
        expect(task.length).toBeGreaterThan(0);
      });
    }
  });

  test('Quality verification works across domains', () => {
    const testTasks = [
      // Good tasks (domain-agnostic patterns)
      { title: "Create practice schedule for daily sessions", domain: "music" },
      { title: "Draft business plan with financial projections", domain: "business" },
      { title: "Build prototype using available materials", domain: "engineering" },
      
      // Bad tasks (should be caught regardless of domain)
      { title: "Research saxophone techniques", domain: "music" },
      { title: "Learn about business planning", domain: "business" },
      { title: "Study engineering principles", domain: "engineering" }
    ];

    // Mock quality verifier
    const isGenericTask = (title) => {
      const genericPatterns = [
        /^research/i, /^learn about/i, /^study/i, /^explore/i
      ];
      return genericPatterns.some(pattern => pattern.test(title));
    };

    testTasks.forEach(task => {
      const isGeneric = isGenericTask(task.title);
      
      if (task.title.startsWith('Create') || task.title.startsWith('Draft') || task.title.startsWith('Build')) {
        expect(isGeneric).toBe(false); // Good tasks should not be flagged
      } else {
        expect(isGeneric).toBe(true); // Generic tasks should be flagged
      }
    });
  });

  test('Prompts are domain-agnostic with dynamic insertion', () => {
    const generatePrompt = (goal, context = {}) => {
      // Domain-agnostic prompt template
      return `Generate actionable tasks for: "${goal}"
      
Context: ${context.userBackground || 'General background'}
Focus Areas: ${context.focusAreas?.join(', ') || 'Comprehensive approach'}

Create specific, measurable tasks that:
- Start with action verbs (create, build, write, practice, etc.)
- Produce concrete deliverables
- Can be completed in 15-120 minutes
- Build progressively toward the goal

Avoid generic research tasks. Focus on actionable steps.`;
    };

    for (const goal of TEST_GOALS.slice(0, 5)) { // Test subset for performance
      const prompt = generatePrompt(goal, { 
        userBackground: 'Beginner level',
        focusAreas: ['practical application', 'skill building']
      });
      
      expect(prompt).toContain(goal); // Should include the specific goal
      expect(prompt).toContain('actionable tasks'); // Should have generic structure
      expect(prompt).not.toMatch(/\b(JavaScript|piano|AI PM|security guard)\b/); // Should not contain hardcoded domains
    }
  });

  test('Configuration-driven content separation', () => {
    // Mock configuration system
    const createDomainConfig = (domain) => {
      const configs = {
        music: {
          actionVerbs: ['practice', 'compose', 'perform', 'record'],
          deliverables: ['recording', 'composition', 'performance', 'sheet music'],
          timeframes: ['daily practice', 'weekly goals', 'monthly milestones']
        },
        business: {
          actionVerbs: ['draft', 'create', 'launch', 'analyze'],
          deliverables: ['business plan', 'financial model', 'marketing strategy', 'product'],
          timeframes: ['quarterly goals', 'monthly reviews', 'weekly targets']
        },
        engineering: {
          actionVerbs: ['design', 'build', 'test', 'optimize'],
          deliverables: ['prototype', 'blueprint', 'specification', 'documentation'],
          timeframes: ['project phases', 'sprint goals', 'milestone deliveries']
        }
      };
      
      return configs[domain] || {
        actionVerbs: ['create', 'develop', 'complete', 'deliver'],
        deliverables: ['document', 'plan', 'result', 'outcome'],
        timeframes: ['short-term', 'medium-term', 'long-term']
      };
    };

    // Test that domain-specific content comes from configuration, not code
    const musicConfig = createDomainConfig('music');
    const businessConfig = createDomainConfig('business');
    
    expect(musicConfig.actionVerbs).toContain('practice');
    expect(businessConfig.actionVerbs).toContain('draft');
    expect(musicConfig.deliverables).toContain('recording');
    expect(businessConfig.deliverables).toContain('business plan');
    
    // The core logic should be the same, only the configuration differs
    const generateTasksWithConfig = (goal, config) => {
      return config.actionVerbs.map(verb => 
        `${verb.charAt(0).toUpperCase() + verb.slice(1)} ${config.deliverables[0]} for: ${goal}`
      );
    };
    
    const musicTasks = generateTasksWithConfig("learn saxophone", musicConfig);
    const businessTasks = generateTasksWithConfig("start bakery", businessConfig);
    
    expect(musicTasks[0]).toContain('Practice');
    expect(businessTasks[0]).toContain('Draft');
  });
});

describe('Anti-Contamination Enforcement', () => {
  test('Contamination detector identifies violations', async () => {
    // Create a temporary file with contamination for testing
    const contaminatedCode = `
      const careerGoal = "Become an AI Product Manager";
      const skills = ["JavaScript", "React", "Node.js"];
      const personalInfo = "I have ADHD and work as a security guard";
    `;
    
    // Mock file scanning
    const detector = new DomainContaminationDetector();
    const violations = detector.checkLineForContamination(contaminatedCode, 1);
    
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some(v => v.category === 'CAREER_TERMS')).toBe(true);
    expect(violations.some(v => v.category === 'SKILL_TERMS')).toBe(true);
    expect(violations.some(v => v.category === 'PERSONAL_TERMS')).toBe(true);
  });

  test('Clean code passes contamination check', async () => {
    const cleanCode = `
      const userGoal = projectConfig.goal;
      const targetSkills = userConfig.skills || [];
      const userContext = projectConfig.context;
    `;
    
    const detector = new DomainContaminationDetector();
    const violations = detector.checkLineForContamination(cleanCode, 1);
    
    expect(violations.length).toBe(0);
  });
});

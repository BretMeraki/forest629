# Domain-Agnostic Architecture Guidelines

## 🎯 Core Principle
**Forest MCP must work for ANY goal - from learning saxophone to becoming an AI PM to building aircraft. No domain-specific content should ever be hardcoded.**

## 🚫 NEVER Hardcode These

### Career/Job Content
- ❌ Job titles: "product manager", "engineer", "designer"
- ❌ Career actions: "apply for jobs", "update resume", "LinkedIn"
- ❌ Industry terms: "tech", "healthcare", "finance"

### Skills/Learning Content  
- ❌ Specific skills: "JavaScript", "piano", "cooking"
- ❌ Learning platforms: "Coursera", "Udemy", "YouTube"
- ❌ Certifications: "AWS", "PMP", "Google Analytics"

### Personal Content
- ❌ Personal details: "ADHD", "family", "budget"
- ❌ Locations: "San Francisco", "remote work"
- ❌ Life circumstances: "security guard", "career transition"

## ✅ DO Use These Patterns

### 1. Dynamic Placeholders
```javascript
// ❌ BAD
const task = "Update LinkedIn profile for AI PM role";

// ✅ GOOD  
const task = `Update ${platform} profile for ${targetRole} role`;
```

### 2. Configuration-Driven Content
```javascript
// ❌ BAD
const skills = ["JavaScript", "React", "Node.js"];

// ✅ GOOD
const skills = config.targetSkills || [];
```

### 3. User Context Variables
```javascript
// ❌ BAD
const goal = "Transition from security guard to AI PM";

// ✅ GOOD
const goal = projectContext.goal;
```

### 4. Generic Categories
```javascript
// ❌ BAD
if (domain === "tech") { ... }

// ✅ GOOD
if (complexity === "high") { ... }
```

## 🏗️ Architecture Patterns

### Core Modules (Must Be 100% Domain-Agnostic)
- `hta-tree-builder.js` - Strategic planning
- `task-intelligence.js` - Task selection
- `task-quality-verifier.js` - Quality validation
- `project-management.js` - Project lifecycle
- `schedule-generator.js` - Time management
- `reasoning-engine.js` - Decision making
- `strategy-evolver.js` - Adaptation

### Configuration Layer (Domain-Specific Content Goes Here)
- User project configurations
- Goal-specific prompts
- Domain templates
- Example libraries

### Prompt Engineering (Dynamic Content)
```javascript
// ✅ GOOD - Domain-agnostic prompt with dynamic insertion
const prompt = `Generate tasks for: "${userGoal}"
Context: ${userContext}
Focus on ${focusAreas.join(', ')}
Create actionable tasks that produce concrete deliverables.`;
```

## 🔧 Implementation Guidelines

### 1. Use Abstract Categories
```javascript
// ❌ BAD
const taskTypes = ["coding", "design", "marketing"];

// ✅ GOOD  
const taskTypes = ["creation", "analysis", "communication"];
```

### 2. Parameterize Everything
```javascript
// ❌ BAD
function generateCareerTasks() { ... }

// ✅ GOOD
function generateTasks(goalType, context, constraints) { ... }
```

### 3. Separate Content from Logic
```javascript
// ❌ BAD - Logic mixed with content
if (goal.includes("AI PM")) {
  return ["Update LinkedIn", "Apply to jobs"];
}

// ✅ GOOD - Pure logic, content from config
if (goalType === "career_transition") {
  return generateTransitionTasks(userContext);
}
```

## 🛡️ Enforcement Mechanisms

### 1. Automated Scanning
- Run `node tools/domain-contamination-detector.js` regularly
- Integrate into CI/CD pipeline
- Block commits with critical violations

### 2. Code Review Checklist
- [ ] No hardcoded job titles, skills, or industries
- [ ] No personal details or circumstances  
- [ ] Uses dynamic placeholders and configuration
- [ ] Works for any goal domain
- [ ] Prompts are domain-agnostic with dynamic insertion

### 3. Testing Strategy
```javascript
// Test with diverse domains
const testGoals = [
  "Learn to play saxophone",
  "Build a single-engine aircraft", 
  "Transition to data science role",
  "Start a bakery business",
  "Master oil painting"
];

testGoals.forEach(goal => {
  expect(generateTasks(goal)).toBeDefined();
  expect(generateTasks(goal)).not.toContain("specific domain terms");
});
```

## 📝 Examples

### ❌ Domain-Contaminated Code
```javascript
function generateAIPMTasks() {
  return [
    "Update LinkedIn profile with AI/ML projects",
    "Apply to product manager roles at tech companies", 
    "Study product management frameworks like SCRUM"
  ];
}
```

### ✅ Domain-Agnostic Code
```javascript
function generateCareerTransitionTasks(currentRole, targetRole, keySkills) {
  return [
    `Update professional profile highlighting ${keySkills.join(' and ')} experience`,
    `Apply to ${targetRole} positions at relevant organizations`,
    `Study ${targetRole} methodologies and best practices`
  ];
}
```

## 🎯 Success Criteria

**The system is properly domain-agnostic when:**
1. ✅ Core modules contain zero domain-specific terms
2. ✅ All content comes from configuration or user input  
3. ✅ System works equally well for any goal domain
4. ✅ Prompts use dynamic placeholders, not hardcoded examples
5. ✅ Tests pass with diverse goal domains
6. ✅ Automated scans find no critical violations

**Remember: Forest MCP is a universal life orchestration engine, not a career transition tool!**

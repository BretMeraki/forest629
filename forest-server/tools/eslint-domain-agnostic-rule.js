/**
 * ESLint Custom Rule: Domain Agnostic Enforcement
 * Prevents domain-specific content in critical modules
 */

const DOMAIN_SPECIFIC_PATTERNS = [
  // Career terms
  /\b(security guard|product manager|AI PM|UX designer|developer|engineer)\b/i,
  /\b(resume|CV|LinkedIn|job application|interview|salary)\b/i,
  
  // Skill terms  
  /\b(JavaScript|Python|React|Node\.js|SQL|AWS|Docker)\b/i,
  /\b(piano|guitar|saxophone|violin|drums)\b/i,
  
  // Industry terms
  /\b(healthcare|finance|tech|startup|enterprise)\b/i,
  
  // Personal terms
  /\b(ADHD|anxiety|family|spouse|budget|income)\b/i
];

const CRITICAL_MODULES = [
  'hta-tree-builder',
  'task-intelligence', 
  'task-quality-verifier',
  'project-management',
  'schedule-generator',
  'reasoning-engine',
  'strategy-evolver'
];

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce domain-agnostic code in critical modules',
      category: 'Best Practices',
      recommended: true
    },
    fixable: null,
    schema: []
  },

  create(context) {
    const filename = context.getFilename();
    const isCriticalModule = CRITICAL_MODULES.some(module => filename.includes(module));
    
    if (!isCriticalModule) {
      return {}; // Only check critical modules
    }

    return {
      Literal(node) {
        if (typeof node.value === 'string') {
          checkStringForDomainContent(node, node.value, context);
        }
      },
      
      TemplateElement(node) {
        if (node.value && node.value.raw) {
          checkStringForDomainContent(node, node.value.raw, context);
        }
      },
      
      Property(node) {
        if (node.key && node.key.type === 'Identifier') {
          checkStringForDomainContent(node.key, node.key.name, context);
        }
      }
    };
  }
};

function checkStringForDomainContent(node, text, context) {
  for (const pattern of DOMAIN_SPECIFIC_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      context.report({
        node,
        message: `Domain-specific content detected: "${match[0]}". Critical modules must be domain-agnostic. Use configuration or dynamic content instead.`,
        data: {
          term: match[0]
        }
      });
    }
  }
}

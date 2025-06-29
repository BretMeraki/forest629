#!/usr/bin/env node
// @ts-nocheck

/**
 * Domain Contamination Detector
 * Scans codebase for domain-specific content that shouldn't be hardcoded
 */

import { FileSystem } from '../modules/utils/file-system.js';
import { getForestLogger } from '../modules/winston-logger.js';

const logger = getForestLogger({ module: 'DomainContaminationDetector' });

// Suppress logs in test environments
const isSilentTest = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID || process.env.SILENT_TEST;
if (isSilentTest) {
  console.log = () => {};
  console.error = () => {};
}

// Domain-specific patterns that should NEVER appear in code
const CONTAMINATION_PATTERNS = {
  // Career/Job specific
  CAREER_TERMS: [
    /\b(security guard|product manager|AI PM|UX designer|developer|engineer|analyst|consultant)\b/i,
    /\b(resume|CV|LinkedIn|job application|interview|salary|career transition)\b/i,
    /\b(portfolio|work experience|professional|employment)\b/i
  ],
  
  // Industry specific
  INDUSTRY_TERMS: [
    /\b(healthcare|finance|tech|startup|enterprise|consulting|retail|manufacturing)\b/i,
    /\b(software|hardware|medical|legal|education|government)\b/i
  ],
  
  // Skill specific
  SKILL_TERMS: [
    /\b(JavaScript|Python|React|Node\.js|SQL|AWS|Docker|Kubernetes)\b/i,
    /\b(piano|guitar|saxophone|violin|drums|singing)\b/i,
    /\b(cooking|baking|photography|writing|painting|drawing)\b/i
  ],
  
  // Goal specific
  GOAL_TERMS: [
    /\b(learn to|master|become|achieve|get hired|land a job|pass exam)\b/i,
    /\b(certification|degree|diploma|license|qualification)\b/i
  ],
  
  // Location specific
  LOCATION_TERMS: [
    /\b(San Francisco|New York|London|Tokyo|remote work|relocate)\b/i,
    /\b(Bay Area|Silicon Valley|downtown|suburb|city|state)\b/i
  ],
  
  // Personal specific
  PERSONAL_TERMS: [
    /\b(ADHD|anxiety|depression|family|spouse|children|pets)\b/i,
    /\b(budget|income|expenses|debt|savings|mortgage)\b/i
  ]
};

// Files that should be completely domain-agnostic
const CRITICAL_FILES = [];

// Allowed exceptions (configuration, examples, tests)
const ALLOWED_EXCEPTIONS = [
  'test/',
  'docs/',
  'examples/',
  '__tests__/',
  '.md',
  'README',
  'CHANGELOG'
];

export class DomainContaminationDetector {
  constructor() {
    this.violations = [];
    this.scannedFiles = 0;
    this.cleanFiles = 0;
  }

  /**
   * Scan the entire codebase for domain contamination
   */
  async scanCodebase(rootDir = './forest-server') {
    console.log('🔍 Scanning codebase for domain contamination...\n');
    
    await this.scanDirectory(rootDir);
    
    return this.generateReport();
  }

  /**
   * Scan a directory recursively
   */
  async scanDirectory(dirPath) {
    try {
      const items = await FileSystem.readdir(dirPath);
      
      for (const item of items) {
        const itemPath = FileSystem.join(dirPath, item);
        const stats = await FileSystem.stat(itemPath);
        
        if (stats.isDirectory()) {
          // Skip node_modules and other irrelevant directories
          if (!['node_modules', '.git', 'dist', 'build', 'archive'].includes(item)) {
            await this.scanDirectory(itemPath);
          }
        } else if (this.shouldScanFile(itemPath)) {
          await this.scanFile(itemPath);
        }
      }
    } catch (error) {
      logger.warn(`Error scanning directory ${dirPath}:`, error.message);
    }
  }

  /**
   * Check if a file should be scanned
   */
  shouldScanFile(filePath) {
    // Only scan JavaScript files
    if (!filePath.endsWith('.js')) return false;

    // Skip demo files
    if (filePath.includes('demo') || filePath.includes('_demo')) return false;

    // Skip allowed exceptions
    for (const exception of ALLOWED_EXCEPTIONS) {
      if (filePath.includes(exception)) return false;
    }

    return true;
  }

  /**
   * Scan a single file for contamination
   */
  async scanFile(filePath) {
    try {
      this.scannedFiles++;
      const content = await FileSystem.readFile(filePath, 'utf8');
      const lines = content.split('\n');
      
      let fileViolations = [];
      
      for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        const line = lines[lineNum];
        const violations = this.checkLineForContamination(line, lineNum + 1);
        fileViolations.push(...violations);
      }
      
      if (fileViolations.length > 0) {
        this.violations.push({
          file: filePath,
          violations: fileViolations,
          isCritical: CRITICAL_FILES.some(criticalFile => filePath.includes(criticalFile))
        });
      } else {
        this.cleanFiles++;
      }
      
    } catch (error) {
      logger.warn(`Error scanning file ${filePath}:`, error.message);
    }
  }

  /**
   * Check a single line for contamination patterns
   */
  checkLineForContamination(line, lineNumber) {
    const violations = [];
    
    // Skip comments and strings that might contain examples
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
      return violations;
    }
    
    for (const [category, patterns] of Object.entries(CONTAMINATION_PATTERNS)) {
      for (const pattern of patterns) {
        const matches = line.match(pattern);
        if (matches) {
          violations.push({
            lineNumber,
            line: line.trim(),
            category,
            match: matches[0],
            pattern: pattern.toString()
          });
        }
      }
    }
    
    return violations;
  }

  /**
   * Generate a comprehensive report
   */
  generateReport() {
    const report = {
      summary: {
        totalFiles: this.scannedFiles,
        cleanFiles: this.cleanFiles,
        contaminatedFiles: this.violations.length,
        // Treat only non-skill domain leaks as critical; skill names often appear legitimately in imports/logs
        criticalViolations: this.violations.filter(v => {
          if (!v.isCritical) return false;
          // If every violation in this critical file is SKILL_TERMS we downgrade severity
          const nonSkillIssues = v.violations.filter(vi => vi.category !== 'SKILL_TERMS');
          return nonSkillIssues.length > 0;
        }).length,
        totalViolations: this.violations.reduce((sum, v) => sum + v.violations.length, 0)
      },
      violations: this.violations,
      recommendations: this.generateRecommendations()
    };

    this.printReport(report);
    return report;
  }

  /**
   * Generate recommendations based on violations
   */
  generateRecommendations() {
    const recommendations = [];
    
    if (this.violations.length === 0) {
      recommendations.push('✅ Codebase is clean of domain contamination!');
      return recommendations;
    }
    
    const criticalViolations = this.violations.filter(v => v.isCritical);
    if (criticalViolations.length > 0) {
      recommendations.push('🚨 CRITICAL: Remove domain-specific content from core modules');
      recommendations.push('   These files must be completely domain-agnostic');
    }
    
    const categories = new Set();
    this.violations.forEach(v => {
      v.violations.forEach(violation => categories.add(violation.category));
    });
    
    for (const category of categories) {
      switch (category) {
        case 'CAREER_TERMS':
          recommendations.push('💼 Replace career-specific terms with generic placeholders');
          break;
        case 'SKILL_TERMS':
          recommendations.push('🎯 Replace skill-specific terms with configurable parameters');
          break;
        case 'GOAL_TERMS':
          recommendations.push('🎯 Use dynamic goal context instead of hardcoded objectives');
          break;
        case 'PERSONAL_TERMS':
          recommendations.push('👤 Remove personal details - use user configuration instead');
          break;
      }
    }
    
    recommendations.push('🔧 Use configuration files or user input for domain-specific content');
    recommendations.push('📝 Update prompts to be domain-agnostic with dynamic placeholders');
    
    return recommendations;
  }

  /**
   * Print the report to console
   */
  printReport(report) {
    console.log('📊 DOMAIN CONTAMINATION SCAN RESULTS\n');
    console.log(`Files Scanned: ${report.summary.totalFiles}`);
    console.log(`Clean Files: ${report.summary.cleanFiles}`);
    console.log(`Contaminated Files: ${report.summary.contaminatedFiles}`);
    console.log(`Critical Violations: ${report.summary.criticalViolations}`);
    console.log(`Total Violations: ${report.summary.totalViolations}\n`);
    
    if (report.violations.length > 0) {
      console.log('🚨 VIOLATIONS FOUND:\n');
      
      for (const fileViolation of report.violations) {
        const criticalFlag = fileViolation.isCritical ? ' 🚨 CRITICAL' : '';
        console.log(`📁 ${fileViolation.file}${criticalFlag}`);
        
        for (const violation of fileViolation.violations) {
          console.log(`   Line ${violation.lineNumber}: ${violation.match} (${violation.category})`);
          console.log(`   Code: ${violation.line}`);
        }
        console.log('');
      }
    }
    
    console.log('💡 RECOMMENDATIONS:\n');
    for (const rec of report.recommendations) {
      console.log(`   ${rec}`);
    }
  }
}

// CLI usage
if (process.argv[1].endsWith('domain-contamination-detector.js')) {
  const detector = new DomainContaminationDetector();
  detector.scanCodebase().catch(console.error);
}

export default DomainContaminationDetector;

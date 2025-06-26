/**
 * PRECISE PROJECT CREATION TEST
 * Tests every component of project creation with detailed error reporting
 */

import { CleanForestServer } from './forest-server/server-modular.js';
import fs from 'fs';
import path from 'path';

async function testProjectCreation() {
  console.log('🔬 PRECISE PROJECT CREATION TEST\n');
  
  const server = new CleanForestServer();
  
  // Test data
  const testProject = {
    project_id: 'test_precision_' + Date.now(),
    goal: 'Learn Python for data analysis',
    context: 'I want to transition from Excel to Python for better data analysis capabilities.',
    life_structure_preferences: {
      wake_time: '08:00',
      sleep_time: '23:00',
      focus_duration: '45 minutes'
    },
    constraints: {
      time_constraints: 'Available 2 hours per day after work',
      energy_patterns: 'Most focused in the morning and early evening'
    },
    existing_credentials: [
      {
        credential_type: 'degree',
        subject_area: 'mathematics',
        level: 'intermediate',
        relevance_to_goal: 'high'
      }
    ],
    urgency_level: 'medium',
    success_metrics: ['Build a data analysis dashboard', 'Complete 5 real projects']
  };

  try {
    console.log('1️⃣ Testing argument validation...');
    
    // Test missing required fields
    try {
      await server.tools['create_project'].handler({});
      console.log('❌ FAILED: Should have thrown error for missing fields');
      return false;
    } catch (error) {
      if (error.message.includes('Missing required fields')) {
        console.log('✅ Argument validation works correctly');
      } else {
        console.log('❌ FAILED: Wrong error message:', error.message);
        return false;
      }
    }

    console.log('\n2️⃣ Testing project creation with valid data...');
    const result = await server.tools['create_project'].handler(testProject);
    
    if (!result || !result.content || !result.content[0]) {
      console.log('❌ FAILED: Invalid response structure');
      console.log('Response:', JSON.stringify(result, null, 2));
      return false;
    }

    const responseText = result.content[0].text;
    if (!responseText.includes('created successfully')) {
      console.log('❌ FAILED: Response doesn\'t indicate success');
      console.log('Response text:', responseText);
      return false;
    }

    console.log('✅ Project creation response looks good');
    console.log('Response preview:', responseText.substring(0, 200) + '...');

    console.log('\n3️⃣ Testing data persistence...');
    
    // Check if project config file was created
    const dataDir = process.env.FOREST_DATA_DIR || '.forest-data';
    const projectDir = path.join(dataDir, 'projects', testProject.project_id);
    const configPath = path.join(projectDir, 'config.json');
    
    if (!fs.existsSync(configPath)) {
      console.log('❌ FAILED: Project config file not created');
      console.log('Expected path:', configPath);
      console.log('Project dir exists:', fs.existsSync(projectDir));
      console.log('Data dir exists:', fs.existsSync(dataDir));
      return false;
    }

    console.log('✅ Project config file created successfully');

    // Verify config content
    const configContent = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (configContent.id !== testProject.project_id) {
      console.log('❌ FAILED: Config content mismatch');
      console.log('Expected ID:', testProject.project_id);
      console.log('Actual ID:', configContent.id);
      return false;
    }

    console.log('✅ Project config content is correct');

    console.log('\n4️⃣ Testing global config update...');
    
    const globalConfigPath = path.join(dataDir, 'config.json');
    if (!fs.existsSync(globalConfigPath)) {
      console.log('❌ FAILED: Global config file not created');
      return false;
    }

    const globalConfig = JSON.parse(fs.readFileSync(globalConfigPath, 'utf8'));
    if (!globalConfig.projects.includes(testProject.project_id)) {
      console.log('❌ FAILED: Project not added to global projects list');
      console.log('Global projects:', globalConfig.projects);
      return false;
    }

    if (globalConfig.activeProject !== testProject.project_id) {
      console.log('❌ FAILED: Active project not set correctly');
      console.log('Expected:', testProject.project_id);
      console.log('Actual:', globalConfig.activeProject);
      return false;
    }

    console.log('✅ Global config updated correctly');

    console.log('\n5️⃣ Testing memory sync...');
    
    if (!result.forest_memory_sync) {
      console.log('❌ FAILED: Memory sync data not returned');
      return false;
    }

    if (result.forest_memory_sync.project_id !== testProject.project_id) {
      console.log('❌ FAILED: Memory sync project ID mismatch');
      return false;
    }

    console.log('✅ Memory sync completed successfully');

    console.log('\n6️⃣ Testing knowledge level calculation...');
    
    if (!result.project_created || typeof result.project_created.knowledge_level !== 'number') {
      console.log('❌ FAILED: Knowledge level not calculated');
      return false;
    }

    const knowledgeLevel = result.project_created.knowledge_level;
    if (knowledgeLevel < 1 || knowledgeLevel > 10) {
      console.log('❌ FAILED: Knowledge level out of range');
      console.log('Knowledge level:', knowledgeLevel);
      return false;
    }

    console.log('✅ Knowledge level calculated correctly:', knowledgeLevel);

    console.log('\n🎉 PROJECT CREATION TEST PASSED COMPLETELY!');
    console.log('\n📊 Summary:');
    console.log('- ✅ Argument validation works');
    console.log('- ✅ Project creation succeeds');
    console.log('- ✅ Data persistence works');
    console.log('- ✅ Global config updates');
    console.log('- ✅ Memory sync functions');
    console.log('- ✅ Knowledge calculation works');
    
    return true;

  } catch (error) {
    console.error('❌ PROJECT CREATION TEST FAILED:', error.message);
    console.error('Stack trace:', error.stack);
    
    // Detailed error analysis
    if (error.message.includes('ENOENT')) {
      console.log('\n🔧 Issue: File system error - directory or file not found');
      console.log('Check: Data directory permissions and path resolution');
    } else if (error.message.includes('JSON')) {
      console.log('\n🔧 Issue: JSON parsing/serialization error');
      console.log('Check: Data structure integrity');
    } else if (error.message.includes('memory')) {
      console.log('\n🔧 Issue: Memory sync failure');
      console.log('Check: Memory server connection and sync logic');
    }
    
    return false;
  }
}

// Run the test
testProjectCreation().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Test runner failed:', error);
  process.exit(1);
});

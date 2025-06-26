#!/usr/bin/env node

/**
 * Test script for the Cache Cleaner functionality
 * Run this to verify cache clearing works properly
 */

import { CacheCleaner } from './modules/cache-cleaner.js';
import { DataPersistence } from './modules/data-persistence.js';
import { CoreInfrastructure } from './modules/core-infrastructure.js';

async function testCacheCleaner() {
  console.log('=== Cache Cleaner Test ===\n');

  try {
    // Create a minimal server-like object for testing
    const core = new CoreInfrastructure();
    const dataPersistence = new DataPersistence(core.getDataDir());
    
    const mockServer = {
      dataPersistence,
      cacheManager: dataPersistence.cacheManager
    };

    const cacheCleaner = new CacheCleaner(mockServer);

    // Test 1: Get initial cache status
    console.log('1. Getting initial cache status...');
    const initialStatus = await cacheCleaner.getCacheStatus();
    console.log('Initial Status:', JSON.stringify(initialStatus, null, 2));

    // Test 2: Add some cache data
    console.log('\n2. Adding test cache data...');
    await dataPersistence.saveData('test-project', 'test-path', { test: 'data' });
    await dataPersistence.loadData('test-project', 'test-path'); // This should cache it
    
    const statusWithData = await cacheCleaner.getCacheStatus();
    console.log('Status with data:', JSON.stringify(statusWithData, null, 2));

    // Test 3: Clear all caches
    console.log('\n3. Clearing all caches...');
    const clearReport = await cacheCleaner.clearAllCaches({
      clearLogs: false,
      clearTempFiles: true,
      clearMemoryCache: true,
      clearFileSystemCache: true,
      force: true
    });
    
    console.log('Clear Report:', JSON.stringify(clearReport, null, 2));

    // Test 4: Verify caches are cleared
    console.log('\n4. Verifying caches are cleared...');
    const finalStatus = await cacheCleaner.getCacheStatus();
    console.log('Final Status:', JSON.stringify(finalStatus, null, 2));

    // Test 5: Test error handling
    console.log('\n5. Testing error handling...');
    const badCleaner = new CacheCleaner(null); // No server
    const errorReport = await badCleaner.clearAllCaches();
    console.log('Error Report:', JSON.stringify(errorReport, null, 2));

    console.log('\n=== Cache Cleaner Test Complete ===');
    console.log('✅ All tests passed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test if this script is executed directly
if (process.argv[1].endsWith('test-cache-cleaner.js')) {
  testCacheCleaner();
}

export { testCacheCleaner };

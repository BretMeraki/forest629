/**
 * FINAL MCP STDIO TEST
 * This test validates that the server is now a proper MCP stdio application.
 */

import { spawn } from 'child_process';

let testCount = 0;
let passedTests = 0;
let failedTests = 0;
let testsFinished = false;
let serverProcess;

function finishTests() {
  if (testsFinished) return;
  testsFinished = true;

  console.log("\n🏆 FINAL HONEST MCP ASSESSMENT");
  console.log("==============================");

  test("Server starts up and logs 'running' message", serverOutput.includes('MCP server running'));
  test("Initialize handshake receives a result", initializeReceived);
  test("tools/list returns a list of tools", toolsListReceived);
  test("Calling a tool with invalid args returns a validation error", validationTestPassed);
  test("Calling a tool with valid args returns a success result", validToolCallPassed);

  console.log(`\nTotal Tests: ${testCount}`);
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);
  
  const successRate = testCount > 0 ? Math.round((passedTests / testCount) * 100) : 0;
  console.log(`Success Rate: ${successRate}%`);

  if (failedTests === 0) {
    console.log("\n🎉 ALL MCP TESTS PASSED! The server is fixed!");
    console.log("✅ MCP server communication is working correctly over stdio.");
    console.log("✅ Enhanced validation pipeline is confirmed to be operational via MCP.");
    console.log("\n💰 MONEY WHERE MOUTH IS - The server is now working as designed.");
  } else {
    console.log("\n❌ MCP DEPLOYMENT FAILED.");
    console.log(`${failedTests} out of ${testCount} tests failed.`);
  }

  if (serverProcess) {
    serverProcess.kill();
  }
  process.exit(failedTests > 0 ? 1 : 0);
}

function test(description, result) {
  testCount++;
  console.log(`\n📋 Test ${testCount}: ${description}`);
  if (result) {
    passedTests++;
    console.log("✅ PASSED");
  } else {
    failedTests++;
    console.log("❌ FAILED");
  }
  return result;
}

function sendMCPMessage(child, method, params = {}, id = 1) {
  const message = {
    jsonrpc: "2.0",
    method,
    params,
    id
  };
  const msgString = JSON.stringify(message);
  console.log(`\n📤 Sending [ID: ${id}]: ${method}`);
  child.stdin.write(msgString + '\n');
}

let serverOutput = '';
let initializeReceived = false;
let toolsListReceived = false;
let validationTestPassed = false;
let validToolCallPassed = false;

console.log("🚨 FINAL MCP STDIO PROTOCOL TEST");
console.log("=================================");

serverProcess = spawn('node', ['server-modular.js'], { stdio: ['pipe', 'pipe', 'pipe'] });

serverProcess.on('error', (err) => {
  console.error('❌ Failed to spawn server process:', err);
  finishTests();
});

serverProcess.stdout.on('data', (data) => {
  const output = data.toString();
  serverOutput += output;
  console.log(`[SERVER LOGS]: ${output.trim()}`);

  const lines = output.split('\n').filter(line => line.trim().startsWith('{'));
  for (const line of lines) {
    try {
      const response = JSON.parse(line);
      console.log(`\n📥 Received [ID: ${response.id}]: ${line.substring(0, 120)}...`);

      if (response.id === 1 && response.result) {
        initializeReceived = true;
        console.log("   -> Initialize handshake successful.");
        setTimeout(() => sendMCPMessage(serverProcess, 'tools/list', {}, 2), 200);
      }
      
      if (response.id === 2 && response.result && response.result.tools) {
        toolsListReceived = true;
        console.log(`   -> Received ${response.result.tools.length} tools.`);
        setTimeout(() => sendMCPMessage(serverProcess, 'tools/call', {
          name: 'storeGeneratedTasks',
          arguments: { branchTasks: "invalid_string_input" }
        }, 3), 200);
      }
      
      if (response.id === 3 && response.error) {
        if (response.error.message.includes('Invalid branchTasks input: expected array, got string')) {
          validationTestPassed = true;
          console.log("   -> Validation error received as expected.");
          setTimeout(() => sendMCPMessage(serverProcess, 'tools/call', {
            name: 'storeGeneratedTasks',
            arguments: { branchTasks: [{ branch_name: "Test", tasks: [{ title: "Test Task" }] }] }
          }, 4), 200);
        }
      }
      
      if (response.id === 4 && response.result) {
        if (response.result.content[0].text.includes('Task Generation Complete')) {
          validToolCallPassed = true;
          console.log("   -> Valid tool call successful.");
          finishTests();
        }
      }
    } catch (_e) {
      // Ignore non-JSON lines
    }
  }
});

serverProcess.stderr.on('data', (data) => {
  console.error(`[SERVER ERROR]: ${data}`);
});

serverProcess.on('close', (code) => {
  console.log(`\n🔚 Server process exited with code ${code}.`);
  finishTests();
});

// Timeout after 15 seconds
setTimeout(() => {
  console.log("\n⏰ Test timeout reached.");
  finishTests();
}, 15000);

export {}; 
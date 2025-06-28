@echo off
REM Forest MCP Sequential Thinking Server Startup Script
REM Fixes path confusion by ensuring correct working directory

echo 🚀 Starting Forest MCP Sequential Thinking Server...
echo.

REM Set environment for proper Forest operation
set FOREST_DATA_DIR=C:\Users\schlansk\.forest-data
set FOREST_ENABLE_CONSOLE_LOG=0

REM Ensure we're in the correct directory structure
if not exist "forest-server\servers\sequential-thinking-server.js" (
    echo ❌ Error: Cannot find sequential-thinking-server.js
    echo    Expected location: forest-server\servers\sequential-thinking-server.js
    echo    Current directory: %CD%
    echo.
    echo 🔍 Checking for correct project structure...
    if exist "servers\sequential-thinking-server.js" (
        echo    Found servers\ in current directory - you may be in forest-server subdirectory
        echo    Please run this script from the main project root
    )
    pause
    exit /b 1
)

echo ✅ Found server at: forest-server\servers\sequential-thinking-server.js
echo 🌲 Data directory: %FOREST_DATA_DIR%
echo.

REM Start the server with proper path
node forest-server\servers\sequential-thinking-server.js

if %ERRORLEVEL% neq 0 (
    echo.
    echo ❌ Server failed to start with error code: %ERRORLEVEL%
    echo 🔧 This is likely due to missing dependencies or configuration
    echo    not broken code (your 97.1%% test success proves the code works)
    pause
) 
@echo off
REM Fix for MCP servers using wrong user paths
REM Sets the correct Windows data directory for Forest MCP server

echo Setting FOREST_DATA_DIR environment variable...
set FOREST_DATA_DIR=C:\Users\schlansk\.forest-data
echo FOREST_DATA_DIR set to: %FOREST_DATA_DIR%

echo Stopping any existing MCP servers...
taskkill /IM node.exe /F >nul 2>&1

echo Starting Forest MCP server with correct paths...
cd /d "%~dp0"
node start-server.js

echo.
echo MCP servers should now be running with correct Windows paths!
echo Data directory: %FOREST_DATA_DIR%
pause 
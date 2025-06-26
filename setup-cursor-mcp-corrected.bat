@echo off
echo ===============================================
echo Setting up Cursor MCP Configuration (Corrected)
echo ===============================================

echo.
echo 1. Setting environment variable...
set FOREST_DATA_DIR=C:\Users\schlansk\.forest-data
echo FOREST_DATA_DIR set to: %FOREST_DATA_DIR%

echo.
echo 2. Stopping existing MCP servers...
taskkill /IM node.exe /F >nul 2>&1

echo.
echo 3. Creating Cursor configuration directory...
if not exist "%APPDATA%\Cursor\User" mkdir "%APPDATA%\Cursor\User"

echo.
echo 4. Backing up existing Cursor settings...
if exist "%APPDATA%\Cursor\User\settings.json" (
    copy "%APPDATA%\Cursor\User\settings.json" "%APPDATA%\Cursor\User\settings.json.backup" >nul
    echo Backup created: settings.json.backup
)

echo.
echo 5. Updating Cursor settings...
echo {> "%APPDATA%\Cursor\User\settings.json"
echo   "mcp.servers.config": "C:\\Users\\schlansk\\claude-mcp-configs\\cursor-mcp-config-corrected.json">> "%APPDATA%\Cursor\User\settings.json"
echo }>> "%APPDATA%\Cursor\User\settings.json"

echo.
echo 6. Starting MCP servers...
cd /d "%~dp0"
start /B node start-server.js

echo.
echo ===============================================
echo Setup Complete!
echo ===============================================
echo.
echo Your MCP servers:
echo - Forest (includes memory + filesystem + 26+ tools)
echo - Sequential-thinking (advanced reasoning)
echo - Context7 (code documentation)
echo.
echo Next steps:
echo 1. Restart Cursor completely
echo 2. Open a new chat/conversation
echo 3. Try: "What tools do you have access to?"
echo.
echo Configuration: %APPDATA%\Cursor\User\settings.json
echo MCP config: %~dp0cursor-mcp-config-corrected.json
echo.
pause 
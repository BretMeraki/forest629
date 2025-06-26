@echo off
echo ===============================================
echo Testing MCP Server Configuration
echo ===============================================

echo.
echo 1. Checking Node.js processes...
powershell -Command "Get-Process | Where-Object {$_.ProcessName -eq 'node'} | Select-Object Id, ProcessName, StartTime"

echo.
echo 2. Checking MCP server files exist...
if exist "%~dp0start-server.js" (echo ✓ Forest server found) else (echo ✗ Forest server missing)
if exist "%~dp0forest-server\servers\memory-server.js" (echo ✓ Memory server found) else (echo ✗ Memory server missing)
if exist "%~dp0forest-server\servers\filesystem-server.js" (echo ✓ Filesystem server found) else (echo ✗ Filesystem server missing)
if exist "%~dp0forest-server\servers\sequential-thinking-server.js" (echo ✓ Sequential-thinking server found) else (echo ✗ Sequential-thinking server missing)
if exist "%~dp0memory.json" (echo ✓ Memory file found) else (echo ✗ Memory file missing)

echo.
echo 3. Checking data directories...
if exist "C:\Users\schlansk\.forest-data" (echo ✓ Forest data directory exists) else (echo ✗ Forest data directory missing)

echo.
echo 4. Testing Context7 availability...
npx -y @upstash/context7-mcp@latest --help >nul 2>&1
if errorlevel 1 (echo ✗ Context7 not available) else (echo ✓ Context7 available)

echo.
echo 5. Checking Cursor settings...
if exist "%APPDATA%\Cursor\User\settings.json" (
    echo ✓ Cursor settings file exists
    findstr /C:"mcp.servers.config" "%APPDATA%\Cursor\User\settings.json" >nul
    if errorlevel 1 (echo ✗ MCP config not found in settings) else (echo ✓ MCP config found in settings)
) else (
    echo ✗ Cursor settings file missing
)

echo.
echo 6. Checking MCP configuration file...
if exist "%~dp0cursor-mcp-config-final.json" (echo ✓ MCP config file exists) else (echo ✗ MCP config file missing)

echo.
echo ===============================================
echo Test Complete!
echo ===============================================
echo.
echo If all items show ✓, your MCP setup should work.
echo If you see ✗, run setup-cursor-mcp.bat first.
echo.
pause 
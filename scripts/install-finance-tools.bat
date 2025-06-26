@echo off
REM Install Finance Tools for Forest MCP Server
REM This script installs the VoxLink Finance Tools MCP server integration

echo 🚀 Installing Finance Tools for Forest MCP Server...

REM Check if uv is installed
uv --version >nul 2>&1
if %errorlevel% neq 0 (
    echo 📦 Installing uv package manager...
    powershell -Command "irm https://astral.sh/uv/install.ps1 | iex"
    if %errorlevel% neq 0 (
        echo ❌ Failed to install uv
        echo 💡 Please install uv manually from https://docs.astral.sh/uv/
        pause
        exit /b 1
    )
    echo ✅ uv installed successfully
) else (
    echo ✅ uv is already installed
)

REM Install finance-tools-mcp
echo 📊 Installing finance-tools-mcp...
uv tool install finance-tools-mcp

if %errorlevel% equ 0 (
    echo ✅ finance-tools-mcp installed successfully
) else (
    echo ❌ Failed to install finance-tools-mcp
    echo 💡 You can try installing manually with: uvx finance-tools-mcp
    pause
    exit /b 1
)

REM Test the installation
echo 🧪 Testing finance tools installation...
timeout /t 5 >nul
uvx finance-tools-mcp --help >nul 2>&1

if %errorlevel% equ 0 (
    echo ✅ Finance tools are working correctly
) else (
    echo ⚠️  Finance tools may need additional setup
    echo 💡 You can test manually with: uvx finance-tools-mcp
)

echo.
echo 🎉 Finance Tools Installation Complete!
echo.
echo 📋 Available Finance Tools in Forest:
echo    • analyze_stock - Comprehensive stock analysis
echo    • get_technical_analysis - Technical indicators and charts
echo    • get_financial_statements - Income, balance, cash flow statements
echo    • get_market_sentiment - Fear ^& Greed Index
echo    • get_market_news - Latest market and company news
echo    • calculate_finance - Financial calculations
echo    • get_options_analysis - Options data and analysis
echo    • get_economic_data - FRED economic data
echo    • search_economic_data - Search economic indicators
echo.
echo 🔧 Optional: Set FRED API key for enhanced economic data:
echo    set FRED_API_KEY=your_api_key_here
echo.
echo 🚀 Start Forest server and try: analyze_stock with ticker 'AAPL'
echo.
pause

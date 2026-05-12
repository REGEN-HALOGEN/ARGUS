@echo off
TITLE ARGUS - Development Environment
COLOR 0B

:: Ensure Bun is in the current PATH
set "PATH=%USERPROFILE%\.bun\bin;%PATH%"

echo ====================================================
echo                 STARTING ARGUS
echo AI-powered Relationship Graph for Security Threats
echo ====================================================
echo.

:: Check if .env exists
if not exist ".env" (
    echo [WARNING] .env file not found! Copying .env.example to .env
    copy .env.example .env
)

:: Check for Bun
where bun >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Bun is not installed or not in PATH.
    echo Please install Bun to run this project.
    pause
    exit /b 1
)

:: Kill any stale processes on ports 3000 and 4000
echo [0/2] Cleaning up stale processes on ports 3000 and 4000...

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000.*LISTENING" 2^>nul') do (
    echo       Killing PID %%a on port 3000
    taskkill /F /PID %%a >nul 2>nul
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":4000.*LISTENING" 2^>nul') do (
    echo       Killing PID %%a on port 4000
    taskkill /F /PID %%a >nul 2>nul
)

:: Brief pause to let OS release sockets
timeout /t 1 /nobreak >nul

:: Start Docker infrastructure
where docker >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [WARNING] Docker is not installed or not in PATH.
    echo The Neo4j, Qdrant, and Valkey databases will NOT be started.
) else (
    echo [1/2] Starting Docker infrastructure...
    call bun run docker:up
)

echo.
echo [2/2] Starting frontend and backend servers...
echo Frontend: http://localhost:3000
echo Backend:  http://localhost:4000
echo.
echo Press Ctrl+C to stop all servers and free ports.
echo ====================================================
echo.

:: Start both frontend and backend concurrently
call bun run dev

:: Cleanup on exit (runs after Ctrl+C)
echo.
echo ====================================================
echo  Shutting down ARGUS...
echo ====================================================

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000.*LISTENING" 2^>nul') do (
    taskkill /F /PID %%a >nul 2>nul
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":4000.*LISTENING" 2^>nul') do (
    taskkill /F /PID %%a >nul 2>nul
)

taskkill /F /IM "bun.exe" >nul 2>nul
taskkill /F /IM "node.exe" >nul 2>nul

echo  All servers stopped. Ports 3000 and 4000 are free.
echo ====================================================

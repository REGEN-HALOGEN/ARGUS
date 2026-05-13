@echo off
setlocal EnableExtensions
TITLE ARGUS - Development Environment
COLOR 0B

REM Ensure Bun is in the current PATH
set "PATH=%USERPROFILE%\.bun\bin;%PATH%"

echo ====================================================
echo                 STARTING ARGUS
echo AI-powered Relationship Graph for Security Threats
echo ====================================================
echo.

REM Check if .env exists
if not exist ".env" (
    echo [WARNING] .env not found - copying .env.example to .env
    copy /Y .env.example .env
    echo.
    echo Edit .env before first run:
    echo   - DATABASE_URL  (Supabase: Project Settings - Database - connection URI^)
    echo   - NEO4J_URI, QDRANT_URL, VALKEY_URL  (local Docker or hosted URLs^)
    echo.
)

where bun >nul 2>nul
if not errorlevel 1 goto have_bun
echo [ERROR] Bun is not installed or not in PATH.
echo Please install Bun to run this project.
pause
exit /b 1

:have_bun
echo [1/3] Cleaning up stale processes on ports 3000 and 4000...

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000.*LISTENING" 2^>nul') do (
    echo       Killing PID %%a on port 3000
    taskkill /F /PID %%a >nul 2>nul
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":4000.*LISTENING" 2^>nul') do (
    echo       Killing PID %%a on port 4000
    taskkill /F /PID %%a >nul 2>nul
)

timeout /t 1 /nobreak >nul

echo [2/3] Optional local databases (Neo4j, Qdrant, Valkey^)...
where docker >nul 2>nul
if not errorlevel 1 goto have_docker
echo       Docker not in PATH - skipped. Set NEO4J_URI, QDRANT_URL, VALKEY_URL in .env.
goto after_docker

:have_docker
echo       Starting Docker stack: bun run infra:docker:up
call bun run infra:docker:up

:after_docker
echo.
echo [3/3] Starting frontend and backend (bun run dev^)...
echo   Frontend: http://localhost:3000
echo   API:      http://localhost:4000
echo   Auth DB:  set DATABASE_URL in .env (Supabase or PostgreSQL^)
echo.
echo Press Ctrl+C to stop all servers and free ports.
echo ====================================================
echo.

call bun run dev

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

echo  Servers stopped. Ports 3000 and 4000 should be free.
echo  Optional: bun run infra:docker:down  (stops local Docker stack^)
echo ====================================================
endlocal

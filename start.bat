@echo off
echo ========================================================
echo   ModelRouter (A-01) - Starting Backend and Frontend
echo ========================================================

echo Starting FastAPI Backend on port 8000...
start "ModelRouter Backend" cmd /k "cd /d %~dp0backend && python -m uvicorn app.main:app --reload --port 8000"

echo Starting Vite Frontend on port 5173...
start "ModelRouter Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo Both servers have been launched in separate windows!
echo Backend API: http://localhost:8000 (Docs: http://localhost:8000/docs)
echo Frontend UI:  http://localhost:5173
echo ========================================================
pause

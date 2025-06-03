@echo off
echo Starting Pool Automation Server...
echo ========================================
echo.
echo The server will be accessible at:
echo   - http://localhost:5000
echo   - http://127.0.0.1:5000
echo.
echo Login credentials:
echo   Email: admin@pool-automation.local
echo   Password: admin123
echo.
echo ========================================
echo.

cd /d "C:\Users\User\pool-automation"
venv\Scripts\python.exe wsgi.py

pause
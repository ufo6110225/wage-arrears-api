@echo off
cd /d "%~dp0"
call venv\Scripts\activate
echo 正在启动宝安区欠薪预警API...
echo.
start http://localhost:8000/static/index.html
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload

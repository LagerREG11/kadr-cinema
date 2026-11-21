@echo off
cd /d "%~dp0"
if not exist .venv\Scripts\python.exe (
  python -m venv .venv
  .venv\Scripts\python.exe -m pip install -r requirements.txt
)
start "" http://127.0.0.1:5173
.venv\Scripts\python.exe server.py

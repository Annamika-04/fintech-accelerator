# start_backend.ps1
# Run from project root: .\start_backend.ps1

Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
& ".\venv\Scripts\Activate.ps1"
.\venv\Scripts\uvicorn.exe app.main:app --host 0.0.0.0 --port 8000 --reload

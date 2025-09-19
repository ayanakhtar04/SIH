import os
from app import app

if __name__ == "__main__":
    # Fallback runner: use waitress if available, else Flask built-in
    host = os.getenv("HOST", "127.0.0.1")
    try:
        port = int(os.getenv("PORT", "5055"))
    except Exception:
        port = 5055
    try:
        from waitress import serve
        serve(app, host=host, port=port)
    except Exception:
        app.run(host=host, port=port, debug=False)

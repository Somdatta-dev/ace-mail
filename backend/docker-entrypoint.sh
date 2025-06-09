#!/bin/sh

echo "Starting application..."
echo "Current directory: $(pwd)"
echo "Files in current directory:"
ls -la

echo "Python path:"
echo $PYTHONPATH

echo "Environment variables:"
env | grep -E "(FLASK|DATABASE|FERNET|JWT)" || echo "No Flask/DB related env vars found"

echo "Testing Python import..."
python -c "
try:
    import app
    print('SUCCESS: app.py imported successfully')
except Exception as e:
    print(f'ERROR: Failed to import app.py: {e}')
    import traceback
    traceback.print_exc()
"

echo "Starting Flask application..."
# Execute the command passed as arguments to this script (e.g., flask run or gunicorn)
exec "$@"
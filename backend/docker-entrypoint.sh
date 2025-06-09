#!/bin/sh

# Exit immediately if a command exits with a non-zero status.
set -e

echo "Attempting to apply database migrations..."
# Temporarily disable strict error checking for migrations
set +e
flask db upgrade
migration_result=$?
set -e

if [ $migration_result -eq 0 ]; then
    echo "Database migrations applied successfully."
else
    echo "Database migrations failed or not needed. Application will continue starting..."
fi

echo "Starting application..."
# Execute the command passed as arguments to this script (e.g., flask run or gunicorn)
exec "$@"
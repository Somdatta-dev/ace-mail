#!/bin/sh

# Exit immediately if a command exits with a non-zero status.
set -e

# Optional: Wait for the database to be ready
# This is a simple loop. For production, a more robust solution like wait-for-it.sh might be used.
# The DATABASE_URL is expected to be set as an environment variable.
# Example: postgresql://user:password@host:port/db
# We need to extract host and port.
# This part can be tricky with different URL formats and might need adjustment.
# For now, we'll assume `depends_on` in docker-compose is sufficient for startup order.
#
# if [ -n "$DATABASE_URL" ]; then
#   db_host=$(echo $DATABASE_URL | sed -E 's_.*@([^:]+):.*_\1_')
#   db_port=$(echo $DATABASE_URL | sed -E 's_.*:([0-9]+)/.*_\1_')
#   echo "Waiting for database at $db_host:$db_port..."
#   while ! nc -z $db_host $db_port; do
#     sleep 0.1
#   done
#   echo "Database is up!"
# fi

echo "Applying database migrations..."
flask db upgrade

echo "Starting application..."
# Execute the command passed as arguments to this script (e.g., flask run or gunicorn)
exec "$@"
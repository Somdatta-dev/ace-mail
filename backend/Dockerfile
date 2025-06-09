# Use an official Python runtime as a parent image
FROM python:3.9-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1
ENV FLASK_APP=app.py

# Set the working directory in the container
WORKDIR /app

# Install system dependencies that might be needed by psycopg2 or other libraries
# For slim images, you might need to install gcc and other build essentials
# if a package needs to compile from source.
# RUN apt-get update && apt-get install -y gcc libpq-dev && rm -rf /var/lib/apt/lists/*

# Copy the requirements file into the container at /app
COPY requirements.txt .

# Install any needed packages specified in requirements.txt
# --no-cache-dir is recommended for Docker images to keep them small
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code into the container at /app
COPY . .

# Copy the entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Make port 5000 available to the world outside this container
EXPOSE 5000

# Define the command to run the application
# Using gunicorn for a more production-ready setup, but Flask's dev server can be used too.
# For development, you might override this with `flask run --host=0.0.0.0` in docker-compose.yml
# Ensure gunicorn is in requirements.txt if you use it here.
# For now, let's stick to Flask's built-in server for simplicity in development.
# The actual command can be overridden in docker-compose.yml for different environments.
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["flask", "run", "--host=0.0.0.0", "--port=5000"]
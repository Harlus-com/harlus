# Use Python 3.11 as the base image
FROM python:3.11-slim

# Note: This is the working directory in the container
WORKDIR /app 

# Install build essentials for compiling Python packages
RUN apt-get update && \
    apt-get install -y build-essential && \
    rm -rf /var/lib/apt/lists/*

# Copy requirements from python environment
COPY python/env/requirements.txt .

# Use --no-cache-dir because we'll never be calling pip install again
# i.e. we create the image with "docker build" which will always pull down latest requirements.
# Caching them serves no purpose other than clutter the disk at runtime.
RUN pip install --no-cache-dir -r requirements.txt

COPY server/src ./src
COPY server/main.py .

EXPOSE 8000

CMD ["python", "main.py"] 
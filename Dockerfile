# Use Python 3.11 as the base image
FROM python:3.11-slim

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

COPY python/env/scripts/package.py ./python/env/package.py
COPY ml ./ml
COPY server/src ./src
COPY server/main.py .

WORKDIR /app/python/env
RUN python package.py --link
WORKDIR /app

EXPOSE 8000

ENV APP_DATA_PATH=/data
CMD ["python", "main.py"] 
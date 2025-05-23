# Use Python 3.11 as the base image
FROM python:3.11-slim

WORKDIR /app 

# Install build essentials for compiling Python packages
RUN apt-get update && \
    apt-get install -y build-essential && \
    rm -rf /var/lib/apt/lists/*

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      chromium \
      chromium-driver \
      # font and sandbox helpers for headless Chrome
      fonts-liberation libappindicator3-1 libatk-bridge2.0-0 \
      libatk1.0-0 libcups2 libnspr4 libnss3 libxcomposite1 \
      libxdamage1 libxrandr2 xdg-utils \
    && rm -rf /var/lib/apt/lists/*
ENV CHROME_BIN=/usr/bin/chromium
ENV CHROMEDRIVER_PATH=/usr/bin/chromedriver


# Note, here and below: use --no-cache-dir because we'll never be calling pip install again
# i.e. we create the image with "docker build" which will always pull down latest requirements.
# Caching them serves no purpose other than clutter the disk at runtime.

COPY python/env/docling-requirements.txt .
RUN pip install --no-cache-dir -r docling-requirements.txt

COPY python/env/openbb-requirements.txt .
RUN pip install --no-cache-dir -r openbb-requirements.txt

COPY python/env/core-requirements.txt .
RUN pip install --no-cache-dir -r core-requirements.txt

COPY python/env/scripts/package.py ./python/env/package.py
COPY ml ./ml

WORKDIR /app/python/env
RUN python package.py --link
WORKDIR /app

COPY server/src ./src
COPY server/main.py .
COPY server/.env .

EXPOSE 8000

ENV APP_DATA_PATH=/data
CMD ["python", "main.py"] 
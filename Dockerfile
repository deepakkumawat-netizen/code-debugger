# Code Debugger — Docker image with compilers/runtimes for every language
# the /api/run endpoint can execute. Switching the Render service from the
# python env to this Dockerfile gives us real gcc/g++/javac/rustc/ruby/php
# binaries on the server instead of the AI-simulated output path.

FROM python:3.11-slim

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    NODE_VERSION=20

# System packages: compilers + runtimes for every language we execute,
# plus Node.js so we can build the React frontend in the same image.
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        gcc g++ \
        default-jdk-headless \
        golang \
        rustc \
        ruby \
        php-cli \
        curl ca-certificates gnupg \
 && curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - \
 && apt-get install -y --no-install-recommends nodejs \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Python deps (cached layer — only rebuilds when requirements.txt changes)
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install -r /app/backend/requirements.txt

# Build the React frontend
COPY frontend /app/frontend
WORKDIR /app/frontend
RUN npm install && npm run build

# Backend source
WORKDIR /app
COPY backend /app/backend

EXPOSE 8000
WORKDIR /app/backend
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]

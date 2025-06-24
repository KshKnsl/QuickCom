# Multi-stage build for QuickCom application

# Stage 1: Build the frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci
COPY frontend/ ./
# Set production environment variables for the frontend build
ARG FRONTEND_URL=https://quickcom.onrender.com
ENV VITE_WS_URL=wss://quickcom.onrender.com
# Explicitly set base path for assets
ENV BASE_URL=/
RUN npm run build

# Stage 2: Set up the Node.js backend with Puppeteer
FROM node:20 AS backend

# Install Puppeteer dependencies, Google Chrome and Xvfb for virtual display
RUN apt-get update && apt-get install -y \
    fonts-liberation \
    gconf-service \
    libappindicator1 \
    libasound2 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libfontconfig1 \
    libgbm-dev \
    libgdk-pixbuf2.0-0 \
    libgtk-3-0 \
    libicu-dev \
    libjpeg-dev \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libpng-dev \
    xvfb \
    x11-utils\
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    xdg-utils \
    wget \
    curl \
    gnupg \
    ca-certificates \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Verify Chrome installation
RUN google-chrome-stable --version

# Set up working directory
WORKDIR /app

# Copy backend package.json and install dependencies
COPY backend/package.json backend/package-lock.json* ./
RUN npm ci

# Copy backend files
COPY backend/ ./

# Copy built frontend files to the static directory
COPY --from=frontend-build /app/frontend/dist ./public

# Create directory for Puppeteer cache
RUN mkdir -p /opt/render/.cache/puppeteer

# Set environment variables
ENV NODE_ENV=production
ENV PORT=10000
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV DEBUG="puppeteer:*"

# Expose the port the app runs on
EXPOSE 10000

# Create a startup script to run Xvfb and then start the server
RUN echo '#!/bin/bash\nXvfb :99 -screen 0 1280x1024x24 &\nexport DISPLAY=:99\nexec node server.js' > /app/start.sh && \
    chmod +x /app/start.sh

# Start the server with virtual display
CMD ["/app/start.sh"]

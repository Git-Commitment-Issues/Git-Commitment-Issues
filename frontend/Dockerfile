# syntax=docker/dockerfile:1

# ---- Reading Comprehension Screener : React/Vite frontend ------------------
# Multi-stage build: compile the static bundle with Node, then serve it with a
# tiny Nginx image. VITE_API_BASE_URL is baked in at build time (Vite inlines
# import.meta.env.* into the bundle), so it is passed as a build argument.

# ---- Stage 1: build --------------------------------------------------------
FROM node:22-alpine AS build

WORKDIR /app

# Build-time API base URL. Override with:
#   docker build --build-arg VITE_API_BASE_URL=https://api.example.com .
ARG VITE_API_BASE_URL=http://localhost:8000
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Install dependencies against the lockfile first (cached across source edits).
COPY package.json package-lock.json ./
RUN npm ci

# Build the static assets into /app/dist.
COPY . .
RUN npm run build

# ---- Stage 2: serve --------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

# SPA-aware config (client-side routing falls back to index.html).
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the compiled bundle.
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --quiet --spider http://127.0.0.1:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
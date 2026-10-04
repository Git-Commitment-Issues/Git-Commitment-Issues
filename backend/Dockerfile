# syntax=docker/dockerfile:1

# ---- Reading Comprehension Screener : FastAPI backend ----------------------
# Single-stage slim image. The app connects to an external Supabase Postgres
# and an external AI provider over HTTP, so no database runs in this container.

FROM python:3.12-slim AS runtime

# - PYTHONDONTWRITEBYTECODE: no .pyc files in the image
# - PYTHONUNBUFFERED: stream logs straight to stdout (good for `docker logs`)
# - PIP_NO_CACHE_DIR: smaller image, no pip wheel cache
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Install dependencies first so this layer is cached across code changes.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application package.
COPY app ./app

# Run as a non-root user for safety.
RUN useradd --create-home --uid 10001 appuser \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# Container-level healthcheck hits the unauthenticated /health probe.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0) if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4).status==200 else sys.exit(1)"

# Serve the FastAPI app (app/main.py exposes `app`).
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
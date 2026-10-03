"""FastAPI application entry point.

Constructs the FastAPI app, configures CORS, exposes an unauthenticated
``GET /health`` probe, and registers every feature router (auth, classrooms,
assessments, evaluation, reviews, dashboard) so all endpoints are served and
listed at ``/docs`` (task 14.1).

Design reference: *Components and Interfaces / Entry layer* — ``main.py``
constructs the app, configures CORS (allow the origins from ``CORS_ORIGINS``,
allow the ``X-User-Id`` header), registers feature routers, and exposes
``/health`` for anyone (used by the host to wake a sleeping instance). Docs are
served at ``/docs``.

Covers Requirement 8.6 (unauthenticated ``/health`` success response) and
Requirement 8.7 (cross-origin requests whose origin is in ``CORS_ORIGINS`` are
permitted and the ``X-User-Id`` request header is allowed).
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.features.assessments.router import router as assessments_router
from app.features.auth.router import router as auth_router
from app.features.classrooms.router import router as classrooms_router
from app.features.dashboard.router import router as dashboard_router
from app.features.evaluation.router import router as evaluation_router
from app.features.reviews.router import router as reviews_router

app = FastAPI(
    title="Reading Comprehension Screener API",
    description=(
        "Backend service for scheduling reading assessments, learner taking, "
        "AI-assisted checks, backend-computed scoring/diagnosis, and teacher "
        "overrides."
    ),
    version="0.1.0",
)

# --- CORS (Requirement 8.7) ------------------------------------------------
# Allow the configured frontend origins and the lightweight ``X-User-Id``
# identity header used in place of heavyweight auth in this MVP. The API only
# serves GET/POST/PATCH verbs, so those are the methods exposed cross-origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH"],
    allow_headers=["X-User-Id", "Content-Type", "Authorization", "Accept"],
)


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    """Unauthenticated readiness probe (Requirement 8.6).

    Returns a simple success payload indicating the service is reachable. No
    ``X-User-Id`` or other credentials are required so hosting platforms can
    wake a sleeping instance.
    """
    return {"status": "ok"}


# --- Feature router registration (task 14.1) -------------------------------
# Every feature exposes an ``APIRouter`` as ``router`` from
# ``app.features.<feature>.router``; each is included here so its endpoints are
# served and listed at ``/docs``. The route namespaces are disjoint — there are
# no duplicate ``(method, path)`` pairs across routers. Note in particular that
# the dashboard's per-classroom batch list is deliberately exposed at
# ``GET /classrooms/{classroom_id}/batches`` so it does not collide with the
# assessments router's ``GET /classrooms/{classroom_id}/assessments``.
app.include_router(auth_router)
app.include_router(classrooms_router)
app.include_router(assessments_router)
app.include_router(evaluation_router)
app.include_router(reviews_router)
app.include_router(dashboard_router)

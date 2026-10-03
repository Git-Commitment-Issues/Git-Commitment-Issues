/* =============================================================================
   Frontend runtime configuration.
   -----------------------------------------------------------------------------
   The single place that reads build-time environment variables. Vite exposes
   anything prefixed with `VITE_` on `import.meta.env`. Keeping this in one
   module means components and services never touch `import.meta.env` directly.
   ========================================================================== */

/**
 * Base URL of the FastAPI backend (no trailing slash).
 *
 * Set `VITE_API_BASE_URL` in `frontend/.env` (or the Vercel project settings)
 * to point at the deployed API, e.g. `https://api.example.com`. Falls back to
 * the local dev server so `npm run dev` works out of the box.
 */
export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"
).replace(/\/+$/, "")
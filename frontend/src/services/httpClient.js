/* =============================================================================
   httpClient — thin fetch wrapper for the FastAPI backend.
   -----------------------------------------------------------------------------
   Responsibilities:
   - Prefix every request with the configured API base URL.
   - Attach the lightweight identity header the backend expects: `X-User-Id`
     (the MVP auth model — see backend middleware/dependencies.py). The id is
     read from localStorage under the same key SessionProvider writes, so the
     local session and the HTTP layer stay in sync.
   - Send/parse JSON and normalize non-2xx responses into a thrown ApiError so
     callers (and useAsync) get a consistent failure shape.

   This module holds no domain knowledge; the repository maps endpoints and
   shapes on top of it.
   ========================================================================== */

import { API_BASE_URL } from "@/config/env"

// Must match SessionProvider's USER_ID_KEY so the header reflects who is logged
// in without threading the id through every call site.
const USER_ID_KEY = "anaread-user-id"

/** Error thrown for any non-2xx response, carrying status + parsed body. */
export class ApiError extends Error {
  constructor(status, message, body) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.body = body
  }
}

/** Read the current user id (or null) used for the X-User-Id header. */
export function getStoredUserId() {
  try {
    return localStorage.getItem(USER_ID_KEY)
  } catch {
    return null
  }
}

function buildHeaders(hasBody, explicitUserId) {
  const headers = { Accept: "application/json" }
  if (hasBody) headers["Content-Type"] = "application/json"
  // Allow callers (e.g. login -> fetch /auth/me) to pass an id before it has
  // been persisted; otherwise fall back to the stored session id.
  const userId = explicitUserId ?? getStoredUserId()
  if (userId != null && userId !== "") headers["X-User-Id"] = String(userId)
  return headers
}

async function parseBody(response) {
  // 204/empty bodies are common for PATCH/POST; guard JSON parsing.
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

/**
 * Core request helper.
 *
 * @param {string} path    e.g. "/auth/me" or "/classrooms"
 * @param {object} [opts]
 * @param {string} [opts.method="GET"]
 * @param {any}    [opts.body]           serialized as JSON when present
 * @param {string} [opts.userId]         override the X-User-Id header
 * @param {object} [opts.query]          appended as a query string
 * @returns {Promise<any>} parsed JSON (or null)
 * @throws {ApiError} on any non-2xx response
 */
export async function request(path, opts = {}) {
  const { method = "GET", body, userId, query } = opts

  let url = `${API_BASE_URL}${path}`
  if (query && typeof query === "object") {
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(query)) {
      if (v != null && v !== "") params.append(k, String(v))
    }
    const qs = params.toString()
    if (qs) url += `?${qs}`
  }

  let response
  try {
    response = await fetch(url, {
      method,
      headers: buildHeaders(body !== undefined, userId),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch (networkError) {
    // DNS/CORS/offline: surface a uniform, user-meaningful error.
    throw new ApiError(0, "Network error — could not reach the server.", {
      cause: String(networkError),
    })
  }

  const parsed = await parseBody(response)
  if (!response.ok) {
    const detail =
      (parsed && typeof parsed === "object" && parsed.detail) ||
      (typeof parsed === "string" && parsed) ||
      response.statusText ||
      "Request failed"
    throw new ApiError(response.status, detail, parsed)
  }
  return parsed
}

export const http = {
  get: (path, opts) => request(path, { ...opts, method: "GET" }),
  post: (path, body, opts) => request(path, { ...opts, method: "POST", body }),
  patch: (path, body, opts) =>
    request(path, { ...opts, method: "PATCH", body }),
}
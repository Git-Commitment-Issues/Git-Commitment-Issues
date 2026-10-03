import { useState } from "react"
import { User, Hash } from "lucide-react"
import { Card, Input, Button } from "@/components/ui"
import { Logo } from "@/components/brand/Logo"
import { useSession } from "@/session/useSession"
import { ApiError } from "@/services"
import "./LoginPage.css"

/**
 * LoginPage — minimal sign-in for the MVP identity model. A teacher signs in by
 * name, a learner by Learner Reference Number (LRN). Submitting calls the
 * session login (POST /auth/login) which persists the user id; the backend then
 * authorizes every request via the X-User-Id header.
 *
 * Built entirely from existing UI primitives (Card / Input / Button) and the
 * shared design tokens — it introduces no new visual language.
 */
export function LoginPage() {
  const { login } = useSession()
  const [mode, setMode] = useState("teacher") // "teacher" | "learner"
  const [name, setName] = useState("")
  const [lrn, setLrn] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(event) {
    event.preventDefault()
    setError("")
    setSubmitting(true)
    try {
      const credentials =
        mode === "teacher"
          ? { name: name.trim() }
          : { lrn: lrn.trim() }
      await login(credentials)
      // On success the SessionProvider updates `user`; the app swaps to the
      // portal automatically, so there is nothing more to do here.
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError(
          mode === "teacher"
            ? "No teacher found with that name."
            : "No active learner found with that LRN.",
        )
      } else if (err instanceof ApiError && err.status === 400) {
        setError("Please enter your credentials.")
      } else {
        setError("Couldn’t sign in. Check your connection and try again.")
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login">
      <Card raised className="login__card">
        <div className="login__brand">
          <Logo compact className="login__logo" />
          <h1 className="login__title">
            pahina<span className="login__title-accent">.</span>
          </h1>
          <p className="login__subtitle">
            Reading-comprehension screening for teachers and learners.
          </p>
        </div>

        <div className="login__tabs" role="tablist" aria-label="Sign in as">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "teacher"}
            className={`login__tab ${mode === "teacher" ? "login__tab--active" : ""}`}
            onClick={() => {
              setMode("teacher")
              setError("")
            }}
          >
            Teacher
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "learner"}
            className={`login__tab ${mode === "learner" ? "login__tab--active" : ""}`}
            onClick={() => {
              setMode("learner")
              setError("")
            }}
          >
            Learner
          </button>
        </div>

        <form className="login__form" onSubmit={handleSubmit}>
          {mode === "teacher" ? (
            <Input
              label="Teacher name"
              icon={User}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ms. Reyes"
              autoFocus
              required
            />
          ) : (
            <Input
              label="Learner Reference Number"
              icon={Hash}
              value={lrn}
              onChange={(e) => setLrn(e.target.value)}
              placeholder="12-digit LRN"
              inputMode="numeric"
              autoFocus
              required
            />
          )}

          {error ? (
            <p className="login__error" role="alert">
              {error}
            </p>
          ) : null}

          <Button
            type="submit"
            variant="primary"
            disabled={submitting}
            className="login__submit"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </Card>
    </div>
  )
}
import { LogOut, Shield, User as UserIcon } from "lucide-react"
import { PageHeader } from "@/components/layout"
import { Avatar, Button, Card } from "@/components/ui"
import { useSession } from "@/session/useSession"
import "./ProfilePage.css"

/**
 * ProfilePage — the signed-in user's profile surface.
 *
 * Reached by clicking the avatar in the top bar (which previously signed the
 * user out immediately). Shows the user's identity and houses the sign-out
 * action as a clearly destructive, red button.
 */
export function ProfilePage() {
  const { user, logout } = useSession()

  // Normalize the role label for display ("teacher" -> "Teacher").
  const roleLabel = user?.role
    ? user.role.charAt(0).toUpperCase() + user.role.slice(1)
    : "—"

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Account"
        title="Profile"
        subtitle="Your account details and session."
      />

      <Card>
        <Card.Body>
          <div className="profile__identity">
            <Avatar name={user?.name ?? ""} size="lg" />
            <div className="profile__identity-text">
              <p className="profile__name">{user?.name ?? "Unknown user"}</p>
              <p className="profile__role">
                <Shield className="profile__role-icon" aria-hidden="true" />
                {roleLabel}
              </p>
            </div>
          </div>

          <dl className="profile__facts">
            <div className="profile__fact">
              <dt className="profile__fact-label">
                <UserIcon className="profile__fact-icon" aria-hidden="true" />
                Name
              </dt>
              <dd className="profile__fact-value">{user?.name ?? "—"}</dd>
            </div>
            <div className="profile__fact">
              <dt className="profile__fact-label">
                <Shield className="profile__fact-icon" aria-hidden="true" />
                Role
              </dt>
              <dd className="profile__fact-value">{roleLabel}</dd>
            </div>
          </dl>
        </Card.Body>
      </Card>

      <Card>
        <Card.Header
          title="Sign out"
          subtitle="End your session on this device."
        />
        <Card.Body>
          <Button variant="danger" icon={LogOut} onClick={logout}>
            Sign out
          </Button>
        </Card.Body>
      </Card>
    </div>
  )
}

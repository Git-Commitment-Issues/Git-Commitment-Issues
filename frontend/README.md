# AnaRead — Frontend

AnaRead is an AI-assisted reading-comprehension assessment platform for Grades 7–12 teachers. This repository is the **frontend only** — the teacher-facing web application. It renders dashboards, student reports, and assessment management against mock data today, and is structured to connect to the Python/Supabase backend later.

> Scope: frontend only. No backend, API, or database logic lives here. Backend concepts (API shapes, data models) are referenced for context in `src/data/mockData.js`.

---

## Tech stack

| Concern          | Choice                                    |
| ---------------- | ----------------------------------------- |
| Framework        | React 19 + Vite                           |
| Routing          | React Router v7                           |
| Icons            | [`lucide-react`](https://lucide.dev)      |
| Styling          | Plain CSS with design-token custom properties |
| State (global)   | React Context (theme). Lightweight by design. |
| Fonts            | League Spartan (display), Outfit (headings), Manrope (body) |

Styling uses scoped, component-colocated CSS driven entirely by CSS custom properties. No colors are hardcoded in components — everything flows through the theme tokens, so the whole palette swaps by editing one file.

---

## Getting started

Requires Node.js 18+.

```bash
# install dependencies
npm install

# start the dev server (http://localhost:5173)
npm run dev

# type-free production build
npm run build

# preview the production build locally
npm run preview

# lint
npm run lint
```

---

## Project structure

Organized by **domain and responsibility**, not by file type.

```
src/
├── App.jsx                 # Route definitions (lazy-loaded pages) + skip link
├── main.jsx                # Entry: ThemeProvider > BrowserRouter > App
├── index.css               # Imports theme tokens + base styles
│
├── styles/
│   ├── theme.css           # ← ALL design tokens (light + dark). Edit here to re-skin.
│   └── base.css            # Resets, typography defaults, focus, a11y utilities
│
├── theme/
│   ├── ThemeContext.js     # React context
│   ├── ThemeProvider.jsx   # light/dark state, persistence, system preference
│   └── useTheme.js         # hook: const { theme, setTheme, toggleTheme } = useTheme()
│
├── components/
│   ├── ui/                 # Base primitives: Button, Card, Input, Badge,
│   │                       #   ProficiencyBadge, Avatar, IconButton (+ barrel)
│   ├── layout/             # AppLayout, Sidebar, Topbar, ThemeToggle, PageHeader
│   ├── data/               # StatCard, SkillBar (data-display components)
│   └── brand/              # Logo (token-built wordmark)
│
├── pages/                  # One folder-level per route (+ shared pages.css)
│   ├── DashboardPage       # Class overview: summary, per-skill averages, AI insight
│   ├── StudentsPage        # Roster table
│   ├── StudentDetailPage   # Individual report (/students/:studentId)
│   ├── AssessmentsPage     # Assessment cards + create tile
│   ├── SettingsPage        # Account, class, appearance (theme) preferences
│   └── NotFoundPage        # 404 fallback
│
├── config/
│   └── navigation.js       # Sidebar nav items (route + icon + description)
│
├── data/
│   └── mockData.js         # Placeholder content. Replace with API calls.
│
└── lib/
    └── cn.js               # Tiny className joiner
```

The `@` alias maps to `src/` (configured in `vite.config.js`), so imports read as `@/components/ui`, `@/theme/useTheme`, etc.

---

## Design system

### Theming (light + dark)

Both themes are defined as CSS custom properties in [`src/styles/theme.css`](src/styles/theme.css). The active theme is set via a `data-theme="light" | "dark"` attribute on `<html>`.

- **Default:** dark (the brand's primary surface).
- **Resolution order:** saved preference (`localStorage`) → OS `prefers-color-scheme` → dark.
- **No flash:** a tiny inline script in `index.html` applies the saved theme before React mounts.
- **Toggle:** the top bar toggle and the Settings page both use the same `useTheme()` context.

**To re-skin the entire app, edit only `theme.css`.** Components never reference raw hex values.

### Color tokens

The palette is derived from the AnaRead branding template.

| Token (role)              | Dark      | Light     |
| ------------------------- | --------- | --------- |
| `--color-bg`              | `#071719` | `#eef4f4` |
| `--color-surface`         | `#0d2528` | `#ffffff` |
| `--color-surface-raised`  | `#12373a` | `#f4f8f8` |
| `--color-primary`         | `#3bb8d0` | `#1b8aa3` |
| `--color-primary-hover`   | `#4b91d6` | `#2f6fb0` |
| `--color-accent`          | `#7a4fdb` | `#6a3fcf` |
| `--color-success`         | `#4dcc91` | `#1f9d6b` |
| `--color-error`           | `#f07171` | `#d94c4c` |
| `--color-text`            | `#f4faf9` | `#0b2124` |
| `--color-text-secondary`  | `#c3d4d6` | `#3c5559` |
| `--color-text-muted`      | `#829a9e` | `#627579` |
| `--color-border`          | `#285158` | `#d2dedf` |

Each brand color also has a translucent `*-soft` variant (e.g. `--color-primary-soft`) used for badges, chips, and highlight fills so they adapt to any surface.

> Contrast: the light palette is tuned so text and brand roles meet WCAG AA against their surfaces. Full WCAG validation still requires manual testing with assistive technologies and expert review.

### Typography

Headings use **tight (negative) letter-spacing** for a modern editorial feel.

| Role     | Family         | Usage                              | Tracking |
| -------- | -------------- | ---------------------------------- | -------- |
| Display  | League Spartan | `<h1>`, big stat values, logo      | `-0.04em` |
| Heading  | Outfit         | `<h2>`–`<h4>`, labels, buttons     | `-0.02em` |
| Body     | Manrope        | paragraphs, UI text                | `0`       |

Type scale tokens: `--text-xs` … `--text-4xl`. Line-height tokens: `--leading-tight/snug/normal`.

### Spacing, radius, motion

- Spacing: `--space-1` (0.25rem) … `--space-10` (4rem).
- Radius: `--radius-sm/md/lg/xl/pill`.
- Motion: `--ease-out` with `--dur-fast/base/slow`. All transitions respect `prefers-reduced-motion`.

### Base components

Import from the barrel: `import { Button, Card, Input, Badge, Avatar } from '@/components/ui'`.

| Component          | Key props                                                        |
| ------------------ | ---------------------------------------------------------------- |
| `Button`           | `variant` (primary/accent/outline/ghost/danger), `size`, `icon`, `iconRight`, `fullWidth` |
| `IconButton`       | `icon`, `label` (required, becomes `aria-label`), `badge`        |
| `Card`             | `padded`, `raised`, `interactive`; sub-parts `Card.Header`, `Card.Body` |
| `Input`            | `label`, `icon`, `hint`, `error` (wires `aria-describedby`/`aria-invalid`) |
| `Badge`            | `tone` (neutral/primary/accent/success/error), `icon`, `dot`     |
| `ProficiencyBadge` | `level` (`proficient` / `developing` / `needs-practice`) — domain primitive |
| `Avatar`           | `name` (→ initials + label), `src`, `size` (sm/md/lg)            |

Icons are always passed as `lucide-react` components (e.g. `icon={Search}`). Components never hand-write SVG markup.

---

## Accessibility

- Semantic landmarks (`<aside aria-label>`, `<nav>`, `<header>`, `<main>`) and a **skip-to-content** link.
- Visible, token-driven focus rings on all interactive elements (`:focus-visible`).
- Icon-only controls carry `aria-label`; the search field and progress meters are labeled.
- Full keyboard support: the mobile nav drawer closes on `Escape`; the theme control is a labeled `radiogroup`.
- `prefers-reduced-motion` disables non-essential transitions.

---

## Connecting the backend (later)

`src/data/mockData.js` is the single seam between the UI and sample content. When the Python/Supabase backend is ready:

1. Replace the exports in `mockData.js` with API-backed data fetching.
2. Keep the same shapes (`STUDENTS`, `ASSESSMENTS`, per-skill scores) so pages need no changes.
3. Add an auth layer in front of `AppLayout` and swap the placeholder `CURRENT_USER`.

---

## Conventions

- One component per file; co-locate its `.css` beside it.
- Barrel files (`index.js`) per folder for clean imports.
- Class names follow a loose BEM style (`block__element--modifier`).
- Keep global state minimal — reach for context only for truly cross-cutting concerns (theme).

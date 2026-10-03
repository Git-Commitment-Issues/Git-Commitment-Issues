import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import { ThemeProvider } from "@/theme/ThemeProvider"
import { AppBackground } from "@/components/brand/AppBackground"
import { SessionProvider } from "@/session/SessionProvider"
import App from "./App.jsx"
import "./index.css"

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ThemeProvider>
      {/* Decorative WebGL backdrop from the new design. */}
      <AppBackground />
      {/* Session provides the signed-in user + login/logout to the whole app. */}
      <SessionProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </SessionProvider>
    </ThemeProvider>
  </StrictMode>,
)
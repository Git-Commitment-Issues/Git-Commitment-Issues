import Grainient from './Grainient'
import ShapeGrid from './ShapeGrid'
import { useTheme } from '@/theme/useTheme'
import './AppBackground.css'

/**
 * AppBackground — a fixed, full-viewport decorative layer behind the app.
 *
 *   - Dark theme: the animated Grainient gradient.
 *   - Light theme: the ShapeGrid canvas (animated square grid with hover fill).
 *
 * Purely decorative, so it's hidden from assistive tech. Both components
 * already pause when the tab is hidden or scrolled offscreen.
 */
const DARK_PALETTE = { color1: '#000000', color2: '#334f69', color3: '#2a5e74' }

export function AppBackground() {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  return (
    <div className={`app-bg ${isLight ? 'app-bg--grid' : ''}`} aria-hidden="true">
      {isLight ? (
        <ShapeGrid
          key="light-grid"
          speed={prefersReducedMotion ? 0 : 0.21}
          squareSize={40}
          direction="diagonal"
          borderColor="#dfe3ee"
          hoverFillColor="#def8ff"
          shape="square"
          hoverTrailAmount={0}
        />
      ) : (
        <Grainient
          key="dark-gradient"
          color1={DARK_PALETTE.color1}
          color2={DARK_PALETTE.color2}
          color3={DARK_PALETTE.color3}
          lightMode={false}
          timeSpeed={prefersReducedMotion ? 0 : 0.25}
          colorBalance={0}
          warpStrength={1}
          warpFrequency={5}
          warpSpeed={2}
          warpAmplitude={50}
          blendAngle={0}
          blendSoftness={0.41}
          rotationAmount={500}
          noiseScale={2}
          grainAmount={0}
          grainScale={0.2}
          grainAnimated={false}
          contrast={1.5}
          gamma={1}
          saturation={1}
          centerX={0}
          centerY={0}
          zoom={1.1}
        />
      )}
    </div>
  )
}

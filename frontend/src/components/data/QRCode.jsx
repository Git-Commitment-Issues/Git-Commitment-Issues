import { useEffect, useRef } from 'react'
import QRCodeLib from 'qrcode'

/**
 * QRCode — renders `value` as a QR code on a canvas. Colors follow the active
 * theme (via CSS custom properties) so it reads well in light and dark.
 *
 * Props:
 *   value: string to encode
 *   size:  pixel size (default 220)
 */
export function QRCode({ value, size = 220 }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!canvasRef.current || !value) return
    const styles = getComputedStyle(document.documentElement)
    const dark = styles.getPropertyValue('--color-text').trim() || '#000000'
    const light = styles.getPropertyValue('--color-surface').trim() || '#ffffff'
    QRCodeLib.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 1,
      color: { dark, light },
    })
  }, [value, size])

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      role="img"
      aria-label={`QR code for ${value}`}
      style={{ borderRadius: 'var(--radius-md)' }}
    />
  )
}

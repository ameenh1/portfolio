import * as THREE from 'three'

export function createToyMatcapTexture(size = 512): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    return texture
  }

  const base = ctx.createRadialGradient(
    size * 0.36,
    size * 0.28,
    size * 0.05,
    size * 0.5,
    size * 0.52,
    size * 0.72,
  )
  base.addColorStop(0, '#f7ece3')
  base.addColorStop(0.22, '#d7c1b3')
  base.addColorStop(0.58, '#a88f80')
  base.addColorStop(0.82, '#6c5b52')
  base.addColorStop(1, '#2f2724')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, size, size)

  const rim = ctx.createRadialGradient(
    size * 0.66,
    size * 0.72,
    size * 0.02,
    size * 0.5,
    size * 0.5,
    size * 0.82,
  )
  rim.addColorStop(0, 'rgba(255, 220, 190, 0.18)')
  rim.addColorStop(1, 'rgba(30, 20, 20, 0.0)')
  ctx.fillStyle = rim
  ctx.fillRect(0, 0, size, size)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

export function createSoftShadowTexture(size = 256): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return new THREE.CanvasTexture(canvas)
  }

  const g = ctx.createRadialGradient(
    size * 0.5,
    size * 0.5,
    size * 0.08,
    size * 0.5,
    size * 0.5,
    size * 0.48,
  )
  g.addColorStop(0, 'rgba(0, 0, 0, 0.55)')
  g.addColorStop(0.45, 'rgba(0, 0, 0, 0.24)')
  g.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

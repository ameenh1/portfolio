import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { createToyMatcapTexture } from '../utils/toyTextures'
import { onTerrainSurfaceChange, registerTerrainSurface, sampleTerrainSurface } from '../utils/terrainSnap'

/* ─────────────── NOISE ─────────────── */
function hash(x: number, y: number, z: number): number {
  let h = x * 374761393 + y * 668265263 + z * 1274126177
  h = ((h ^ (h >> 13)) * 1274126177) | 0
  return (h & 0x7fffffff) / 0x7fffffff
}
function smoothNoise(x: number, y: number, z: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z)
  const fx = x - ix, fy = y - iy, fz = z - iz
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz)
  const a = hash(ix, iy, iz), b = hash(ix + 1, iy, iz)
  const c = hash(ix, iy + 1, iz), d = hash(ix + 1, iy + 1, iz)
  const e = hash(ix, iy, iz + 1), f = hash(ix + 1, iy, iz + 1)
  const g = hash(ix, iy + 1, iz + 1), hh = hash(ix + 1, iy + 1, iz + 1)
  return (a + (b - a) * ux) * (1 - uy) * (1 - uz) + (c + (d - c) * ux) * uy * (1 - uz)
    + (e + (f - e) * ux) * (1 - uy) * uz + (g + (hh - g) * ux) * uy * uz
}
function fbm(x: number, y: number, z: number, oct = 4): number {
  let v = 0, a = 1, fr = 1, t = 0
  for (let i = 0; i < oct; i++) { v += smoothNoise(x * fr, y * fr, z * fr) * a; t += a; a *= 0.45; fr *= 2.2 }
  return v / t
}

/* ─────────────── TERRAIN CONFIG ─────────────── */
export const TERRAIN_SIZE = 80        // total terrain width/depth
export const TERRAIN_PEAK_HEIGHT = 22 // maximum elevation at center
const MOUNTAIN_BASE_RADIUS = 34
const MOUNTAIN_SEGMENTS_RADIAL = 220
const MOUNTAIN_SEGMENTS_HEIGHT = 140
const MOUNTAIN_SKIRT_DEPTH = 8

export const TOY_MATCAP_URL = 'procedural://toy-matcap'

/**
 * Get the terrain height at any world XZ position.
 * Matches the same displacement used to build the geometry.
 */
export function getTerrainHeight(wx: number, wz: number): number {
  const r = Math.sqrt(wx * wx + wz * wz)
  const falloff = THREE.MathUtils.clamp(1 - r / MOUNTAIN_BASE_RADIUS, 0, 1)
  if (falloff <= 0) return 0

  const cone = Math.pow(falloff, 1.65) * TERRAIN_PEAK_HEIGHT
  const macro = (fbm(wx * 0.08, 0, wz * 0.08, 4) - 0.5) * 3.4 * falloff
  const detail = (fbm(wx * 0.26, 20, wz * 0.26, 3) - 0.5) * 1.2 * falloff
  const ridges = (Math.abs(fbm(wx * 0.13 + 41, 0, wz * 0.13 + 41, 3) - 0.5) - 0.12) * 4.2 * falloff

  return Math.max(0, cone + macro + detail + ridges)
}

function getTerrainNormal(wx: number, wz: number): THREE.Vector3 {
  const e = 0.35
  const hL = getTerrainHeight(wx - e, wz)
  const hR = getTerrainHeight(wx + e, wz)
  const hD = getTerrainHeight(wx, wz - e)
  const hU = getTerrainHeight(wx, wz + e)
  return new THREE.Vector3(hL - hR, 2 * e, hD - hU).normalize()
}

function isWalkableSlope(wx: number, wz: number, minYNormal = 0.5): boolean {
  return getTerrainNormal(wx, wz).y >= minYNormal
}

/**
 * The trail path for the camera & hiker.
 * Switchback trail going up the mountain.
 */
export function generateTrailCurve(): THREE.CatmullRomCurve3 {
  const points: THREE.Vector3[] = []
  const steps = 16
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const angle = t * Math.PI * 2.5 - Math.PI * 0.5
    // Spiral outward at base, inward toward peak
    const radius = 18 * (1 - t * 0.7) + Math.sin(t * Math.PI * 3) * 3
    const x = Math.cos(angle) * radius
    const z = Math.sin(angle) * radius
    const y = getTerrainHeight(x, z) + 0.3 // slightly above ground
    points.push(new THREE.Vector3(x, y, z))
  }
  return new THREE.CatmullRomCurve3(points)
}

/* ─────────────── TERRAIN GEOMETRY ─────────────── */
function createTerrainGeometry(): THREE.BufferGeometry {
  const totalHeight = TERRAIN_PEAK_HEIGHT + MOUNTAIN_SKIRT_DEPTH
  const geo = new THREE.CylinderGeometry(
    2.8,
    MOUNTAIN_BASE_RADIUS,
    totalHeight,
    MOUNTAIN_SEGMENTS_RADIAL,
    MOUNTAIN_SEGMENTS_HEIGHT,
    false,
  )

  const pos = geo.attributes.position
  const cnt = pos.count

  // Rugged displacement for a faceted toy-rock profile
  for (let i = 0; i < cnt; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)

    const angle = Math.atan2(z, x)
    const radius = Math.sqrt(x * x + z * z)
    const level = THREE.MathUtils.clamp((y + totalHeight * 0.5) / totalHeight, 0, 1)

    const surfaceHeight = getTerrainHeight(x, z)
    const noise = fbm(
      Math.cos(angle) * radius * 0.22 + 15,
      level * 5.2,
      Math.sin(angle) * radius * 0.22 - 8,
      4,
    ) - 0.5

    const radialJitter = noise * (1 - level * 0.7) * 2.2
    const nextRadius = Math.max(0.65, radius + radialJitter)

    pos.setX(i, Math.cos(angle) * nextRadius)
    pos.setY(i, THREE.MathUtils.lerp(-MOUNTAIN_SKIRT_DEPTH, surfaceHeight, level) + noise * 0.9)
    pos.setZ(i, Math.sin(angle) * nextRadius)
  }
  pos.needsUpdate = true
  const faceted = geo.toNonIndexed()
  faceted.computeVertexNormals()
  return faceted
}

/* ─────────────── PROP HELPERS ─────────────── */
const TREE_PALETTES = [
  { trunk: '#5c3a1e', leaves: ['#1e5a18', '#268a1e', '#1e7a18'] },
  { trunk: '#7a4a28', leaves: ['#3a8a22', '#4aa830', '#35a025'] },
  { trunk: '#6b4422', leaves: ['#d4a030', '#e8b840', '#c89028'] },
  { trunk: '#5a3820', leaves: ['#d85a5a', '#e86868', '#c84848'] },
  { trunk: '#8a6a48', leaves: ['#8b5a8b', '#9a6a9a', '#7a4a7a'] },
]

function PineTree({ position, scale = 1, variant = 0 }: {
  position: [number, number, number]; scale?: number; variant?: number
}) {
  const c = TREE_PALETTES[variant % TREE_PALETTES.length]
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.06, 0.1, 0.8, 6]} />
        <meshStandardMaterial color={c.trunk} />
      </mesh>
      <mesh position={[0, 1.1, 0]}>
        <coneGeometry args={[0.55, 1.1, 7]} />
        <meshStandardMaterial color={c.leaves[0]} flatShading />
      </mesh>
      <mesh position={[0, 1.7, 0]}>
        <coneGeometry args={[0.42, 0.85, 7]} />
        <meshStandardMaterial color={c.leaves[1]} flatShading />
      </mesh>
      <mesh position={[0, 2.15, 0]}>
        <coneGeometry args={[0.28, 0.6, 7]} />
        <meshStandardMaterial color={c.leaves[2]} flatShading />
      </mesh>
    </group>
  )
}

function RoundTree({ position, scale = 1, variant = 1 }: {
  position: [number, number, number]; scale?: number; variant?: number
}) {
  const c = TREE_PALETTES[variant % TREE_PALETTES.length]
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.06, 0.1, 1.2, 6]} />
        <meshStandardMaterial color={c.trunk} />
      </mesh>
      <mesh position={[0, 1.5, 0]}>
        <icosahedronGeometry args={[0.65, 1]} />
        <meshStandardMaterial color={c.leaves[0]} flatShading />
      </mesh>
      <mesh position={[0.25, 1.7, 0.15]}>
        <icosahedronGeometry args={[0.4, 1]} />
        <meshStandardMaterial color={c.leaves[1]} flatShading />
      </mesh>
    </group>
  )
}

function Bush({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  const c = ['#2d7a22', '#3d8a2e', '#4a9a38'][Math.floor(Math.random() * 3)]
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.18, 0]}>
        <icosahedronGeometry args={[0.28, 1]} />
        <meshStandardMaterial color={c} flatShading />
      </mesh>
      <mesh position={[0.15, 0.14, 0.1]}>
        <icosahedronGeometry args={[0.2, 1]} />
        <meshStandardMaterial color="#3a8528" flatShading />
      </mesh>
    </group>
  )
}

function Rock({ position, scale = 1, rotation }: {
  position: [number, number, number]; scale?: number; rotation?: [number, number, number]
}) {
  return (
    <mesh position={position} scale={scale} rotation={rotation || [0, 0, 0]}>
      <dodecahedronGeometry args={[0.35, 0]} />
      <meshStandardMaterial color="#7a7068" roughness={0.95} flatShading />
    </mesh>
  )
}

function FlowerPatch({ position }: { position: [number, number, number] }) {
  const COLORS = ['#ff6b8a', '#ffaa4c', '#e85eff', '#ffd700', '#55aaff']
  const flowers = useMemo(() =>
    Array.from({ length: 6 }, () => ({
      x: (Math.random() - 0.5) * 0.6, z: (Math.random() - 0.5) * 0.6,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    })), [])
  return (
    <group position={position}>
      {flowers.map((f, i) => (
        <group key={i} position={[f.x, 0.08, f.z]}>
          <mesh><sphereGeometry args={[0.03, 6, 6]} /><meshStandardMaterial color={f.color} emissive={f.color} emissiveIntensity={0.3} /></mesh>
        </group>
      ))}
    </group>
  )
}

function GrassClump({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {Array.from({ length: 4 }).map((_, i) => (
        <mesh key={i} position={[Math.cos(i * 1.57) * 0.05, 0.07, Math.sin(i * 1.57) * 0.05]}
          rotation={[0.05 * Math.cos(i), 0, 0.05 * Math.sin(i)]}>
          <coneGeometry args={[0.018, 0.14, 3]} />
          <meshStandardMaterial color={i % 2 === 0 ? '#4a9a2a' : '#3a7a22'} />
        </mesh>
      ))}
    </group>
  )
}

/* ─────────────── DECORATIVE PROPS ─────────────── */
export function Lantern({ position, color = '#ffaa44' }: { position: [number, number, number]; color?: string }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => { if (ref.current) ref.current.scale.setScalar(1 + Math.sin(clock.getElapsedTime() * 3) * 0.1) })
  return (
    <group position={position}>
      <mesh position={[0, 0.3, 0]}><cylinderGeometry args={[0.03, 0.04, 0.6, 6]} /><meshStandardMaterial color="#5a4a3a" /></mesh>
      <mesh position={[0, 0.65, 0]}><boxGeometry args={[0.12, 0.15, 0.12]} /><meshStandardMaterial color="#3a3028" /></mesh>
      <mesh ref={ref} position={[0, 0.65, 0]}><sphereGeometry args={[0.055, 8, 8]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={4} toneMapped={false} /></mesh>
      <pointLight position={[0, 0.65, 0]} color={color} intensity={2} distance={6} decay={2} />
    </group>
  )
}

export function Crystal({ position, color = '#e85eff', scale = 1 }: {
  position: [number, number, number]; color?: string; scale?: number
}) {
  const ref = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (ref.current) { ref.current.rotation.y = clock.getElapsedTime() * 0.5; ref.current.position.y = position[1] + Math.sin(clock.getElapsedTime() * 1.5) * 0.12 }
  })
  return (
    <group ref={ref} position={position} scale={scale}>
      <mesh><octahedronGeometry args={[0.18, 0]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.5} toneMapped={false} transparent opacity={0.85} flatShading /></mesh>
    </group>
  )
}

export function Campfire({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => { if (ref.current) { const t = clock.getElapsedTime(); ref.current.scale.y = 1 + Math.sin(t * 8) * 0.2; ref.current.scale.x = 1 + Math.sin(t * 6 + 1) * 0.15 } })
  return (
    <group position={position}>
      <mesh rotation={[0, 0.3, Math.PI / 2]} position={[0, 0.05, 0]}><cylinderGeometry args={[0.04, 0.04, 0.4, 6]} /><meshStandardMaterial color="#4a3020" /></mesh>
      <mesh rotation={[0, -0.5, Math.PI / 2]} position={[0, 0.06, 0.02]}><cylinderGeometry args={[0.035, 0.04, 0.35, 6]} /><meshStandardMaterial color="#3d2818" /></mesh>
      {Array.from({ length: 8 }).map((_, i) => { const a = (i / 8) * Math.PI * 2; return <mesh key={i} position={[Math.cos(a) * 0.18, 0.03, Math.sin(a) * 0.18]}><sphereGeometry args={[0.04, 6, 6]} /><meshStandardMaterial color="#666" /></mesh> })}
      <mesh ref={ref} position={[0, 0.2, 0]}><coneGeometry args={[0.09, 0.35, 8]} /><meshStandardMaterial color="#ff6600" emissive="#ff4400" emissiveIntensity={2.5} toneMapped={false} /></mesh>
      <mesh position={[0, 0.22, 0]}><coneGeometry args={[0.04, 0.25, 6]} /><meshStandardMaterial color="#ffcc00" emissive="#ffaa00" emissiveIntensity={3} toneMapped={false} /></mesh>
      <pointLight position={[0, 0.35, 0]} color="#ff8844" intensity={5} distance={10} decay={2} />
    </group>
  )
}

export function Signpost({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.5, 0]}><cylinderGeometry args={[0.03, 0.04, 1, 6]} /><meshStandardMaterial color="#6b5a42" /></mesh>
      <mesh position={[0.28, 0.85, 0]}><boxGeometry args={[0.55, 0.15, 0.03]} /><meshStandardMaterial color="#8b7355" flatShading /></mesh>
    </group>
  )
}

function FenceSegment({ position, rotation = [0, 0, 0] }: { position: [number, number, number]; rotation?: [number, number, number] }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[-0.4, 0.2, 0]}><cylinderGeometry args={[0.025, 0.03, 0.4, 5]} /><meshStandardMaterial color="#7a5a38" /></mesh>
      <mesh position={[0.4, 0.2, 0]}><cylinderGeometry args={[0.025, 0.03, 0.4, 5]} /><meshStandardMaterial color="#7a5a38" /></mesh>
      <mesh position={[0, 0.32, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.015, 0.015, 0.8, 4]} /><meshStandardMaterial color="#8a6a48" /></mesh>
      <mesh position={[0, 0.15, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.015, 0.015, 0.8, 4]} /><meshStandardMaterial color="#8a6a48" /></mesh>
    </group>
  )
}

/* ─────────────── FIREFLIES ─────────────── */
function Fireflies({ count = 50 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null)
  const positions = useMemo(() => {
    const p = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, r = 5 + Math.random() * 20
      p[i * 3] = Math.cos(a) * r; p[i * 3 + 1] = getTerrainHeight(Math.cos(a) * r, Math.sin(a) * r) + 0.5 + Math.random() * 3; p[i * 3 + 2] = Math.sin(a) * r
    }
    return p
  }, [count])
  useFrame(({ clock }) => {
    if (!ref.current) return
    const arr = ref.current.geometry.attributes.position.array as Float32Array; const t = clock.getElapsedTime()
    for (let i = 0; i < count; i++) { arr[i * 3 + 1] += Math.sin(t * 0.5 + i * 1.3) * 0.002; arr[i * 3] += Math.cos(t * 0.3 + i * 0.7) * 0.001 }
    ref.current.geometry.attributes.position.needsUpdate = true
  })
  return (
    <points ref={ref}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
      <pointsMaterial color="#ffdd88" size={0.08} transparent opacity={0.6} sizeAttenuation depthWrite={false} />
    </points>
  )
}

/* ─────────────── HIKER ─────────────── */
export function Hiker() {
  const ll = useRef<THREE.Group>(null), rl = useRef<THREE.Group>(null)
  const la = useRef<THREE.Group>(null), ra = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (ll.current) ll.current.rotation.x = Math.sin(t * 5) * 0.4
    if (rl.current) rl.current.rotation.x = Math.sin(t * 5 + Math.PI) * 0.4
    if (la.current) la.current.rotation.x = Math.sin(t * 5 + Math.PI) * 0.3
    if (ra.current) ra.current.rotation.x = Math.sin(t * 5) * 0.3
    if (body.current) { body.current.position.y = Math.abs(Math.sin(t * 10)) * 0.03; body.current.rotation.z = Math.sin(t * 5) * 0.02 }
  })

  return (
    <group scale={0.8}>
      <group ref={body}>
        <mesh position={[0, 0.62, 0]}><boxGeometry args={[0.35, 0.45, 0.22]} /><meshStandardMaterial color="#c4632a" flatShading /></mesh>
        <mesh position={[0, 0.86, 0]}><boxGeometry args={[0.28, 0.05, 0.18]} /><meshStandardMaterial color="#b8551f" /></mesh>
        <mesh position={[0, 1.02, 0]}><sphereGeometry args={[0.14, 8, 8]} /><meshStandardMaterial color="#f0c896" flatShading /></mesh>
        <mesh position={[-0.05, 1.04, 0.13]}><sphereGeometry args={[0.02, 6, 6]} /><meshStandardMaterial color="#222" /></mesh>
        <mesh position={[0.05, 1.04, 0.13]}><sphereGeometry args={[0.02, 6, 6]} /><meshStandardMaterial color="#222" /></mesh>
        <mesh position={[0, 1.15, 0]}><sphereGeometry args={[0.145, 8, 4, 0, Math.PI * 2, 0, Math.PI * 0.55]} /><meshStandardMaterial color="#2a5a8c" flatShading /></mesh>
        <mesh position={[0, 1.28, 0]}><sphereGeometry args={[0.04, 6, 6]} /><meshStandardMaterial color="#3872a8" /></mesh>
        <mesh position={[0, 0.65, -0.2]}><boxGeometry args={[0.3, 0.38, 0.16]} /><meshStandardMaterial color="#4a6b3a" flatShading /></mesh>
        <mesh position={[0, 0.86, -0.2]}><boxGeometry args={[0.3, 0.06, 0.18]} /><meshStandardMaterial color="#3d5a2e" /></mesh>
      </group>
      <group ref={ll} position={[-0.1, 0.38, 0]}>
        <mesh position={[0, -0.15, 0]}><boxGeometry args={[0.12, 0.3, 0.14]} /><meshStandardMaterial color="#3a3a4c" flatShading /></mesh>
        <mesh position={[0, -0.32, 0.03]}><boxGeometry args={[0.13, 0.08, 0.2]} /><meshStandardMaterial color="#5c3a20" /></mesh>
      </group>
      <group ref={rl} position={[0.1, 0.38, 0]}>
        <mesh position={[0, -0.15, 0]}><boxGeometry args={[0.12, 0.3, 0.14]} /><meshStandardMaterial color="#3a3a4c" flatShading /></mesh>
        <mesh position={[0, -0.32, 0.03]}><boxGeometry args={[0.13, 0.08, 0.2]} /><meshStandardMaterial color="#5c3a20" /></mesh>
      </group>
      <group ref={la} position={[-0.26, 0.78, 0]}>
        <mesh position={[0, -0.15, 0]}><boxGeometry args={[0.1, 0.3, 0.12]} /><meshStandardMaterial color="#c4632a" flatShading /></mesh>
        <mesh position={[0, -0.32, 0]}><sphereGeometry args={[0.05, 6, 6]} /><meshStandardMaterial color="#4a3a28" /></mesh>
      </group>
      <group ref={ra} position={[0.26, 0.78, 0]}>
        <mesh position={[0, -0.15, 0]}><boxGeometry args={[0.1, 0.3, 0.12]} /><meshStandardMaterial color="#c4632a" flatShading /></mesh>
        <mesh position={[0, -0.32, 0]}><sphereGeometry args={[0.05, 6, 6]} /><meshStandardMaterial color="#4a3a28" /></mesh>
        <mesh position={[0.02, -0.5, 0.08]} rotation={[0.2, 0, 0]}><cylinderGeometry args={[0.015, 0.012, 0.9, 6]} /><meshStandardMaterial color="#8a7a6a" metalness={0.3} /></mesh>
      </group>
    </group>
  )
}

/* ─────────────── MAIN TERRAIN COMPONENT ─────────────── */
export default function Mountain() {
  const terrainGeo = useMemo(() => createTerrainGeometry(), [])
  const mountainMatcap = useMemo(() => createToyMatcapTexture(1024), [])
  const terrainRef = useRef<THREE.Mesh>(null)
  const [surfaceVersion, setSurfaceVersion] = useState(0)

  useEffect(() => {
    registerTerrainSurface(terrainRef.current)
    return () => registerTerrainSurface(null)
  }, [])

  useEffect(() => {
    return onTerrainSurfaceChange(() => setSurfaceVersion((v) => v + 1))
  }, [])

  const snapPoint = (x: number, z: number, embed = 0) => {
    const hit = sampleTerrainSurface(x, z)
    if (!hit) return { x, y: getTerrainHeight(x, z) - embed, z }
    return { x: hit.point.x, y: hit.point.y - embed, z: hit.point.z }
  }

  // Place props on the terrain surface
  const trees = useMemo(() => {
    const arr: Array<{ pos: [number, number, number]; scale: number; variant: number; type: 'pine' | 'round' }> = []
    for (let i = 0; i < 220; i++) {
      const a = Math.random() * Math.PI * 2
      const r = 4 + Math.random() * 31
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      const p = snapPoint(x, z, 0.04)
      const y = p.y
      const gentle = isWalkableSlope(x, z, 0.54)
      if (y < TERRAIN_PEAK_HEIGHT * 0.82 && y > 0.4 && gentle) {
        arr.push({
          pos: [p.x, y, p.z],
          scale: 0.35 + Math.random() * 0.9,
          variant: Math.floor(Math.random() * 5),
          type: Math.random() > 0.4 ? 'pine' : 'round',
        })
      }
    }
    return arr
  }, [surfaceVersion])

  const bushes = useMemo(() =>
    Array.from({ length: 110 }, () => {
      const a = Math.random() * Math.PI * 2, r = 6 + Math.random() * 28
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      const p = snapPoint(x, z, 0.03)
      const y = p.y
      return y < TERRAIN_PEAK_HEIGHT * 0.72 && y > 0.3 && isWalkableSlope(x, z, 0.5)
        ? { pos: [p.x, y, p.z] as [number, number, number], scale: 0.4 + Math.random() * 0.8 }
        : null
    }).filter(Boolean) as Array<{ pos: [number, number, number]; scale: number }>, [surfaceVersion])

  const flowers = useMemo(() =>
    Array.from({ length: 42 }, () => {
      const a = Math.random() * Math.PI * 2, r = 5 + Math.random() * 24
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      const p = snapPoint(x, z, 0.01)
      const y = p.y
      return y < TERRAIN_PEAK_HEIGHT * 0.58 && y > 0.5 && isWalkableSlope(x, z, 0.58)
        ? [p.x, y, p.z] as [number, number, number]
        : null
    }).filter(Boolean) as Array<[number, number, number]>, [surfaceVersion])

  const rocks = useMemo(() =>
    Array.from({ length: 180 }, () => {
      const a = Math.random() * Math.PI * 2, r = 3 + Math.random() * 32
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      const p = snapPoint(x, z, 0.05)
      const y = p.y
      return y > 0.3 ? {
        pos: [p.x, y, p.z] as [number, number, number],
        scale: 0.2 + Math.random() * 1.05,
        rot: [Math.random() * 0.5, Math.random() * Math.PI, 0] as [number, number, number],
      } : null
    }).filter(Boolean) as Array<{ pos: [number, number, number]; scale: number; rot: [number, number, number] }>, [surfaceVersion])

  const grass = useMemo(() =>
    Array.from({ length: 180 }, () => {
      const a = Math.random() * Math.PI * 2, r = 5 + Math.random() * 25
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      const p = snapPoint(x, z, 0.02)
      const y = p.y
      return y < TERRAIN_PEAK_HEIGHT * 0.6 && y > 0.3 && isWalkableSlope(x, z, 0.56)
        ? [p.x, y, p.z] as [number, number, number]
        : null
    }).filter(Boolean) as Array<[number, number, number]>, [surfaceVersion])

  const fences = useMemo(() =>
    Array.from({ length: 10 }, (_, i) => {
      const a = (i / 10) * Math.PI * 2
      const r = 16 + Math.random() * 4
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      const p = snapPoint(x, z, 0.02)
      const y = p.y
      return y > 0.5 && y < TERRAIN_PEAK_HEIGHT * 0.3 ? {
        pos: [p.x, y, p.z] as [number, number, number],
        rot: [0, a + Math.PI / 2, 0] as [number, number, number],
      } : null
    }).filter(Boolean) as Array<{ pos: [number, number, number]; rot: [number, number, number] }>, [surfaceVersion])

  return (
    <>
      {/* TERRAIN */}
      <mesh ref={terrainRef} receiveShadow castShadow>
        <primitive object={terrainGeo} attach="geometry" />
        <meshMatcapMaterial matcap={mountainMatcap} color="#8f7f74" flatShading />
      </mesh>

      {/* PROPS — all placed on terrain surface */}
      {trees.map((t, i) => t.type === 'pine'
        ? <PineTree key={`t${i}`} position={t.pos} scale={t.scale} variant={t.variant} />
        : <RoundTree key={`t${i}`} position={t.pos} scale={t.scale} variant={t.variant} />
      )}
      {bushes.map((b, i) => <Bush key={`b${i}`} position={b.pos} scale={b.scale} />)}
      {flowers.map((f, i) => <FlowerPatch key={`f${i}`} position={f} />)}
      {rocks.map((r, i) => <Rock key={`r${i}`} position={r.pos} scale={r.scale} rotation={r.rot} />)}
      {grass.map((g, i) => <GrassClump key={`g${i}`} position={g} />)}
      {fences.map((f, i) => <FenceSegment key={`fn${i}`} position={f.pos} rotation={f.rot} />)}
      <Fireflies count={60} />
    </>
  )
}

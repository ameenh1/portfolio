import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

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
const SEGMENTS = 150                  // resolution

/**
 * Get the terrain height at any world XZ position.
 * Matches the same displacement used to build the geometry.
 */
export function getTerrainHeight(wx: number, wz: number): number {
  const nx = wx / TERRAIN_SIZE, nz = wz / TERRAIN_SIZE
  const distFromCenter = Math.sqrt(nx * nx + nz * nz) * 2
  // Bell curve: peak at center, falls off toward edges
  const bell = Math.exp(-distFromCenter * distFromCenter * 2.5)
  // Multi-octave detail
  const large = fbm(wx * 0.04, 0, wz * 0.04, 3) * 2
  const detail = fbm(wx * 0.12, 0, wz * 0.12, 3) * 0.5
  const ridge = Math.abs(fbm(wx * 0.06 + 50, 0, wz * 0.06 + 50, 2) - 0.5) * 3
  return (bell * TERRAIN_PEAK_HEIGHT + large + detail + ridge * bell) * Math.max(0, 1 - distFromCenter * 0.3)
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
  const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, SEGMENTS, SEGMENTS)
  geo.rotateX(-Math.PI / 2) // Make it horizontal

  const pos = geo.attributes.position
  const cnt = pos.count

  // Displace vertices
  for (let i = 0; i < cnt; i++) {
    const x = pos.getX(i), z = pos.getZ(i)
    pos.setY(i, getTerrainHeight(x, z))
  }
  geo.computeVertexNormals()

  // Color by altitude + slope
  const normals = geo.attributes.normal
  const colors = new Float32Array(cnt * 3)
  for (let i = 0; i < cnt; i++) {
    const y = pos.getY(i)
    const ny = normals.getY(i)
    const hf = Math.min(1, y / TERRAIN_PEAK_HEIGHT)
    const steep = 1 - Math.abs(ny)
    const nv = (fbm(pos.getX(i) * 0.3, y * 0.3, pos.getZ(i) * 0.3, 2) - 0.5) * 0.08
    let r: number, g: number, b: number

    if (hf < 0.08) {
      // Water-edge / flat ground — dark lush green
      r = 0.15 + nv; g = 0.32 + nv; b = 0.1 + nv * 0.5
    } else if (hf < 0.25) {
      // Grassy slopes — vibrant green
      const t = (hf - 0.08) / 0.17
      r = THREE.MathUtils.lerp(0.15, 0.25, t) + steep * 0.05 + nv
      g = THREE.MathUtils.lerp(0.32, 0.45, t) + nv
      b = THREE.MathUtils.lerp(0.1, 0.12, t) + nv * 0.4
    } else if (hf < 0.45) {
      // Forest → earthy transition
      const t = (hf - 0.25) / 0.2
      r = THREE.MathUtils.lerp(0.25, 0.4, t) + steep * 0.06 + nv
      g = THREE.MathUtils.lerp(0.45, 0.35, t) + nv
      b = THREE.MathUtils.lerp(0.12, 0.18, t) + nv * 0.5
    } else if (hf < 0.65) {
      // Rocky brown
      const t = (hf - 0.45) / 0.2
      r = THREE.MathUtils.lerp(0.4, 0.5, t) + steep * 0.08 + nv
      g = THREE.MathUtils.lerp(0.35, 0.38, t) + nv
      b = THREE.MathUtils.lerp(0.18, 0.3, t) + nv
    } else if (hf < 0.82) {
      // Slate with purple tint
      const t = (hf - 0.65) / 0.17
      r = THREE.MathUtils.lerp(0.5, 0.55, t) + nv
      g = THREE.MathUtils.lerp(0.38, 0.42, t) + nv
      b = THREE.MathUtils.lerp(0.3, 0.5, t) + nv
    } else {
      // Snow
      const t = (hf - 0.82) / 0.18
      const snow = Math.max(0, 1 - steep * 2.5)
      r = THREE.MathUtils.lerp(0.55, 0.55 + 0.4 * snow, t) + nv * 0.3
      g = THREE.MathUtils.lerp(0.42, 0.42 + 0.45 * snow, t) + nv * 0.3
      b = THREE.MathUtils.lerp(0.5, 0.5 + 0.48 * snow, t) + nv * 0.3
    }
    colors[i * 3] = Math.max(0, Math.min(1, r))
    colors[i * 3 + 1] = Math.max(0, Math.min(1, g))
    colors[i * 3 + 2] = Math.max(0, Math.min(1, b))
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return geo
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

  // Place props on the terrain surface
  const trees = useMemo(() => {
    const arr: Array<{ pos: [number, number, number]; scale: number; variant: number; type: 'pine' | 'round' }> = []
    for (let i = 0; i < 120; i++) {
      const a = Math.random() * Math.PI * 2
      const r = 5 + Math.random() * 32
      const x = Math.cos(a) * r, z = Math.sin(a) * r
      const y = getTerrainHeight(x, z)
      // Only place trees below treeline
      if (y < TERRAIN_PEAK_HEIGHT * 0.55 && y > 0.5) {
        arr.push({
          pos: [x, y, z],
          scale: 0.4 + Math.random() * 0.8,
          variant: Math.floor(Math.random() * 5),
          type: Math.random() > 0.4 ? 'pine' : 'round',
        })
      }
    }
    return arr
  }, [])

  const bushes = useMemo(() =>
    Array.from({ length: 50 }, () => {
      const a = Math.random() * Math.PI * 2, r = 6 + Math.random() * 28
      const x = Math.cos(a) * r, z = Math.sin(a) * r, y = getTerrainHeight(x, z)
      return y < TERRAIN_PEAK_HEIGHT * 0.45 && y > 0.3
        ? { pos: [x, y, z] as [number, number, number], scale: 0.4 + Math.random() * 0.8 }
        : null
    }).filter(Boolean) as Array<{ pos: [number, number, number]; scale: number }>, [])

  const flowers = useMemo(() =>
    Array.from({ length: 25 }, () => {
      const a = Math.random() * Math.PI * 2, r = 8 + Math.random() * 22
      const x = Math.cos(a) * r, z = Math.sin(a) * r, y = getTerrainHeight(x, z)
      return y < TERRAIN_PEAK_HEIGHT * 0.35 && y > 0.5 ? [x, y, z] as [number, number, number] : null
    }).filter(Boolean) as Array<[number, number, number]>, [])

  const rocks = useMemo(() =>
    Array.from({ length: 60 }, () => {
      const a = Math.random() * Math.PI * 2, r = 3 + Math.random() * 30
      const x = Math.cos(a) * r, z = Math.sin(a) * r, y = getTerrainHeight(x, z)
      return y > 0.3 ? {
        pos: [x, y, z] as [number, number, number],
        scale: 0.3 + Math.random() * 1.2,
        rot: [Math.random() * 0.5, Math.random() * Math.PI, 0] as [number, number, number],
      } : null
    }).filter(Boolean) as Array<{ pos: [number, number, number]; scale: number; rot: [number, number, number] }>, [])

  const grass = useMemo(() =>
    Array.from({ length: 80 }, () => {
      const a = Math.random() * Math.PI * 2, r = 5 + Math.random() * 25
      const x = Math.cos(a) * r, z = Math.sin(a) * r, y = getTerrainHeight(x, z)
      return y < TERRAIN_PEAK_HEIGHT * 0.4 && y > 0.3 ? [x, y, z] as [number, number, number] : null
    }).filter(Boolean) as Array<[number, number, number]>, [])

  const fences = useMemo(() =>
    Array.from({ length: 10 }, (_, i) => {
      const a = (i / 10) * Math.PI * 2
      const r = 16 + Math.random() * 4
      const x = Math.cos(a) * r, z = Math.sin(a) * r, y = getTerrainHeight(x, z)
      return y > 0.5 && y < TERRAIN_PEAK_HEIGHT * 0.3 ? {
        pos: [x, y, z] as [number, number, number],
        rot: [0, a + Math.PI / 2, 0] as [number, number, number],
      } : null
    }).filter(Boolean) as Array<{ pos: [number, number, number]; rot: [number, number, number] }>, [])

  return (
    <>
      {/* TERRAIN */}
      <mesh receiveShadow castShadow>
        <primitive object={terrainGeo} attach="geometry" />
        <meshStandardMaterial vertexColors roughness={0.85} metalness={0.02} flatShading />
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

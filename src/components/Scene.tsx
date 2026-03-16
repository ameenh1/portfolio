import { useEffect, useRef, useMemo, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useScroll, Float, Html, Stars } from '@react-three/drei'
import * as THREE from 'three'
import Mountain, {
  Hiker,
  Campfire,
  Signpost,
  Lantern,
  Crystal,
  generateTrailCurve,
  getTerrainHeight,
} from './Mountain'
import { FiGithub, FiLinkedin, FiMail } from 'react-icons/fi'
import { createSoftShadowTexture, createToyMatcapTexture } from '../utils/toyTextures'
import { onTerrainSurfaceChange, sampleTerrainSurface } from '../utils/terrainSnap'

/* ═══════════════════════════════════════
   DATA
   ═══════════════════════════════════════ */
const skills = [
  { cat: 'Frontend', items: ['React', 'TypeScript', 'Next.js', 'Vite', 'Tailwind'] },
  { cat: 'Backend', items: ['Python', 'Node.js', 'PostgreSQL'] },
  { cat: 'AI & DevOps', items: ['TensorFlow', 'Docker', 'Git'] },
]

const projects = [
  { emoji: '🚀', title: 'Zarnite', desc: 'Full-stack SaaS platform with Stripe integration and real-time telemetry dashboards.', tags: ['React', 'TypeScript', 'Tailwind', 'Stripe'] },
  { emoji: '🧠', title: 'Epilepsy Detection UI', desc: 'AI-powered interface for epilepsy diagnosis through EEG data visualization.', tags: ['React', 'Python', 'TensorFlow'] },
  { emoji: '🌍', title: 'AI Tourism Assistant', desc: 'Accessible tourism platform using AI wearables for real-time navigation.', tags: ['Python', 'React', 'Edge AI'] },
  { emoji: '📊', title: 'Developer Dashboard', desc: 'Real-time analytics dashboard with WebSocket connections.', tags: ['React', 'TypeScript', 'Node.js'] },
]

const hackathons = [
  { name: 'VTHacks 12', year: '2025', project: 'AI Health Monitor', award: '🏆 Winner' },
  { name: 'HackViolet', year: '2025', project: 'AccessPath', award: '🥈 Top 3' },
  { name: 'Capital One', year: '2024', project: 'FinSight', award: '⭐ Sponsor Prize' },
]

/* ═══════════════════════════════════════
   TRAIL — generated from terrain heightmap
   ═══════════════════════════════════════ */
const trailCurve = generateTrailCurve()

/* ═══════════════════════════════════════
   ZONE POSITIONS — on the trail
   ═══════════════════════════════════════ */
const zoneTs = [0.03, 0.2, 0.42, 0.62, 0.95]
const zonePositions = zoneTs.map(t => trailCurve.getPointAt(t))

const zones = [
  { name: 'base',     position: zonePositions[0], scrollRange: [0, 0.16] as [number, number] },
  { name: 'skills',   position: zonePositions[1], scrollRange: [0.16, 0.20] as [number, number] },
  { name: 'projects', position: zonePositions[2], scrollRange: [0.36, 0.20] as [number, number] },
  { name: 'awards',   position: zonePositions[3], scrollRange: [0.56, 0.20] as [number, number] },
  { name: 'summit',   position: zonePositions[4], scrollRange: [0.82, 0.18] as [number, number] },
]

/* ═══════════════════════════════════════
   3RD-PERSON CAMERA — follows hiker from behind and above
   ═══════════════════════════════════════ */
function CameraRig() {
  const scroll = useScroll()
  const currentPos = useMemo(() => new THREE.Vector3(), [])
  const currentLookAt = useMemo(() => new THREE.Vector3(), [])
  const smoothedScroll = useRef(0)
  const tempTangent = useMemo(() => new THREE.Vector3(), [])
  const cameraOffset = useMemo(() => new THREE.Vector3(), [])
  const outward = useMemo(() => new THREE.Vector3(), [])
  const targetCamPos = useMemo(() => new THREE.Vector3(), [])
  const targetLookAt = useMemo(() => new THREE.Vector3(), [])
  const upOffset = useMemo(() => new THREE.Vector3(0, 5, 0), [])
  const lookAtUpOffset = useMemo(() => new THREE.Vector3(0, 1.5, 0), [])
  const tempLookTangent = useMemo(() => new THREE.Vector3(), [])

  useFrame(({ camera }, delta) => {
    smoothedScroll.current = THREE.MathUtils.lerp(
      smoothedScroll.current,
      scroll.offset,
      1 - Math.exp(-delta * 5.5),
    )
    const t = Math.min(smoothedScroll.current, 0.999)

    // Character position on trail — snap Y to mesh surface (matches hiker)
    const charPos = trailCurve.getPointAt(t)
    const charHit = sampleTerrainSurface(charPos.x, charPos.z)
    if (charHit) charPos.y = charHit.point.y + 0.02

    // Trail direction (tangent)
    trailCurve.getTangentAt(t, tempTangent)
    tempTangent.normalize()

    // Camera goes BEHIND the character (opposite tangent) and UP + further out
    cameraOffset.copy(tempTangent).multiplyScalar(-8) // 8 units behind
    cameraOffset.add(upOffset)
    // Also offset outward from mountain center for better view
    outward.set(charPos.x, 0, charPos.z).normalize()
    cameraOffset.add(outward.multiplyScalar(4))

    targetCamPos.copy(charPos).add(cameraOffset)
    tempLookTangent.copy(tempTangent).multiplyScalar(3)
    targetLookAt.copy(charPos).add(tempLookTangent).add(lookAtUpOffset)

    // Smooth follow
    currentPos.lerp(targetCamPos, 1 - Math.exp(-delta * 4))
    currentLookAt.lerp(targetLookAt, 1 - Math.exp(-delta * 6.5))

    camera.position.copy(currentPos)
    camera.lookAt(currentLookAt)
  })

  return null
}

/* ═══════════════════════════════════════
   HIKER ON TRAIL — character follows the trail spline
   ═══════════════════════════════════════ */
function HikerOnTrail() {
  const scroll = useScroll()
  const groupRef = useRef<THREE.Group>(null)
  const tempTangent = useMemo(() => new THREE.Vector3(), [])
  const groundNormal = useMemo(() => new THREE.Vector3(), [])
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  const tiltQuat = useMemo(() => new THREE.Quaternion(), [])
  const lookTarget = useMemo(() => new THREE.Vector3(), [])

  useFrame(() => {
    if (!groupRef.current) return
    const t = Math.min(scroll.offset, 0.999)
    const pos = trailCurve.getPointAt(t)
    trailCurve.getTangentAt(t, tempTangent)

    const hit = sampleTerrainSurface(pos.x, pos.z)
    const y = hit ? hit.point.y : pos.y
    groundNormal.copy(hit ? hit.normal : up)

    groupRef.current.position.set(pos.x, y + 0.02, pos.z)
    // Face the direction of travel
    lookTarget.copy(pos).add(tempTangent)
    lookTarget.y = y
    groupRef.current.lookAt(lookTarget)

    tiltQuat.setFromUnitVectors(up, groundNormal)
    groupRef.current.quaternion.slerp(tiltQuat.multiply(groupRef.current.quaternion), 0.25)
  })

  return (
    <group ref={groupRef}>
      <Hiker />
    </group>
  )
}

/* ═══════════════════════════════════════
   ZONE CONTENT COMPONENTS
   ═══════════════════════════════════════ */
function ZonePanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="zone-panel visible">
      {children}
    </div>
  )
}

function BaseCampContent() {
  return (
    <ZonePanel>
      <h3>Welcome, Traveler 🏕️</h3>
      <div className="zone-subtitle">Base Camp</div>
      <p>
        I'm <strong style={{ color: '#fff' }}>Ameen Harandi</strong> — a CS student at Virginia Tech,
        full-stack developer and AI enthusiast. Scroll up the mountain to discover my work.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
        {['React', 'TypeScript', 'Python', 'AI', 'Full-Stack'].map(t =>
          <span key={t} className="tag">{t}</span>
        )}
      </div>
    </ZonePanel>
  )
}

function SkillsContent() {
  return (
    <ZonePanel>
      <h3>The Workshop 🛠️</h3>
      <div className="zone-subtitle">Skills &amp; Technologies</div>
      {skills.map(g => (
        <div key={g.cat} style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#c4915e', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
            {g.cat}
          </div>
          <div className="skill-grid">
            {g.items.map(s => <div key={s} className="skill-item"><span>{s}</span></div>)}
          </div>
        </div>
      ))}
    </ZonePanel>
  )
}

function ProjectsContent() {
  return (
    <ZonePanel>
      <h3>The Launchpad 🚀</h3>
      <div className="zone-subtitle">Projects</div>
      {projects.map(p => (
        <div key={p.title} style={{ marginBottom: '10px', padding: '10px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '1.1rem' }}>{p.emoji}</span>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>{p.title}</span>
          </div>
          <p style={{ fontSize: '0.7rem', lineHeight: 1.5, color: 'rgba(212,200,187,0.6)', margin: '0 0 6px 0' }}>{p.desc}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
            {p.tags.map(t => <span key={t} className="tag">{t}</span>)}
          </div>
        </div>
      ))}
    </ZonePanel>
  )
}

function AwardsContent() {
  return (
    <ZonePanel>
      <h3>Trophy Ridge 🏆</h3>
      <div className="zone-subtitle">Hackathons &amp; Awards</div>
      {hackathons.map(h => (
        <div key={h.name} className="award-card">
          <div className="award-info">
            <div className="award-name">{h.name} <span style={{ fontSize: '0.6rem', color: '#b8a899' }}>{h.year}</span></div>
            <div className="award-project">{h.project}</div>
          </div>
          <div className="award-badge">{h.award}</div>
        </div>
      ))}
    </ZonePanel>
  )
}

function SummitContent() {
  return (
    <ZonePanel>
      <h3>The Summit 🏔️</h3>
      <div className="zone-subtitle">You made it to the top!</div>
      <p>Let's connect — I'm always open to collaborations, internships, and interesting ideas.</p>
      <a href="https://github.com/ameenh1" target="_blank" rel="noopener noreferrer" className="social-link">
        <FiGithub /> GitHub
      </a>
      <a href="https://www.linkedin.com/in/ameen-harandi-329325240/" target="_blank" rel="noopener noreferrer" className="social-link">
        <FiLinkedin /> LinkedIn
      </a>
      <a href="mailto:ameenh7181@gmail.com" className="social-link">
        <FiMail /> ameenh7181@gmail.com
      </a>
    </ZonePanel>
  )
}

/* ═══════════════════════════════════════
   ZONE OVERLAYS — HTML panels at 3D positions
   ═══════════════════════════════════════ */
function ZoneOverlays() {
  const scroll = useScroll()
  const [visibilities, setVisibilities] = useState<boolean[]>(zones.map(() => false))

  useFrame(() => {
    const t = scroll.offset
    let changed = false
    const next = zones.map((zone, i) => {
      const [start, len] = zone.scrollRange
      const v = t >= start && t < start + len
      if (v !== visibilities[i]) changed = true
      return v
    })
    if (changed) setVisibilities(next)
  })

  const contentMap: Record<string, React.ReactNode> = {
    base: <BaseCampContent />,
    skills: <SkillsContent />,
    projects: <ProjectsContent />,
    awards: <AwardsContent />,
    summit: <SummitContent />,
  }

  return (
    <>
      {zones.map((zone, i) => (
        <group key={zone.name} position={zone.position.toArray()}>
          <Html
            center
            distanceFactor={15}
            style={{ pointerEvents: 'auto' }}
            occlude={false}
          >
            <ZoneVisibility visible={visibilities[i]} content={contentMap[zone.name]} />
          </Html>
        </group>
      ))}
    </>
  )
}

function ZoneVisibility({ visible, content }: {
  visible: boolean
  content: React.ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)

  // This component is now reactive via the 'visible' prop.
  // We keep the internal ref for potential manual DOM tweaks if needed, 
  // but CSS will handle the transition.

  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transition: 'all 0.5s ease',
        pointerEvents: visible ? 'auto' : 'none',
        transform: visible ? 'translateY(0)' : 'translateY(10px)'
      }}
      className="zone-visibility-wrapper"
    >
      {content}
    </div>
  )
}

/* ═══════════════════════════════════════
   ZONE MARKERS — glowing orbs
   ═══════════════════════════════════════ */
function ZoneMarkers() {
  return (
    <>
      {zones.map(zone => (
        <Float key={zone.name} speed={2} rotationIntensity={0} floatIntensity={0.5} floatingRange={[-0.15, 0.15]}>
          <mesh position={[zone.position.x, zone.position.y + 2.5, zone.position.z]}>
            <sphereGeometry args={[0.12, 16, 16]} />
            <meshStandardMaterial color="#c4915e" emissive="#c4915e" emissiveIntensity={2} toneMapped={false} />
          </mesh>
          <mesh position={[zone.position.x, zone.position.y + 2.5, zone.position.z]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.25, 0.32, 32]} />
            <meshBasicMaterial color="#c4915e" transparent opacity={0.12} side={THREE.DoubleSide} />
          </mesh>
        </Float>
      ))}
    </>
  )
}

/* ═══════════════════════════════════════
   TRAIL PATH LINE — visible faint line along the trail
   ═══════════════════════════════════════ */
function TrailPath() {
  const pathMatcap = useMemo(() => createToyMatcapTexture(1024), [])
  const [surfaceVersion, setSurfaceVersion] = useState(0)

  useEffect(() => {
    return onTerrainSurfaceChange(() => setSurfaceVersion((v) => v + 1))
  }, [])

  const ribbonGeometry = useMemo(() => {
    const segments = 460
    const halfWidth = 1.05
    const liftHeight = 0.08 // sit just above the mesh surface
    const vertices: number[] = []
    const uvs: number[] = []
    const indices: number[] = []

    const tangent = new THREE.Vector3()
    const side = new THREE.Vector3()
    const up = new THREE.Vector3(0, 1, 0)

    for (let i = 0; i <= segments; i++) {
      const t = i / segments
      const p = trailCurve.getPointAt(t)
      trailCurve.getTangentAt(t, tangent)
      side.crossVectors(up, tangent).normalize()

      const leftX = p.x + side.x * halfWidth
      const leftZ = p.z + side.z * halfWidth
      const rightX = p.x - side.x * halfWidth
      const rightZ = p.z - side.z * halfWidth

      const leftHit = sampleTerrainSurface(leftX, leftZ)
      const rightHit = sampleTerrainSurface(rightX, rightZ)

      const leftY = (leftHit ? leftHit.point.y : getTerrainHeight(leftX, leftZ)) + liftHeight
      const rightY = (rightHit ? rightHit.point.y : getTerrainHeight(rightX, rightZ)) + liftHeight

      vertices.push(leftX, leftY, leftZ)
      vertices.push(rightX, rightY, rightZ)

      const v = t * 22
      uvs.push(0, v)
      uvs.push(1, v)
    }

    for (let i = 0; i < segments; i++) {
      const a = i * 2
      const b = a + 1
      const c = a + 2
      const d = a + 3
      indices.push(a, b, c)
      indices.push(c, b, d)
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()

    return geometry
  }, [surfaceVersion])

  const lineGeometry = useMemo(() => {
    const pts = trailCurve.getPoints(200).map(p => {
      const hit = sampleTerrainSurface(p.x, p.z)
      if (hit) p.y = hit.point.y + 0.12 // slightly above ribbon surface
      return p
    })
    return new THREE.BufferGeometry().setFromPoints(pts)
  }, [surfaceVersion])

  return (
    <group>
      {/* Visible walkable trail ground */}
      <mesh receiveShadow>
        <primitive object={ribbonGeometry} attach="geometry" />
        <meshMatcapMaterial matcap={pathMatcap} color="#76695e" flatShading polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
      </mesh>
      {/* Trail edge highlight */}
      <line>
        <primitive object={lineGeometry} attach="geometry" />
        <lineBasicMaterial color="#c3b19e" transparent opacity={0.18} />
      </line>
    </group>
  )
}

function SkyDome() {
  const geometry = useMemo(() => new THREE.SphereGeometry(180, 64, 32), [])
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color('#0c1526') },
        bottomColor: { value: new THREE.Color('#1a1f2a') },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vWorldPosition;
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        void main() {
          float h = normalize(vWorldPosition).y * 0.5 + 0.5;
          h = smoothstep(0.05, 0.95, h);
          vec3 color = mix(bottomColor, topColor, h);
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    })
  }, [])

  return <mesh geometry={geometry} material={material} />
}

/* ═══════════════════════════════════════
   TRAIL PROPS — campfire at base, signposts along trail
   ═══════════════════════════════════════ */
const CRYSTAL_COLORS = ['#55aaff', '#e85eff', '#ff6b8a', '#ffd700', '#55ff88']

function TrailProps() {
  const [surfaceVersion, setSurfaceVersion] = useState(0)

  useEffect(() => {
    return onTerrainSurfaceChange(() => setSurfaceVersion((v) => v + 1))
  }, [])

  const snap = (x: number, z: number, embed = 0.03): [number, number, number] => {
    const hit = sampleTerrainSurface(x, z)
    if (!hit) return [x, getTerrainHeight(x, z) - embed, z]
    return [hit.point.x, hit.point.y - embed, hit.point.z]
  }

  const campfirePos = useMemo(() => {
    const p = trailCurve.getPointAt(0.02)
    return snap(p.x + 1.5, p.z, 0.02)
  }, [surfaceVersion])

  const signPositions = useMemo(() => {
    return [0.15, 0.35, 0.55, 0.75].map(t => {
      const p = trailCurve.getPointAt(t)
      return snap(p.x + 0.5, p.z + 0.5, 0.03)
    })
  }, [surfaceVersion])

  const lanternPositions = useMemo(() => {
    return [0.05, 0.12, 0.25, 0.38, 0.5, 0.62, 0.72, 0.85].map(t => {
      const p = trailCurve.getPointAt(t)
      return snap(p.x + 0.8, p.z + 0.8, 0.02)
    })
  }, [surfaceVersion])

  const crystalPositions = useMemo(() => {
    return [0.18, 0.4, 0.6, 0.8, 0.95].map((t, i) => {
      const p = trailCurve.getPointAt(t)
      const [x, y, z] = snap(p.x - 0.5, p.z - 0.5, -1.4)
      return { pos: [x, y, z] as [number, number, number], color: CRYSTAL_COLORS[i] }
    })
  }, [surfaceVersion])

  return (
    <>
      <Campfire position={campfirePos} />
      {signPositions.map((pos, i) => (
        <Signpost key={`s${i}`} position={pos} />
      ))}
      {lanternPositions.map((pos, i) => (
        <Lantern key={`l${i}`} position={pos} color={i % 2 === 0 ? '#ffaa44' : '#ff6688'} />
      ))}
      {crystalPositions.map((c, i) => (
        <Crystal key={`c${i}`} position={c.pos} color={c.color} scale={1.2} />
      ))}
    </>
  )
}

/* ═══════════════════════════════════════
   PROGRESS BAR
   ═══════════════════════════════════════ */
function ProgressBar() {
  const scroll = useScroll()
  const ref = useRef<HTMLDivElement>(null)

  useFrame(() => {
    if (ref.current) ref.current.style.width = `${scroll.offset * 100}%`
  })

  return (
    <Html fullscreen style={{ pointerEvents: 'none' }}>
      <div ref={ref} className="progress-bar" />
    </Html>
  )
}

/* ═══════════════════════════════════════
   SCROLL HINT
   ═══════════════════════════════════════ */
function ScrollHint() {
  const scroll = useScroll()
  const ref = useRef<HTMLDivElement>(null)

  useFrame(() => {
    if (ref.current) ref.current.style.opacity = scroll.offset < 0.05 ? '1' : '0'
  })

  return (
    <Html fullscreen style={{ pointerEvents: 'none' }}>
      <div ref={ref} className="scroll-hint">
        <div className="mouse"><div className="dot" /></div>
        Scroll to explore
      </div>
    </Html>
  )
}

/* ═══════════════════════════════════════
   NAME TITLE — floating at base camp
   ═══════════════════════════════════════ */
function BaseCampTitle() {
  const pos = useMemo(() => {
    const p = trailCurve.getPointAt(0.0)
    return [p.x, p.y + 4, p.z] as [number, number, number]
  }, [])

  return (
    <group position={pos}>
      <Html center distanceFactor={10} style={{ pointerEvents: 'none' }}>
        <div style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
          <div style={{
            fontFamily: 'Outfit, sans-serif',
            fontSize: '3rem',
            fontWeight: 700,
            color: '#fff',
            textShadow: '0 2px 30px rgba(0,0,0,0.5)',
            letterSpacing: '-0.02em',
          }}>
            Ameen Harandi
          </div>
          <div style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: '0.7rem',
            color: '#b8a899',
            letterSpacing: '0.15em',
            textTransform: 'uppercase' as const,
            marginTop: '6px',
          }}>
            CS · Virginia Tech · Full-Stack & AI
          </div>
        </div>
      </Html>
    </group>
  )
}

/* ═══════════════════════════════════════
   SUMMIT FLAG
   ═══════════════════════════════════════ */
function SummitFlag() {
  const pos = useMemo(() => {
    const p = trailCurve.getPointAt(0.99)
    return [p.x, p.y + 0.5, p.z] as [number, number, number]
  }, [])

  return (
    <group position={pos}>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 2, 8]} />
        <meshStandardMaterial color="#d4c8bb" />
      </mesh>
      <Float speed={3} rotationIntensity={0} floatIntensity={0.1}>
        <mesh position={[0.4, 1.2, 0]}>
          <planeGeometry args={[0.8, 0.5]} />
          <meshStandardMaterial color="#c4915e" emissive="#c4915e" emissiveIntensity={0.3} side={THREE.DoubleSide} />
        </mesh>
      </Float>
    </group>
  )
}

/* ═══════════════════════════════════════
   ENVIRONMENT
   ═══════════════════════════════════════ */
function Environment() {
  const softShadow = useMemo(() => createSoftShadowTexture(256), [])

  return (
    <>
      {/* Warm toy-studio lighting stack — 2 directional + hemisphere */}
      <hemisphereLight args={['#f7d0a4', '#5f4f3f', 0.95]} />
      <directionalLight position={[25, 35, 15]} intensity={1.8} color="#ffe0b0" castShadow
        shadow-mapSize-width={1024} shadow-mapSize-height={1024}
        shadow-camera-far={80} shadow-camera-left={-30} shadow-camera-right={30}
        shadow-camera-top={30} shadow-camera-bottom={-30}
      />
      <directionalLight position={[-18, 20, -12]} intensity={1.1} color="#b0c8e4" />
      <Stars radius={120} depth={80} count={1500} factor={4} saturation={0.2} fade speed={0.3} />
      {zones.map((zone, i) => (
        <mesh key={`shadow-${zone.name}-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[zone.position.x, zone.position.y + 0.03, zone.position.z]}>
          <planeGeometry args={[3.1, 3.1]} />
          <meshBasicMaterial map={softShadow} transparent opacity={0.32} depthWrite={false} polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
        </mesh>
      ))}
    </>
  )
}

/* ═══════════════════════════════════════
   SCENE — Main composition
   ═══════════════════════════════════════ */
export default function Scene() {
  return (
    <>
      <CameraRig />
      <SkyDome />
      <Environment />
      <Mountain />
      <TrailPath />
      <TrailProps />
      <HikerOnTrail />
      <ZoneMarkers />
      <BaseCampTitle />
      <SummitFlag />
      <ZoneOverlays />
      <ProgressBar />
      <ScrollHint />
    </>
  )
}

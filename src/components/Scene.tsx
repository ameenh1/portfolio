import { useEffect, useRef, useMemo, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
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
import { createSoftShadowTexture, createToyMatcapTexture } from '../utils/toyTextures'
import { onTerrainSurfaceChange, sampleTerrainSurface } from '../utils/terrainSnap'
import { activeZoneStore } from '../utils/activeZoneStore'

/* ═══════════════════════════════════════
   TRAIL — generated from terrain heightmap
   ═══════════════════════════════════════ */
const trailCurve = generateTrailCurve()

/* ═══════════════════════════════════════
   ZONE & SIGN POSITIONS — on the trail
   ═══════════════════════════════════════ */
const ZONE_TS = [0.03, 0.17, 0.33, 0.50, 0.67, 0.95] as const
const SIGN_TRAIL_TS = [0.06, 0.12, 0.25, 0.40, 0.57, 0.90] as const
const zonePositions = ZONE_TS.map(t => trailCurve.getPointAt(t))

const zones = [
  { name: 'base',        position: zonePositions[0], signT: SIGN_TRAIL_TS[0] },
  { name: 'skills',      position: zonePositions[1], signT: SIGN_TRAIL_TS[1] },
  { name: 'experience',  position: zonePositions[2], signT: SIGN_TRAIL_TS[2] },
  { name: 'projects',    position: zonePositions[3], signT: SIGN_TRAIL_TS[3] },
  { name: 'awards',      position: zonePositions[4], signT: SIGN_TRAIL_TS[4] },
  { name: 'summit',      position: zonePositions[5], signT: SIGN_TRAIL_TS[5] },
]

/* ═══════════════════════════════════════
   3RD-PERSON CAMERA — follows hiker from behind and above
   ═══════════════════════════════════════ */
function CameraRig() {
  const scroll = useScroll()
  const currentPos = useMemo(() => new THREE.Vector3(), [])
  const currentLookAt = useMemo(() => new THREE.Vector3(), [])
  const smoothedScroll = useRef(0)
  const isFirstFrame = useRef(true)
  const tempTangent = useMemo(() => new THREE.Vector3(), [])
  const cameraOffset = useMemo(() => new THREE.Vector3(), [])
    const outward = useMemo(() => new THREE.Vector3(), [])
    const targetCamPos = useMemo(() => new THREE.Vector3(), [])
    const targetLookAt = useMemo(() => new THREE.Vector3(), [])
    const upOffset = useMemo(() => new THREE.Vector3(0, 5, 0), [])
    const lookAtUpOffset = useMemo(() => new THREE.Vector3(0, 0.2, 0), [])
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

    // On first frame, snap camera directly to base position
    if (isFirstFrame.current) {
      currentPos.copy(targetCamPos)
      currentLookAt.copy(targetLookAt)
      isFirstFrame.current = false
    } else {
      // Smooth follow
      currentPos.lerp(targetCamPos, 1 - Math.exp(-delta * 4))
      currentLookAt.lerp(targetLookAt, 1 - Math.exp(-delta * 6.5))
    }

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

/* (Zone content components moved to ZoneCard.tsx) */

/* ═══════════════════════════════════════
   ZONE OVERLAYS — proximity detection + 3D indicators only
   (HTML cards rendered by ZoneCard.tsx outside Canvas)
   ═══════════════════════════════════════ */
function ZoneOverlays() {
  const [surfaceVersion, setSurfaceVersion] = useState(0)
  const { camera } = useThree()
  const scroll = useScroll()
  const activeRingRef = useRef<THREE.Mesh | null>(null)

  useEffect(() => {
    return onTerrainSurfaceChange(() => setSurfaceVersion(v => v + 1))
  }, [])

  const snap = (x: number, z: number, embed = 0.03): [number, number, number] => {
    const hit = sampleTerrainSurface(x, z)
    if (!hit) return [x, getTerrainHeight(x, z) - embed, z]
    return [hit.point.x, hit.point.y - embed, hit.point.z]
  }

  const signPositions = useMemo(() => {
    return SIGN_TRAIL_TS.map(t => {
      const p = trailCurve.getPointAt(t)
      return snap(p.x + 0.5, p.z + 0.5, 0.03)
    })
  }, [surfaceVersion])

  const ACTIVATION_SCROLL_THRESHOLD = 0.07
  const ACTIVATION_RADIUS = 8.0

  const camPos = useMemo(() => new THREE.Vector3(), [])
  const signVector = useMemo(() => new THREE.Vector3(), [])

  useFrame(() => {
    if (!camera) return

    const hikerT = scroll.offset
    let bestZone: string | null = null
    let bestScrollDist = Infinity

    // Primary: scroll-based — activate when hiker is near a sign trail position
    for (let i = 0; i < zones.length; i++) {
      const scrollDist = Math.abs(hikerT - zones[i].signT)
      if (scrollDist < ACTIVATION_SCROLL_THRESHOLD && scrollDist < bestScrollDist) {
        bestScrollDist = scrollDist
        bestZone = zones[i].name
      }
    }

    // Fallback: camera distance — catches jumps / non-scroll navigation
    if (!bestZone) {
      camera.getWorldPosition(camPos)
      let closestDist = Infinity

      for (let i = 0; i < zones.length; i++) {
        const signPos = signPositions[i]
        signVector.set(signPos[0], signPos[1], signPos[2])
        const distance = camPos.distanceTo(signVector)
        if (distance < ACTIVATION_RADIUS && distance < closestDist) {
          closestDist = distance
          bestZone = zones[i].name
        }
      }
    }

    activeZoneStore.set(bestZone)

    // Pulse the active ring indicator
    if (activeRingRef.current) {
      const t = performance.now() * 0.001
      const scale = 1 + Math.sin(t * 3) * 0.15
      activeRingRef.current.scale.set(scale, scale, 1)
      const mat = activeRingRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.15 + Math.sin(t * 4) * 0.08
    }
  })

  // Track which zone index is active for the ring indicator
  const [activeIdx, setActiveIdx] = useState(-1)
  useEffect(() => {
    return activeZoneStore.subscribe(name => {
      setActiveIdx(name ? zones.findIndex(z => z.name === name) : -1)
    })
  }, [])

  return (
    <>
      {zones.map((zone, i) => {
        const signPos = signPositions[i]
        const isActive = i === activeIdx
        return (
          <group key={zone.name} position={signPos}>
            {/* Glowing orb at sign base */}
            <mesh>
              <sphereGeometry args={[0.2, 16, 16]} />
              <meshStandardMaterial
                color="#c4915e"
                emissive="#ffd700"
                emissiveIntensity={isActive ? 3 : 0.3}
                toneMapped={false}
              />
            </mesh>

            {/* Pulsing ring on active sign */}
            {isActive && (
              <mesh
                ref={activeRingRef}
                position={[0, 0.05, 0]}
                rotation={[-Math.PI / 2, 0, 0]}
              >
                <ringGeometry args={[0.4, 0.55, 32]} />
                <meshBasicMaterial
                  color="#ffd700"
                  transparent
                  opacity={0.2}
                  side={THREE.DoubleSide}
                />
              </mesh>
            )}
          </group>
        )
      })}
    </>
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
  const meshRef = useRef<THREE.Mesh>(null)

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uTopColor: { value: new THREE.Color('#1a0a2e') },
        uMidColor: { value: new THREE.Color('#4a1942') },
        uBottomColor: { value: new THREE.Color('#ff6b35') },
        uPulseSpeed: { value: 0.25 },
        uPulseAmount: { value: 0.12 },
        uAuroraColor1: { value: new THREE.Color('#00ffcc') },
        uAuroraColor2: { value: new THREE.Color('#44ff88') },
        uAuroraColor3: { value: new THREE.Color('#aa44ff') },
        uAuroraOpacity: { value: 0 },
        uAuroraSpeed: { value: 0.12 },
        uCloudColor: { value: new THREE.Color('#ffffff') },
        uCloudOpacity: { value: 0.28 },
        uCloudSpeed: { value: 0.04 },
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
        uniform float uTime;
        uniform vec3 uTopColor;
        uniform vec3 uMidColor;
        uniform vec3 uBottomColor;
        uniform float uPulseSpeed;
        uniform float uPulseAmount;
        uniform vec3 uAuroraColor1;
        uniform vec3 uAuroraColor2;
        uniform vec3 uAuroraColor3;
        uniform float uAuroraOpacity;
        uniform float uAuroraSpeed;
        uniform vec3 uCloudColor;
        uniform float uCloudOpacity;
        uniform float uCloudSpeed;
        
        varying vec3 vWorldPosition;
        
        // Simplex 2D noise
        vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
        float snoise(vec2 v) {
          const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
          vec2 i  = floor(v + dot(v, C.yy));
          vec2 x0 = v -   i + dot(i, C.xx);
          vec2 i1;
          i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
          vec4 x12 = x0.xyxy + C.xxzz;
          x12.xy -= i1;
          i = mod(i, 289.0);
          vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
          vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
          m = m*m;
          m = m*m;
          vec3 x = 2.0 * fract(p * C.www) - 1.0;
          vec3 h = abs(x) - 0.5;
          vec3 ox = floor(x + 0.5);
          vec3 a0 = x - ox;
          m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
          vec3 g;
          g.x  = a0.x  * x0.x  + h.x  * x0.y;
          g.yz = a0.yz * x12.xz + h.yz * x12.yw;
          return 130.0 * dot(m, g);
        }
        
        // Aurora band function
        float aurora(vec2 uv, float time) {
          float n = snoise(vec2(uv.x * 2.5 + time * 0.08, uv.y * 1.2));
          n += snoise(vec2(uv.x * 5.0 - time * 0.12, uv.y * 2.0)) * 0.5;
          n += snoise(vec2(uv.x * 8.0 + time * 0.05, uv.y * 0.8)) * 0.25;
          
          float band = smoothstep(0.2, 0.5, n + uv.y * 0.6);
          band *= smoothstep(0.95, 0.6, uv.y);
          return band;
        }
        
        // Smooth cartoon cloud
        float cloudShape(vec2 uv) {
          float c = 0.0;
          c += 1.0 - smoothstep(0.12, 0.18, length(uv - vec2(0.0, 0.0)));
          c += 1.0 - smoothstep(0.1, 0.15, length(uv - vec2(0.15, 0.05)));
          c += 1.0 - smoothstep(0.08, 0.12, length(uv - vec2(-0.12, 0.04)));
          c += 1.0 - smoothstep(0.09, 0.13, length(uv - vec2(0.05, -0.08)));
          c += 1.0 - smoothstep(0.07, 0.11, length(uv - vec2(-0.08, -0.06)));
          return clamp(c * 0.5, 0.0, 1.0);
        }
        
        void main() {
          vec3 dir = normalize(vWorldPosition);
          float h = dir.y * 0.5 + 0.5;
          
          // Layer 1: Twilight gradient with pulse
          float pulse = sin(uTime * uPulseSpeed) * uPulseAmount;
          vec3 gradient = mix(uBottomColor, uMidColor, smoothstep(0.0, 0.35, h));
          gradient = mix(gradient, uTopColor + pulse * 0.3, smoothstep(0.35, 0.95, h));
          
          // Layer 2: Aurora borealis
          vec2 auroraUV = vec2(dir.x * 0.8 + uTime * uAuroraSpeed, dir.z * 0.5 + 0.5);
          float auroraMask = aurora(auroraUV, uTime);
          
          float colorMix = sin(dir.x * 4.0 + uTime * 0.3) * 0.5 + 0.5;
          vec3 auroraCol = mix(uAuroraColor1, uAuroraColor2, colorMix);
          auroraCol = mix(auroraCol, uAuroraColor3, sin(dir.x * 6.0 - uTime * 0.5) * 0.5 + 0.5);
          
          float fresnel = pow(1.0 - abs(dir.y), 2.0) * 0.4;
          gradient = mix(gradient, auroraCol, auroraMask * uAuroraOpacity * (0.7 + fresnel));
          
          // Layer 3: Cartoon clouds (in front, subtle)
          vec2 cloudUV1 = vec2(dir.x * 0.3 + uTime * uCloudSpeed, dir.z * 0.2 + 0.3);
          vec2 cloudUV2 = vec2(dir.x * 0.25 + uTime * uCloudSpeed * 0.8 + 0.5, dir.z * 0.2 - 0.2);
          vec2 cloudUV3 = vec2(dir.x * 0.35 + uTime * uCloudSpeed * 1.2 - 0.3, dir.z * 0.15 + 0.6);
          
          float cloud1 = cloudShape(cloudUV1);
          float cloud2 = cloudShape(cloudUV2);
          float cloud3 = cloudShape(cloudUV3);
          float cloudMask = max(max(cloud1, cloud2), cloud3);
          
          // Tint clouds slightly with aurora color
          vec3 tintedCloud = mix(uCloudColor, auroraCol, 0.25);
          gradient = mix(gradient, tintedCloud, cloudMask * uCloudOpacity);
          
          gl_FragColor = vec4(gradient, 1.0);
        }
      `,
    })
  }, [])

  useFrame(({ clock }) => {
    if (meshRef.current) {
      (meshRef.current.material as THREE.ShaderMaterial).uniforms.uTime.value = clock.getElapsedTime()
    }
  })

  return <mesh ref={meshRef} geometry={geometry} material={material} />
}

/* ═══════════════════════════════════════
   TRAIL PROPS — campfire at base, signposts along trail
   ═══════════════════════════════════════ */
const CRYSTAL_COLORS = ['#55aaff', '#e85eff', '#ff6b8a', '#ffd700', '#55ff88', '#ff8844']

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
    return snap(p.x + 1.5, p.z, 0.25)
  }, [surfaceVersion])

  const signPositions = useMemo(() => {
    return [0.06, 0.12, 0.25, 0.40, 0.57, 0.90].map(t => {
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
      const [x, y, z] = snap(p.x - 0.5, p.z - 0.5, 2.1)
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
    const p = trailCurve.getPointAt(0.05)
    return [p.x, p.y + 3, p.z] as [number, number, number]
  }, [])

  return (
    <group position={pos}>
      <Html center distanceFactor={8} style={{ pointerEvents: 'none' }}>
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
            CS · Virginia Tech · 3.75 GPA · Full-Stack & AI
          </div>
        </div>
      </Html>
    </group>
  )
}

/* ═══════════════════════════════════════
   ENVIRONMENT
   ═══════════════════════════════════════ */

/* ═══════════════════════════════════════
   PLANETS
   ═══════════════════════════════════════ */
interface PlanetProps {
  position: [number, number, number]
  size: number
  color: string
  hasRing?: boolean
  ringColor?: string
  ringInner?: number
  ringOuter?: number
  hasGlow?: boolean
  flatShading?: boolean
  rotationSpeed?: number
  emissiveIntensity?: number
}

function Planet({ 
  position, size, color, hasRing, ringColor = '#c4a882', ringInner = 1.5, ringOuter = 2.2,
  hasGlow, flatShading, rotationSpeed = 0.1, emissiveIntensity = 0 
}: PlanetProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const ringRef = useRef<THREE.Mesh>(null)

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * rotationSpeed
    }
    if (ringRef.current) {
      ringRef.current.rotation.x += delta * rotationSpeed * 0.3
    }
  })

  return (
    <group position={position}>
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[size, flatShading ? 1 : 3]} />
        <meshStandardMaterial 
          color={color} 
          emissive={hasGlow ? color : '#000000'} 
          emissiveIntensity={emissiveIntensity}
          flatShading={flatShading}
        />
      </mesh>
      {hasRing && (
        <mesh ref={ringRef} rotation={[Math.PI / 2.5, 0, 0]}>
          <ringGeometry args={[size * ringInner, size * ringOuter, 32]} />
          <meshStandardMaterial 
            color={ringColor} 
            side={THREE.DoubleSide} 
            transparent 
            opacity={0.7}
          />
        </mesh>
      )}
    </group>
  )
}

/* ═══════════════════════════════════════
   ASTEROID BELTS
   ═══════════════════════════════════════ */
function generateAsteroidMatrices(
  center: [number, number, number],
  radius: number,
  width: number,
  count: number,
  minSize: number,
  maxSize: number
): THREE.Matrix4[] {
  const temp = new THREE.Matrix4()
  const matrices: THREE.Matrix4[] = []

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2
    const r = radius + (Math.random() - 0.5) * width
    const x = center[0] + Math.cos(angle) * r
    const y = center[1] + (Math.random() - 0.5) * 3
    const z = center[2] + Math.sin(angle) * r
    const scale = minSize + Math.random() * (maxSize - minSize)

    temp.makeRotationFromEuler(new THREE.Euler(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI
    ))
    temp.scale(new THREE.Vector3(scale, scale, scale))
    temp.setPosition(x, y, z)
    matrices.push(temp.clone())
  }
  return matrices
}

interface AsteroidBeltProps {
  center: [number, number, number]
  radius: number
  width: number
  count: number
  minSize: number
  maxSize: number
  color: string
}

function AsteroidBelt({ center, radius, width, count, minSize, maxSize, color }: AsteroidBeltProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null)

  const matrices = useMemo(() => 
    generateAsteroidMatrices(center, radius, width, count, minSize, maxSize),
    [center, radius, width, count, minSize, maxSize]
  )

  useEffect(() => {
    if (meshRef.current) {
      matrices.forEach((matrix, i) => {
        meshRef.current!.setMatrixAt(i, matrix)
      })
      meshRef.current.instanceMatrix.needsUpdate = true
    }
  }, [matrices])

  const geometry = useMemo(() => new THREE.DodecahedronGeometry(1, 0), [])
  const material = useMemo(() => new THREE.MeshStandardMaterial({ 
    color, 
    flatShading: true,
    roughness: 0.9 
  }), [color])

  return <instancedMesh ref={meshRef} args={[geometry, material, count]} />
}

/* ═══════════════════════════════════════
   METEORS
   ═══════════════════════════════════════ */
function Meteor() {
  const meteorRef = useRef<THREE.Mesh>(null)
  const trailRef = useRef<THREE.Mesh>(null)
  const [active, setActive] = useState(false)
  const [startPos, setStartPos] = useState<THREE.Vector3>(new THREE.Vector3())
  const speedRef = useRef(0)

  useFrame((_, delta) => {
    if (!active || !meteorRef.current) return

    const dir = new THREE.Vector3(-1, -0.8, 0.3).normalize()
    meteorRef.current.position.add(dir.multiplyScalar(speedRef.current * delta))
    speedRef.current += delta * 15

    if (trailRef.current) {
      trailRef.current.position.copy(meteorRef.current.position)
    }

    if (meteorRef.current.position.y < -50 || meteorRef.current.position.length() > 250) {
      setActive(false)
    }
  })

  useEffect(() => {
    const spawn = () => {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.random() * Math.PI * 0.4 + 0.1
      const r = 120 + Math.random() * 60
      
      const x = r * Math.sin(phi) * Math.cos(theta)
      const y = r * Math.cos(phi) + 40
      const z = r * Math.sin(phi) * Math.sin(theta)
      
      setStartPos(new THREE.Vector3(x, y, z))
      setActive(true)
      speedRef.current = 30

      const nextSpawn = 2000 + Math.random() * 2000
      setTimeout(spawn, nextSpawn)
    }

    const initialDelay = setTimeout(spawn, 1000 + Math.random() * 3000)
    return () => clearTimeout(initialDelay)
  }, [])

  if (!active) return null

  return (
    <>
      <mesh ref={meteorRef} position={startPos.toArray()}>
        <sphereGeometry args={[0.3, 8, 8]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <mesh ref={trailRef} position={startPos.toArray()}>
        <sphereGeometry args={[0.15, 6, 6]} />
        <meshBasicMaterial color="#88ccff" transparent opacity={0.6} />
      </mesh>
      <pointLight position={startPos.toArray()} color="#aaddff" intensity={2} distance={15} />
    </>
  )
}

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
      <Stars radius={150} depth={100} count={5000} factor={6} saturation={0.1} fade speed={0.5} />
      <Stars radius={100} depth={50} count={2000} factor={3} saturation={0.3} fade speed={0.8} />
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
      <ZoneOverlays />
      <ProgressBar />
      <ScrollHint />

      {/* Planets */}
      <Planet position={[120, 55, -80]} size={8} color="#d4a574" hasRing ringColor="#c4a882" ringInner={1.4} ringOuter={2.4} rotationSpeed={0.15} />
      <Planet position={[-110, 70, 90]} size={12} color="#8b6b4a" rotationSpeed={0.08} />
      <Planet position={[90, 45, 130]} size={5} color="#a8684a" flatShading rotationSpeed={0.2} />
      <Planet position={[-90, 40, -70]} size={6} color="#5599cc" hasGlow emissiveIntensity={0.4} rotationSpeed={0.12} />
      <Planet position={[70, 50, -110]} size={4} color="#cc5544" flatShading rotationSpeed={0.18} />
      <Planet position={[-70, 60, 85]} size={5} color="#3388aa" rotationSpeed={0.1} />
      <Planet position={[100, 35, 60]} size={2.5} color="#888888" flatShading rotationSpeed={0.25} />

      {/* Asteroid Belts - diagonal to cut through the scene */}
      <group rotation={[0.3, 0.8, 0.2]}>
        <AsteroidBelt center={[0, 20, 0]} radius={95} width={8} count={300} minSize={0.3} maxSize={1.2} color="#6a5a4a" />
      </group>
      <group rotation={[-0.4, 0.5, 0.3]}>
        <AsteroidBelt center={[0, 30, 0]} radius={135} width={12} count={250} minSize={0.4} maxSize={1.5} color="#5a4a3a" />
      </group>

      {/* Meteors */}
      <Meteor />
    </>
  )
}

import * as THREE from 'three'

type TerrainHit = {
  point: THREE.Vector3
  normal: THREE.Vector3
}

type Listener = () => void

const raycaster = new THREE.Raycaster()
const origin = new THREE.Vector3()
const direction = new THREE.Vector3(0, -1, 0)
const normalMatrix = new THREE.Matrix3()
const _hitNormal = new THREE.Vector3()

let terrainObject: THREE.Object3D | null = null
const listeners = new Set<Listener>()

function notifyListeners() {
  listeners.forEach((listener) => listener())
}

export function registerTerrainSurface(object: THREE.Object3D | null) {
  terrainObject = object
  notifyListeners()
}

export function onTerrainSurfaceChange(listener: Listener): () => void {
  listeners.add(listener)
  // If terrain is already registered, notify immediately so late subscribers
  // (e.g. TrailPath, TrailProps) don't miss the initial registration event.
  if (terrainObject) listener()
  return () => listeners.delete(listener)
}

export function sampleTerrainSurface(x: number, z: number, castHeight = 180): TerrainHit | null {
  if (!terrainObject) return null

  origin.set(x, castHeight, z)
  raycaster.set(origin, direction)
  const hits = raycaster.intersectObject(terrainObject, true)
  if (hits.length === 0) return null

  // Find the first hit that is a top-facing surface (reject side/underside faces)
  for (const hit of hits) {
    _hitNormal.set(0, 1, 0)

    if (hit.face) {
      normalMatrix.getNormalMatrix(hit.object.matrixWorld)
      _hitNormal.copy(hit.face.normal).applyMatrix3(normalMatrix).normalize()
    } else if (hit.normal) {
      _hitNormal.copy(hit.normal).normalize()
    }

    // Only accept faces that point mostly upward (top surface, not side/skirt)
    if (_hitNormal.y >= 0.3) {
      return { point: hit.point.clone(), normal: _hitNormal.clone() }
    }
  }

  return null
}

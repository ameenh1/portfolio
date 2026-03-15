import { useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { ScrollControls } from '@react-three/drei'
import * as THREE from 'three'
import Scene from './Scene'

interface Props {
  onLoaded: () => void
}

export default function Experience({ onLoaded }: Props) {
  useEffect(() => {
    // Signal loaded after a brief delay for scene initialization
    const timer = setTimeout(onLoaded, 1500)
    return () => clearTimeout(timer)
  }, [onLoaded])

  return (
    <Canvas
      camera={{ fov: 55, near: 0.1, far: 200, position: [0, 2, 20] }}
      style={{ width: '100vw', height: '100vh' }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: false, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.9 }}
    >
      <color attach="background" args={['#121418']} />
      <fogExp2 attach="fog" args={['#121418', 0.01]} />

      <ScrollControls pages={6} damping={0.15}>
        <Scene />
      </ScrollControls>
    </Canvas>
  )
}

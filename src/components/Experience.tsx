import { useEffect, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ScrollControls } from '@react-three/drei'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import Scene from './Scene'

interface Props {
  onLoaded: () => void
}

function PostProcessing() {
  const { gl, scene, camera, size } = useThree()

  const composer = useMemo(() => new EffectComposer(gl), [gl])
  const renderPass = useMemo(() => new RenderPass(scene, camera), [scene, camera])
  const bloomPass = useMemo(() => {
    const pass = new UnrealBloomPass(new THREE.Vector2(size.width, size.height), 0.36, 1, 0.72)
    pass.threshold = 0.56
    return pass
  }, [size.height, size.width])
  const outputPass = useMemo(() => new OutputPass(), [])

  useEffect(() => {
    composer.addPass(renderPass)
    composer.addPass(bloomPass)
    composer.addPass(outputPass)
    gl.toneMapping = THREE.NoToneMapping

    return () => {
      composer.removePass(renderPass)
      composer.removePass(bloomPass)
      composer.removePass(outputPass)
      gl.toneMapping = THREE.ACESFilmicToneMapping
      composer.dispose()
    }
  }, [bloomPass, camera, composer, gl, outputPass, renderPass, scene])

  useEffect(() => {
    composer.setSize(size.width, size.height)
    composer.setPixelRatio(gl.getPixelRatio())
  }, [composer, gl, size.height, size.width])

  useFrame(() => {
    composer.render()
  }, 1)

  return null
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
      dpr={[1.5, 2.2]}
      gl={{ antialias: true, alpha: false, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.9 }}
    >
      <color attach="background" args={['#0f1724']} />
      <fogExp2 attach="fog" args={['#0f1724', 0.028]} />

      <ScrollControls pages={6} damping={0.15}>
        <Scene />
      </ScrollControls>
      <PostProcessing />
    </Canvas>
  )
}

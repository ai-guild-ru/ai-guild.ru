'use client'

import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { KeyboardControls, Stats } from '@react-three/drei'
import { Suspense } from 'react'
import { Ground } from '../Ground'
import { Player } from '../Player'
import { Lighting } from '../Lighting'
import { Building } from '../Building'
import { SpatialAudioSource } from '../SpatialAudioSource'
import { World3DSceneGlobalStyles, World3DSceneStyled } from './styles'
import { useMultiplayer } from '../hooks/useMultiplayer'
import { useAppContext } from 'src/components/AppContext'

const debug = process.env.NEXT_PUBLIC_DEBUG_WORLD3D === 'true'
const debugPhysics = process.env.NEXT_PUBLIC_DEBUG_WORLD3D_PHYSICS === 'true'

const keyboardMap = [
  { name: 'forward', keys: ['KeyW', 'ArrowUp'] },
  { name: 'backward', keys: ['KeyS', 'ArrowDown'] },
  { name: 'left', keys: ['KeyA', 'ArrowLeft'] },
  { name: 'right', keys: ['KeyD', 'ArrowRight'] },
  { name: 'run', keys: ['ShiftLeft', 'ShiftRight'] },
  { name: 'jump', keys: ['Space'] },
]

export const World3DScene: React.FC = () => {
  const { user } = useAppContext()

  // Multiplayer WS connection — enabled only for authenticated users
  useMultiplayer({ enabled: !!user })

  return (
    <>
      <World3DSceneGlobalStyles />
      <World3DSceneStyled>
        <KeyboardControls map={keyboardMap}>
          <Canvas shadows camera={{ position: [0, 5, 10], fov: 60 }}>
            <Suspense fallback={null}>
              {debug && <Stats />}
              <Physics gravity={[0, -9.81, 0]} debug={debug && debugPhysics}>
                {debug && <axesHelper args={[10]} />}
                <Lighting />
                <Ground />
                <Building
                  url="/assets/gltf/buildings/gildenhaus/scene.gltf"
                  position={[0, 0.1, 20]}
                  rotation={[0, 1.6, 0]}
                  scale={2.2}
                />
                <Player debug={debug} />
                {/* Test spatial audio source - positioned near the building */}
                <SpatialAudioSource
                  url="/assets/sounds/test.mp3"
                  position={[0, 2, 0]}
                  rotation={[0, 0, 0]}
                  refDistance={0.1}
                  maxDistance={4}
                  rolloffFactor={1}
                  coneInnerAngle={30}
                  coneOuterAngle={90}
                  coneOuterGain={0.1}
                  debug={debug}
                />
              </Physics>
            </Suspense>
          </Canvas>
        </KeyboardControls>
      </World3DSceneStyled>
    </>
  )
}

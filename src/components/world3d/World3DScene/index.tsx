'use client'

import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { KeyboardControls, Stats } from '@react-three/drei'
import { Suspense } from 'react'
import { Ground } from '../Ground'
import { Player } from '../Player'
import { Lighting } from '../Lighting'
import { Building } from '../Building'
import { World3DSceneStyled } from './styles'

const keyboardMap = [
  { name: 'forward', keys: ['KeyW', 'ArrowUp'] },
  { name: 'backward', keys: ['KeyS', 'ArrowDown'] },
  { name: 'left', keys: ['KeyA', 'ArrowLeft'] },
  { name: 'right', keys: ['KeyD', 'ArrowRight'] },
  { name: 'run', keys: ['ShiftLeft', 'ShiftRight'] },
  { name: 'jump', keys: ['Space'] },
]

export const World3DScene: React.FC = () => {
  return (
    <World3DSceneStyled>
      <KeyboardControls map={keyboardMap}>
        <Canvas shadows camera={{ position: [0, 5, 10], fov: 60 }}>
          <Suspense fallback={null}>
            <Stats />
            <Physics gravity={[0, -9.81, 0]}>
              <Lighting />
              <Ground />
              <Building
                url="/assets/gltf/buildings/gildenhaus/scene.gltf"
                position={[5, 0, -10]}
                scale={2}
              />
              <Player />
            </Physics>
          </Suspense>
        </Canvas>
      </KeyboardControls>
    </World3DSceneStyled>
  )
}

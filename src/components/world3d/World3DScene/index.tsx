'use client'

import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { KeyboardControls, Stats } from '@react-three/drei'
import { Suspense, useMemo } from 'react'
import { Ground } from '../Ground'
import { Player } from '../Player'
import { RemotePlayer } from '../RemotePlayer'
import { Lighting } from '../Lighting'
import { Building } from '../Building'
import { SpatialAudioSource } from '../SpatialAudioSource'
import { MuteButton } from '../MuteButton'
import { World3DSceneGlobalStyles, World3DSceneStyled } from './styles'
import { useMultiplayer } from '../hooks/useMultiplayer'
import { useVoiceChat } from '../hooks/useVoiceChat'
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
  const {
    wsRef,
    remotePlayers,
    sendPlayerState,
    onSignalingMessageRef,
    turnCredentialsRef,
  } = useMultiplayer({ enabled: !!user })

  // Remote player IDs list (stable reference for useVoiceChat dependency)
  const remotePlayerIds = useMemo(
    () => [...remotePlayers.keys()],
    [remotePlayers],
  )

  // Voice chat — WebRTC P2P mesh with spatial audio
  const { remoteStreams, isMuted, toggleMute } = useVoiceChat({
    enabled: !!user,
    wsRef,
    onSignalingMessageRef,
    turnCredentialsRef,
    remotePlayerIds,
  })

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
                <Player debug={debug} sendPlayerState={sendPlayerState} />
                {/* Remote players — rendered from server state */}
                {[...remotePlayers.values()].map((player) => (
                  <RemotePlayer
                    key={player.playerId}
                    data={player}
                    voiceStream={remoteStreams.get(player.playerId)}
                  />
                ))}
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
        {/* Voice chat mute/unmute button — outside Canvas (HTML overlay) */}
        {user && <MuteButton isMuted={isMuted} onToggle={toggleMute} />}
      </World3DSceneStyled>
    </>
  )
}

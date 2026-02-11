'use client'

import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { KeyboardControls, Stats } from '@react-three/drei'
import { Suspense, useCallback, useMemo, useRef, useState } from 'react'
import { Ground } from '../Ground'
import { Player } from '../Player'
import { RemotePlayer } from '../RemotePlayer'
import { Lighting } from '../Lighting'
import { Building } from '../Building'
import { SpatialAudioSource } from '../SpatialAudioSource'
import { MuteButton } from '../MuteButton'
import { MuteWorldButton } from '../MuteWorldButton'
import { ConnectionOverlay } from '../ConnectionOverlay'
import { DebugVoiceChatOverlay } from '../components/debug/DebugVoiceChatOverlay'
import {
  World3DSceneGlobalStyles,
  World3DSceneStyled,
  World3DSceneControlsStyled,
} from './styles'
import { useMultiplayer } from '../hooks/useMultiplayer'
import { useVoiceChat } from '../hooks/useVoiceChat'
import { useAppContext } from 'src/components/AppContext'
import type { AudioListener } from 'three'

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
    connectionStatus,
    reconnect,
  } = useMultiplayer({ enabled: !!user })

  const remotePlayersRef = useRef(remotePlayers)

  remotePlayersRef.current = remotePlayers

  // Remote player IDs list (stable reference for useVoiceChat dependency)
  const remotePlayerIds = useMemo(
    () => [...remotePlayersRef.current.keys()],
    [],
  )

  // Voice chat — WebRTC P2P mesh with spatial audio
  const { remoteStreams, isMuted, toggleMute, peersRef, localStreamRef } =
    useVoiceChat({
      enabled: !!user,
      localPlayerId: user?.id ?? null,
      wsRef,
      onSignalingMessageRef,
      turnCredentialsRef,
      remotePlayerIds,
    })

  // AudioListener ref — exposed by Player for world mute control
  const audioListenerRef = useRef<AudioListener | null>(null)
  // World mute state — controls AudioListener gain (mutes all 3D sounds)
  const [isWorldMuted, setIsWorldMuted] = useState(false)

  const toggleWorldMute = useCallback(() => {
    const listener = audioListenerRef.current
    if (!listener) {
      return
    }
    const newMuted = !isWorldMuted
    listener.setMasterVolume(newMuted ? 0 : 1)
    setIsWorldMuted(newMuted)
  }, [isWorldMuted])

  return (
    <>
      <World3DSceneGlobalStyles />
      <World3DSceneStyled>
        <KeyboardControls map={keyboardMap}>
          <Canvas shadows camera={{ position: [0, 5, 10], fov: 60 }}>
            <Suspense fallback={null}>
              {debug && <Stats className="drai--debug-stats" />}
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
                <Player
                  debug={debug}
                  sendPlayerState={sendPlayerState}
                  audioListenerRef={audioListenerRef}
                />
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
        {/* Audio control buttons — mic mute + world mute */}
        {user && (
          <World3DSceneControlsStyled>
            <MuteButton isMuted={isMuted} onToggle={toggleMute} />
            <MuteWorldButton
              isMuted={isWorldMuted}
              onToggle={toggleWorldMute}
            />
          </World3DSceneControlsStyled>
        )}
        {/* WS connection status overlay — shown on error or session replaced */}
        <ConnectionOverlay status={connectionStatus} onReconnect={reconnect} />
        {/* WebRTC voice chat debug overlay */}
        {debug && user && (
          <DebugVoiceChatOverlay
            peersRef={peersRef}
            localStreamRef={localStreamRef}
            isMuted={isMuted}
            remoteStreams={remoteStreams}
            wsRef={wsRef}
            turnCredentialsRef={turnCredentialsRef}
          />
        )}
      </World3DSceneStyled>
    </>
  )
}

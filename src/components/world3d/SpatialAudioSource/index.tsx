'use client'

import { useRef, useEffect } from 'react'
import { PositionalAudio } from '@react-three/drei'
import * as THREE from 'three'
import { DebugAudioOverlay } from '../components/debug/DebugAudioOverlay'
import { DebugSoundCone } from '../components/debug/DebugSoundCone'

type SpatialAudioSourceProps = {
  /** URL to the audio file */
  url: string
  /** Position in 3D space [x, y, z] */
  position?: [number, number, number]
  /** Rotation in radians [x, y, z] - determines sound direction */
  rotation?: [number, number, number]
  /** Distance at which volume is 1 (default: 1) */
  refDistance?: number
  /** Maximum distance for sound falloff (default: 10) */
  maxDistance?: number
  /** Rolloff factor - how quickly sound fades (default: 1) */
  rolloffFactor?: number
  /** Inner cone angle in degrees - full volume zone (default: 360 for omnidirectional) */
  coneInnerAngle?: number
  /** Outer cone angle in degrees - falloff zone (default: 360) */
  coneOuterAngle?: number
  /** Volume outside the outer cone (0-1, default: 0) */
  coneOuterGain?: number
  /** Whether to loop the audio (default: true) */
  loop?: boolean
  /** Initial volume (0-1, default: 1) */
  volume?: number
  /** Show debug visualization (default: false) */
  debug?: boolean
  /** Autoplay on mount (default: true) */
  autoplay?: boolean
}

/**
 * Spatial audio source component with positional/directional sound.
 * Uses Web Audio API PositionalAudio for 3D sound positioning.
 * Sound volume decreases with distance and can be directional (cone-shaped).
 */
export const SpatialAudioSource: React.FC<SpatialAudioSourceProps> = ({
  url,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  refDistance = 1,
  maxDistance = 10,
  rolloffFactor = 1,
  coneInnerAngle = 360,
  coneOuterAngle = 360,
  coneOuterGain = 0,
  loop = true,
  volume = 1,
  debug = false,
  autoplay = true,
}) => {
  const audioRef = useRef<THREE.PositionalAudio>(null)
  const groupRef = useRef<THREE.Group>(null)

  // Cleanup: stop audio on unmount
  useEffect(() => {
    const audio = audioRef.current
    return () => {
      if (audio?.isPlaying) {
        audio.stop()
      }
    }
  }, [])

  // Configure audio parameters after load
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) {
      return
    }

    audio.setRefDistance(refDistance)
    audio.setMaxDistance(maxDistance)
    audio.setRolloffFactor(rolloffFactor)
    audio.setDirectionalCone(coneInnerAngle, coneOuterAngle, coneOuterGain)
    audio.setVolume(volume)
    audio.setLoop(loop)
  }, [
    refDistance,
    maxDistance,
    rolloffFactor,
    coneInnerAngle,
    coneOuterAngle,
    coneOuterGain,
    volume,
    loop,
  ])

  return (
    <group ref={groupRef} position={position} rotation={rotation}>
      {/* Positional audio source */}
      <PositionalAudio
        ref={audioRef}
        url={url}
        distance={refDistance}
        loop={loop}
        autoplay={autoplay}
      />

      {/* Debug visualization */}
      {debug && (
        <DebugSoundCone
          refDistance={refDistance}
          maxDistance={maxDistance}
          coneInnerAngle={coneInnerAngle}
          coneOuterAngle={coneOuterAngle}
        />
      )}

      {/* Visual marker for sound source position */}
      {debug && (
        <mesh>
          <sphereGeometry args={[0.2, 8, 8]} />
          <meshBasicMaterial color="magenta" />
        </mesh>
      )}

      {/* Debug overlay with audio state */}
      {debug && (
        <DebugAudioOverlay
          audioRef={audioRef}
          groupRef={groupRef}
          url={url}
          refDistance={refDistance}
          maxDistance={maxDistance}
          volume={volume}
          coneInnerAngle={coneInnerAngle}
          coneOuterAngle={coneOuterAngle}
        />
      )}
    </group>
  )
}

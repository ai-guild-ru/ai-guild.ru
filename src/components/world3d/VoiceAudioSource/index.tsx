'use client'

import { useRef, useEffect } from 'react'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'

interface VoiceAudioSourceProps {
  /** MediaStream from WebRTC peer connection (remote player's microphone) */
  stream: MediaStream
  /** Distance at which volume is 1 (default: 1) */
  refDistance?: number
  /** Maximum distance for sound falloff (default: 25) */
  maxDistance?: number
  /** Rolloff factor — how quickly sound fades (default: 1) */
  rolloffFactor?: number
}

/**
 * Spatial audio source for a remote player's voice stream.
 * Connects a WebRTC MediaStream to a Three.js PositionalAudio node
 * so the voice is heard in 3D space relative to the listener (local player).
 *
 * Placed as a child of RemotePlayer group — inherits position/rotation from parent.
 * Uses Web Audio API MediaStreamSource for zero-latency audio routing.
 */
export const VoiceAudioSource: React.FC<VoiceAudioSourceProps> = ({
  stream,
  refDistance = 1,
  maxDistance = 25,
  rolloffFactor = 1,
}) => {
  const audioRef = useRef<THREE.PositionalAudio | null>(null)
  const { camera } = useThree()

  useEffect(() => {
    // Get or create AudioListener on the camera
    let listener = camera.children.find(
      (child): child is THREE.AudioListener =>
        child instanceof THREE.AudioListener,
    )
    if (!listener) {
      listener = new THREE.AudioListener()
      camera.add(listener)
    }

    // Create PositionalAudio and connect the MediaStream
    const audio = new THREE.PositionalAudio(listener)
    audio.setRefDistance(refDistance)
    audio.setMaxDistance(maxDistance)
    audio.setRolloffFactor(rolloffFactor)
    audio.setDistanceModel('inverse')

    // Connect MediaStream as audio source
    const audioContext = listener.context
    const source = audioContext.createMediaStreamSource(stream)
    // @ts-expect-error — Three.js PositionalAudio.setNodeSource accepts AudioNode
    audio.setNodeSource(source)

    audioRef.current = audio

    return () => {
      // Cleanup: disconnect source and remove audio from scene
      source.disconnect()
      if (audio.parent) {
        audio.parent.remove(audio)
      }
      audioRef.current = null
    }
  }, [stream, camera, refDistance, maxDistance, rolloffFactor])

  // Render as a primitive so it attaches to the parent group in the scene graph
  return audioRef.current ? <primitive object={audioRef.current} /> : null
}

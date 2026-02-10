/* eslint-disable no-console */
'use client'

import { useEffect, useState } from 'react'
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
 * Finds the existing AudioListener in the scene (attached to Player's head group)
 * instead of creating a new one — ensures spatial audio uses the same listener
 * as SpatialAudioSource components.
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
  const { scene } = useThree()
  // useState to trigger re-render when audio object is created
  const [audio, setAudio] = useState<THREE.PositionalAudio | null>(null)

  useEffect(() => {
    // Find existing AudioListener in the scene (attached to Player's head group)
    let listener: THREE.AudioListener | undefined
    scene.traverse((obj) => {
      if (obj instanceof THREE.AudioListener) {
        listener = obj
      }
    })

    if (!listener) {
      console.warn('[VoiceAudioSource] No AudioListener found in scene')
      return
    }

    const audioContext = listener.context

    console.log(
      '[VoiceAudioSource] AudioListener found. AudioContext state:',
      audioContext.state,
      'sampleRate:',
      audioContext.sampleRate,
    )

    console.log(
      '[VoiceAudioSource] Stream:',
      stream.id,
      'active:',
      stream.active,
      'audioTracks:',
      stream.getAudioTracks().map((t) => ({
        readyState: t.readyState,
        enabled: t.enabled,
        muted: t.muted,
        label: t.label,
      })),
    )

    // Create PositionalAudio and connect the MediaStream
    const positionalAudio = new THREE.PositionalAudio(listener)
    positionalAudio.setRefDistance(refDistance)
    positionalAudio.setMaxDistance(maxDistance)
    positionalAudio.setRolloffFactor(rolloffFactor)
    positionalAudio.setDistanceModel('inverse')

    // DEBUG: test raw stream playback via hidden <audio> element
    // This bypasses Three.js entirely — if you hear sound, the stream is fine
    const debugAudio = document.createElement('audio')
    debugAudio.srcObject = stream
    debugAudio.autoplay = true
    debugAudio.volume = 1.0
    document.body.appendChild(debugAudio)

    debugAudio.onplay = () =>
      console.log('[VoiceAudioSource] DEBUG <audio> element started playing')

    debugAudio.onerror = (e) =>
      console.error('[VoiceAudioSource] DEBUG <audio> element error:', e)

    // Connect MediaStream as audio source via Web Audio API
    const source = audioContext.createMediaStreamSource(stream)
    // @ts-expect-error — Three.js PositionalAudio.setNodeSource accepts AudioNode
    positionalAudio.setNodeSource(source)

    console.log(
      '[VoiceAudioSource] PositionalAudio created. isPlaying:',
      positionalAudio.isPlaying,
      'gain:',
      positionalAudio.getVolume(),
      'panner distanceModel:',
      positionalAudio.panner.distanceModel,
      'refDistance:',
      positionalAudio.panner.refDistance,
      'maxDistance:',
      positionalAudio.panner.maxDistance,
    )

    // Log AudioContext state changes
    const onStateChange = () => {
      console.log(
        '[VoiceAudioSource] AudioContext state changed to:',
        audioContext.state,
      )
    }
    audioContext.addEventListener('statechange', onStateChange)

    setAudio(positionalAudio)

    return () => {
      // Cleanup: debug audio element
      debugAudio.pause()
      debugAudio.srcObject = null
      debugAudio.remove()
      // Cleanup: disconnect source and remove audio from scene
      audioContext.removeEventListener('statechange', onStateChange)
      source.disconnect()
      if (positionalAudio.parent) {
        positionalAudio.parent.remove(positionalAudio)
      }
      setAudio(null)
    }
  }, [stream, scene, refDistance, maxDistance, rolloffFactor])

  // Render as a primitive so it attaches to the parent group in the scene graph
  return audio ? <primitive object={audio} /> : null
}

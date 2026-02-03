'use client'

import { useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import {
  DebugOverlayLabelStyled,
  DebugOverlayRowStyled,
  DebugOverlayValueStyled,
} from '../DebugOverlay/styles'
import { DebugOverlay } from '../DebugOverlay'

/**
 * Debug state for audio monitoring
 */
interface DebugAudioState {
  isPlaying: boolean
  isLoaded: boolean
  hasListener: boolean
  currentVolume: number
  distanceToListener: number
  contextState: string
}

type DebugAudioOverlayProps = {
  audioRef: React.RefObject<THREE.PositionalAudio | null>
  groupRef: React.RefObject<THREE.Group | null>
  url: string
  refDistance: number
  maxDistance: number
  volume: number
  coneInnerAngle: number
  coneOuterAngle: number
}

/**
 * Debug overlay for spatial audio - shows audio state and parameters.
 * Uses DebugOverlay component for consistent styling with other debug panels.
 */
export const DebugAudioOverlay: React.FC<DebugAudioOverlayProps> = ({
  audioRef,
  groupRef,
  url,
  refDistance,
  maxDistance,
  volume,
  coneInnerAngle,
  coneOuterAngle,
}) => {
  const { scene } = useThree()
  const frameCount = useRef(0)

  const [state, setState] = useState<DebugAudioState>({
    isPlaying: false,
    isLoaded: false,
    hasListener: false,
    currentVolume: 0,
    distanceToListener: 0,
    contextState: 'unknown',
  })

  useFrame(() => {
    frameCount.current += 1
    if (frameCount.current % 10 !== 0) {
      return
    }

    const audio = audioRef.current
    const group = groupRef.current

    // Find listener in scene (attached to avatar, not camera)
    let listener: THREE.AudioListener | undefined
    scene.traverse((obj) => {
      if (obj instanceof THREE.AudioListener) {
        listener = obj
      }
    })

    // Calculate distance to listener
    let distance = 0
    if (group && listener) {
      const audioPos = new THREE.Vector3()
      const listenerPos = new THREE.Vector3()
      group.getWorldPosition(audioPos)
      listener.getWorldPosition(listenerPos)
      distance = audioPos.distanceTo(listenerPos)
    }

    // Get audio context state
    const contextState = listener?.context?.state || 'no context'

    // Calculate effective gain based on distance
    let effectiveGain = 0
    if (audio && distance > 0) {
      // Linear distance model approximation
      if (distance <= refDistance) {
        effectiveGain = volume
      } else if (distance >= maxDistance) {
        effectiveGain = 0
      } else {
        effectiveGain =
          volume * (1 - (distance - refDistance) / (maxDistance - refDistance))
      }
    }

    setState({
      isPlaying: audio?.isPlaying || false,
      isLoaded: audio?.buffer !== null,
      hasListener: !!listener,
      currentVolume: effectiveGain,
      distanceToListener: distance,
      contextState,
    })
  })

  return (
    <DebugOverlay
      title="Spatial Audio"
      style={{
        right: 60,
        left: 'auto',
        bottom: 60,
      }}
    >
      <DebugOverlayRowStyled>
        <DebugOverlayLabelStyled>File:</DebugOverlayLabelStyled>{' '}
        <DebugOverlayValueStyled>
          {url.split('/').pop()}
        </DebugOverlayValueStyled>
      </DebugOverlayRowStyled>

      <DebugOverlayRowStyled>
        <DebugOverlayLabelStyled>Status:</DebugOverlayLabelStyled>{' '}
        <span style={{ color: state.isPlaying ? '#0f0' : '#f00' }}>
          {state.isPlaying ? '▶ Playing' : '⏸ Stopped'}
        </span>
      </DebugOverlayRowStyled>

      <DebugOverlayRowStyled>
        <DebugOverlayLabelStyled>Loaded:</DebugOverlayLabelStyled>{' '}
        <span style={{ color: state.isLoaded ? '#0f0' : '#ff0' }}>
          {state.isLoaded ? '✓ Yes' : '⏳ No'}
        </span>
      </DebugOverlayRowStyled>

      <DebugOverlayRowStyled>
        <DebugOverlayLabelStyled>Listener:</DebugOverlayLabelStyled>{' '}
        <span style={{ color: state.hasListener ? '#0f0' : '#f00' }}>
          {state.hasListener ? '✓ Attached' : '✗ Missing'}
        </span>
      </DebugOverlayRowStyled>

      <DebugOverlayRowStyled>
        <DebugOverlayLabelStyled>Context:</DebugOverlayLabelStyled>{' '}
        <span
          style={{ color: state.contextState === 'running' ? '#0f0' : '#ff0' }}
        >
          {state.contextState}
        </span>
      </DebugOverlayRowStyled>

      <DebugOverlayRowStyled>
        <DebugOverlayLabelStyled>Distance:</DebugOverlayLabelStyled>{' '}
        <DebugOverlayValueStyled>
          {state.distanceToListener.toFixed(2)}m
        </DebugOverlayValueStyled>
      </DebugOverlayRowStyled>

      <DebugOverlayRowStyled>
        <DebugOverlayLabelStyled>Volume (set):</DebugOverlayLabelStyled>{' '}
        <DebugOverlayValueStyled>{volume}</DebugOverlayValueStyled>
      </DebugOverlayRowStyled>

      <DebugOverlayRowStyled>
        <DebugOverlayLabelStyled>Gain (calc):</DebugOverlayLabelStyled>{' '}
        <DebugOverlayValueStyled>
          {state.currentVolume.toFixed(3)}
        </DebugOverlayValueStyled>
      </DebugOverlayRowStyled>

      <DebugOverlayRowStyled>
        <DebugOverlayLabelStyled>RefDist:</DebugOverlayLabelStyled>{' '}
        <DebugOverlayValueStyled>{refDistance}m</DebugOverlayValueStyled>
        {' | '}
        <DebugOverlayLabelStyled>MaxDist:</DebugOverlayLabelStyled>{' '}
        <DebugOverlayValueStyled>{maxDistance}m</DebugOverlayValueStyled>
      </DebugOverlayRowStyled>

      <DebugOverlayRowStyled>
        <DebugOverlayLabelStyled>Cone:</DebugOverlayLabelStyled>{' '}
        <DebugOverlayValueStyled>
          {coneInnerAngle}° / {coneOuterAngle}°
        </DebugOverlayValueStyled>
      </DebugOverlayRowStyled>
    </DebugOverlay>
  )
}

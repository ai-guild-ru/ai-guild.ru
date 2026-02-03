'use client'

import { useRef, useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { PerspectiveCamera } from '@react-three/drei'
import type { PerspectiveCamera as PerspectiveCameraType } from 'three'

const MOUSE_SENSITIVITY = 0.005
const MIN_POLAR_ANGLE = -Math.PI / 4 // Limit looking up
const MAX_POLAR_ANGLE = Math.PI / 4 // Limit looking down

/**
 * Third person camera component — child of RigidBody with fixed offset.
 * Handles mouse rotation for orbiting around the player.
 * Position is relative to parent (RigidBody), so it follows the player automatically.
 */
export const ThirdPersonCamera = () => {
  const { gl } = useThree()
  const cameraRef = useRef<PerspectiveCameraType>(null)
  const isDragging = useRef(false)
  const rotation = useRef({ x: -0.3, y: 0 }) // Initial rotation (slight look down)

  useEffect(() => {
    const canvas = gl.domElement

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        isDragging.current = true
      }
    }

    const onMouseUp = () => {
      isDragging.current = false
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !cameraRef.current) {
        return
      }

      // Update rotation based on mouse movement
      rotation.current.y -= e.movementX * MOUSE_SENSITIVITY
      rotation.current.x -= e.movementY * MOUSE_SENSITIVITY
      rotation.current.x = Math.max(
        MIN_POLAR_ANGLE,
        Math.min(MAX_POLAR_ANGLE, rotation.current.x),
      )

      // Apply rotation to camera
      cameraRef.current.rotation.x = rotation.current.x
      cameraRef.current.rotation.y = rotation.current.y
    }

    canvas.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('mousemove', onMouseMove)

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('mousemove', onMouseMove)
    }
  }, [gl])

  return (
    // Camera with fixed offset: 3 units up, 5 units back from player
    <PerspectiveCamera
      ref={cameraRef}
      makeDefault
      position={[0, 3, 5]}
      rotation={[rotation.current.x, rotation.current.y, 0]}
    />
  )
}

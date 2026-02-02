'use client'

import { useRef, useEffect, RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3, Spherical } from 'three'
import type { RapierRigidBody } from '@react-three/rapier'

interface ThirdPersonCameraProps {
  target: RefObject<RapierRigidBody | null>
}

const CAMERA_DISTANCE = 5
const CAMERA_HEIGHT = 1
const LERP_FACTOR = 0.1
const MOUSE_SENSITIVITY = 0.005
const MIN_POLAR_ANGLE = 0.1
const MAX_POLAR_ANGLE = Math.PI - 0.1

export const ThirdPersonCamera = ({ target }: ThirdPersonCameraProps) => {
  const { camera, gl } = useThree()
  const spherical = useRef(new Spherical(CAMERA_DISTANCE, Math.PI / 3, 0))
  const isDragging = useRef(false)

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
      if (!isDragging.current) {
        return
      }

      spherical.current.theta -= e.movementX * MOUSE_SENSITIVITY
      spherical.current.phi += e.movementY * MOUSE_SENSITIVITY
      spherical.current.phi = Math.max(
        MIN_POLAR_ANGLE,
        Math.min(MAX_POLAR_ANGLE, spherical.current.phi),
      )
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

  useFrame(() => {
    if (!target.current) {
      return
    }

    const position = target.current.translation()
    const targetPos = new Vector3(
      position.x,
      position.y + CAMERA_HEIGHT,
      position.z,
    )

    const offset = new Vector3().setFromSpherical(spherical.current)
    const idealPosition = targetPos.clone().add(offset)

    camera.position.lerp(idealPosition, LERP_FACTOR)
    camera.lookAt(targetPos)
  })

  return null
}

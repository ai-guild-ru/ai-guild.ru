'use client'

import { useState, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import {
  DebugOverlayStyled,
  DebugOverlayContainerStyled,
  DebugOverlayTitleStyled,
  DebugOverlayRowStyled,
  DebugOverlayLabelStyled,
  DebugOverlayValueStyled,
  DebugOverlayValueRigidBodyStyled,
  DebugOverlayValueAvatarStyled,
  DebugOverlayValueCameraStyled,
  DebugOverlayRotationStyled,
} from './styles'

interface DebugData {
  world: { x: number; y: number; z: number }
  rigidBody: { x: number; y: number; z: number }
  avatar: { x: number; y: number; z: number }
  camera: { x: number; y: number; z: number }
}

interface DebugOverlayProps {
  rigidBodyRef: React.RefObject<THREE.Object3D | null>
  avatarRef: React.RefObject<THREE.Object3D | null>
}

const formatVector = (v: { x: number; y: number; z: number }) =>
  `(${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)})`

const formatAngle = (rad: number) => `${((rad * 180) / Math.PI).toFixed(1)}°`

/**
 * Компонент отладки — отображает направления объектов через React.createPortal.
 * Показывает forward direction для: мира, RigidBody, аватара, камеры.
 */
export const DebugOverlay: React.FC<DebugOverlayProps> = ({
  rigidBodyRef,
  avatarRef,
}) => {
  const { camera } = useThree()
  const [debugData, setDebugData] = useState<DebugData>({
    world: { x: 0, y: 0, z: -1 },
    rigidBody: { x: 0, y: 0, z: 0 },
    avatar: { x: 0, y: 0, z: 0 },
    camera: { x: 0, y: 0, z: 0 },
  })
  const [rotations, setRotations] = useState({
    rigidBody: { x: 0, y: 0, z: 0 },
    avatar: { x: 0, y: 0, z: 0 },
    camera: { x: 0, y: 0, z: 0 },
  })
  const frameCount = useRef(0)

  useFrame(() => {
    frameCount.current += 1
    if (frameCount.current % 10 !== 0) {
      return
    }

    const forward = new THREE.Vector3(0, 0, -1)
    const newData: DebugData = {
      world: { x: 0, y: 0, z: -1 },
      rigidBody: { x: 0, y: 0, z: 0 },
      avatar: { x: 0, y: 0, z: 0 },
      camera: { x: 0, y: 0, z: 0 },
    }
    const newRotations = {
      rigidBody: { x: 0, y: 0, z: 0 },
      avatar: { x: 0, y: 0, z: 0 },
      camera: { x: 0, y: 0, z: 0 },
    }

    // RigidBody direction
    if (rigidBodyRef.current) {
      const dir = forward
        .clone()
        .applyQuaternion(rigidBodyRef.current.quaternion)
      newData.rigidBody = { x: dir.x, y: dir.y, z: dir.z }
      newRotations.rigidBody = {
        x: rigidBodyRef.current.rotation.x,
        y: rigidBodyRef.current.rotation.y,
        z: rigidBodyRef.current.rotation.z,
      }
    }

    // Avatar direction
    if (avatarRef.current) {
      const dir = forward.clone().applyQuaternion(avatarRef.current.quaternion)
      newData.avatar = { x: dir.x, y: dir.y, z: dir.z }
      newRotations.avatar = {
        x: avatarRef.current.rotation.x,
        y: avatarRef.current.rotation.y,
        z: avatarRef.current.rotation.z,
      }
    }

    // Camera direction
    const camDir = new THREE.Vector3()
    camera.getWorldDirection(camDir)
    newData.camera = { x: camDir.x, y: camDir.y, z: camDir.z }
    newRotations.camera = {
      x: camera.rotation.x,
      y: camera.rotation.y,
      z: camera.rotation.z,
    }

    setDebugData(newData)
    setRotations(newRotations)
  })

  return (
    <DebugOverlayStyled
      position={[0, 0, 0]}
      // calculatePosition={useCallback(() => [0, 0], [])}
      // fullscreen
      portal={useRef(global.document?.body)}
      wrapperClass="drai--debug-overlay-warpper"
    >
      <DebugOverlayContainerStyled>
        <DebugOverlayTitleStyled>🔍 Debug: Directions</DebugOverlayTitleStyled>

        <DebugOverlayRowStyled>
          <DebugOverlayLabelStyled>World Forward:</DebugOverlayLabelStyled>{' '}
          <DebugOverlayValueStyled>
            {formatVector(debugData.world)}
          </DebugOverlayValueStyled>
        </DebugOverlayRowStyled>

        <DebugOverlayRowStyled>
          <DebugOverlayLabelStyled>RigidBody:</DebugOverlayLabelStyled>{' '}
          <DebugOverlayValueRigidBodyStyled>
            {formatVector(debugData.rigidBody)}
          </DebugOverlayValueRigidBodyStyled>
          <br />
          <DebugOverlayRotationStyled>
            rot Y: {formatAngle(rotations.rigidBody.y)}
          </DebugOverlayRotationStyled>
        </DebugOverlayRowStyled>

        <DebugOverlayRowStyled>
          <DebugOverlayLabelStyled>Avatar:</DebugOverlayLabelStyled>{' '}
          <DebugOverlayValueAvatarStyled>
            {formatVector(debugData.avatar)}
          </DebugOverlayValueAvatarStyled>
          <br />
          <DebugOverlayRotationStyled>
            rot Y: {formatAngle(rotations.avatar.y)}
          </DebugOverlayRotationStyled>
        </DebugOverlayRowStyled>

        <DebugOverlayRowStyled>
          <DebugOverlayLabelStyled>Camera:</DebugOverlayLabelStyled>{' '}
          <DebugOverlayValueCameraStyled>
            {formatVector(debugData.camera)}
          </DebugOverlayValueCameraStyled>
          <br />
          <DebugOverlayRotationStyled>
            rot X: {formatAngle(rotations.camera.x)}, Y:{' '}
            {formatAngle(rotations.camera.y)}
          </DebugOverlayRotationStyled>
        </DebugOverlayRowStyled>
      </DebugOverlayContainerStyled>
    </DebugOverlayStyled>
  )
}

'use client'

import React, { useRef } from 'react'
import * as THREE from 'three'
import { PerspectiveCamera } from '@react-three/drei'
import type { PerspectiveCamera as PerspectiveCameraType } from 'three'

const CAMERA_DISTANCE = 6 // Расстояние камеры от pivot
const PIVOT_HEIGHT = 1.7 // Высота pivot (примерно голова)

interface ThirdPersonCameraProps {
  pitch: number // Вертикальный угол камеры (управляется из Player)
  yaw?: number // Горизонтальный угол камеры относительно аватара
}

/**
 * Third person camera component — child of RigidBody with fixed offset.
 * Камера орбитирует вокруг игрока по вертикали (pitch).
 * Горизонтальный поворот управляется через rotationRef в Player (аватар крутится).
 *
 * Структура:
 * - pivotRef (group) — точка вращения на уровне головы игрока
 * - cameraRef (PerspectiveCamera) — камера со смещением назад от pivot
 */
export const ThirdPersonCamera: React.FC<ThirdPersonCameraProps> = ({
  pitch,
  yaw = 0,
}) => {
  const pivotRef = useRef<THREE.Group>(null)
  const cameraRef = useRef<PerspectiveCameraType>(null)

  return (
    // Yaw group — горизонтальный поворот камеры относительно аватара
    <group rotation={[0, yaw, 0]}>
      {/* Pivot group на уровне головы — вертикальный наклон (pitch) */}
      <group
        ref={pivotRef}
        position={[0, PIVOT_HEIGHT, 0]}
        rotation={[pitch, 0, 0]}
      >
        {/* Камера со смещением назад от pivot */}
        <PerspectiveCamera
          ref={cameraRef}
          makeDefault
          position={[0, 0, -CAMERA_DISTANCE]}
          rotation={[0, Math.PI, 0]} // Смотрит на pivot (на игрока)
        />
      </group>
    </group>
  )
}

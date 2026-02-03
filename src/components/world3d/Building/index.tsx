'use client'

import { RigidBody } from '@react-three/rapier'
import { useGLTF } from '@react-three/drei'
import { Vector3Tuple } from 'three'

interface BuildingProps {
  url: string
  position?: Vector3Tuple
  scale?: number | Vector3Tuple
  rotation?: Vector3Tuple
}

export const Building: React.FC<BuildingProps> = ({
  url,
  position = [0, 0, 0],
  scale = 1,
  rotation = [0, 0, 0],
}) => {
  const { scene } = useGLTF(url)

  return (
    <RigidBody
      type="fixed"
      colliders="trimesh"
      position={position}
      rotation={rotation}
    >
      <primitive object={scene} scale={scale} />
    </RigidBody>
  )
}

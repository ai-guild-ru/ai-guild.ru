'use client'

import { RigidBody } from '@react-three/rapier'

export const Ground = () => {
  return (
    <RigidBody type="fixed" colliders="cuboid">
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#3a7d44" />
      </mesh>
    </RigidBody>
  )
}

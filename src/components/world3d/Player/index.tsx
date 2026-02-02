'use client'

import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { RigidBody, CapsuleCollider } from '@react-three/rapier'
import { useKeyboardControls, Html } from '@react-three/drei'
import { Vector3 } from 'three'
import type { RapierRigidBody } from '@react-three/rapier'
import { ThirdPersonCamera } from '../ThirdPersonCamera'

const WALK_SPEED = 4
const RUN_SPEED = 8
const JUMP_FORCE = 5

interface Position {
  x: number
  y: number
  z: number
}

export const Player: React.FC = () => {
  const rigidBodyRef = useRef<RapierRigidBody>(null)
  const [debugPosition, setDebugPosition] = useState<Position>({
    x: 0,
    y: 0,
    z: 0,
  })
  const frameCount = useRef(0)
  const [, getKeys] = useKeyboardControls()

  const direction = new Vector3()
  const frontVector = new Vector3()
  const sideVector = new Vector3()

  useFrame((state) => {
    if (!rigidBodyRef.current) {
      return
    }

    const { forward, backward, left, right, run, jump } = getKeys()

    const velocity = rigidBodyRef.current.linvel()
    const position = rigidBodyRef.current.translation()

    const speed = run ? RUN_SPEED : WALK_SPEED

    frontVector.set(0, 0, (backward ? 1 : 0) - (forward ? 1 : 0))
    sideVector.set((left ? 1 : 0) - (right ? 1 : 0), 0, 0)

    direction
      .subVectors(frontVector, sideVector)
      .normalize()
      .multiplyScalar(speed)
      .applyEuler(state.camera.rotation)

    rigidBodyRef.current.setLinvel(
      { x: direction.x, y: velocity.y, z: direction.z },
      true,
    )

    const isOnGround = position.y < 1.1
    if (jump && isOnGround) {
      rigidBodyRef.current.setLinvel(
        { x: velocity.x, y: JUMP_FORCE, z: velocity.z },
        true,
      )
    }

    frameCount.current++
    if (frameCount.current % 10 === 0) {
      setDebugPosition({ x: position.x, y: position.y, z: position.z })
    }
  })

  return (
    <>
      <RigidBody
        ref={rigidBodyRef}
        colliders={false}
        mass={1}
        type="dynamic"
        position={[0, 2, 0]}
        enabledRotations={[false, false, false]}
        linearDamping={0.5}
      >
        <CapsuleCollider args={[0.5, 0.5]} position={[0, 1, 0]} />
        <mesh castShadow position={[0, 1, 0]}>
          <capsuleGeometry args={[0.5, 1, 8, 16]} />
          <meshStandardMaterial color="#4a90d9" />
        </mesh>
      </RigidBody>
      <ThirdPersonCamera target={rigidBodyRef} />
      <Html position={[0, 3, 0]} center style={{ pointerEvents: 'none' }}>
        <div
          style={{
            background: 'rgba(0,0,0,0.7)',
            color: '#0f0',
            padding: '8px 12px',
            borderRadius: '4px',
            fontFamily: 'monospace',
            fontSize: '12px',
            whiteSpace: 'nowrap',
          }}
        >
          X: {debugPosition.x.toFixed(2)} Y: {debugPosition.y.toFixed(2)} Z:{' '}
          {debugPosition.z.toFixed(2)}
        </div>
      </Html>
    </>
  )
}

'use client'

import { useRef } from 'react'
import { Group, Quaternion, Euler } from 'three'
import { Avatar } from '../Avatar'
import type { RemotePlayerData } from '../hooks/useMultiplayer'

interface RemotePlayerProps {
  /** Remote player data from server (position, rotation, animation) */
  data: RemotePlayerData
}

/**
 * Remote player avatar — renders another player's avatar at their position/rotation.
 * No physics, no camera, no keyboard controls — purely visual representation
 * driven by server data.
 */
export const RemotePlayer: React.FC<RemotePlayerProps> = ({ data }) => {
  const groupRef = useRef<Group>(null)

  // Convert quaternion from server to Euler for group rotation
  const euler = new Euler().setFromQuaternion(
    new Quaternion(
      data.rotation.x,
      data.rotation.y,
      data.rotation.z,
      data.rotation.w,
    ),
  )

  return (
    <group
      ref={groupRef}
      position={[data.position.x, data.position.y, data.position.z]}
      rotation={[euler.x, euler.y, euler.z]}
    >
      <Avatar animation={data.animation} />
    </group>
  )
}

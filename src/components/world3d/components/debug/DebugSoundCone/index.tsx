import * as THREE from 'three'

/**
 * Debug helper to visualize sound cone and range.
 * Shows inner cone (full volume), outer cone (falloff), and max distance sphere.
 */
export const DebugSoundCone: React.FC<{
  refDistance: number
  maxDistance: number
  coneInnerAngle: number
  coneOuterAngle: number
}> = ({ refDistance, maxDistance, coneInnerAngle, coneOuterAngle }) => {
  // Convert degrees to radians for cone geometry
  const innerAngleRad = THREE.MathUtils.degToRad(coneInnerAngle / 2)
  const outerAngleRad = THREE.MathUtils.degToRad(coneOuterAngle / 2)

  // Cone height = maxDistance, radius = tan(angle) * height
  const innerRadius = Math.tan(innerAngleRad) * maxDistance
  const outerRadius = Math.tan(outerAngleRad) * maxDistance

  return (
    <group>
      {/* Inner cone - full volume zone (green) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, maxDistance / 2]}>
        <coneGeometry args={[innerRadius, maxDistance, 16, 1, true]} />
        <meshBasicMaterial
          color="green"
          wireframe
          transparent
          opacity={0.5}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Outer cone - falloff zone (yellow) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, maxDistance / 2]}>
        <coneGeometry args={[outerRadius, maxDistance, 16, 1, true]} />
        <meshBasicMaterial
          color="yellow"
          wireframe
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Reference distance sphere (cyan) */}
      <mesh>
        <sphereGeometry args={[refDistance, 16, 8]} />
        <meshBasicMaterial color="cyan" wireframe transparent opacity={0.3} />
      </mesh>

      {/* Max distance sphere (red) */}
      <mesh>
        <sphereGeometry args={[maxDistance, 16, 8]} />
        <meshBasicMaterial color="red" wireframe transparent opacity={0.2} />
      </mesh>

      {/* Direction indicator arrow */}
      <arrowHelper
        args={[
          new THREE.Vector3(0, 0, 1),
          new THREE.Vector3(0, 0, 0),
          2,
          0x00ff00,
        ]}
      />
    </group>
  )
}

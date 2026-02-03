/**
 * Отладка, чтобы видеть позицию объекта
 */
export const DebugCapsuleGeometry: React.FC = () => {
  return (
    <mesh position={[0, 1, 0]}>
      <capsuleGeometry args={[0.5, 1, 8, 16]} />
      <meshBasicMaterial color="cyan" wireframe />
    </mesh>
  )
}

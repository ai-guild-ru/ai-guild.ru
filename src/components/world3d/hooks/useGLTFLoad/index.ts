/**
 * useGLTFLoad — loads a GLTF model via useGLTF and returns a cloned scene.
 * Uses SkeletonUtils.clone so each component instance gets its own
 * scene graph (Three.js objects can only have one parent).
 */

import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'

/**
 * Loads a GLTF model and returns a cloned scene safe for multiple instances.
 * Call useGLTF.preload(path) at module level for eager loading.
 */
export function useGLTFLoad(modelPath: string) {
  const { scene } = useGLTF(modelPath)

  // Clone scene per instance — Three.js object can only have one parent,
  // so sharing the same scene between Player and RemotePlayer would steal it
  const clonedScene = useMemo(() => clone(scene), [scene])

  return { scene: clonedScene }
}

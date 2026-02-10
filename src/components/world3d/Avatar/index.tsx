'use client'

import { useRef, useEffect, useMemo } from 'react'
import { useGLTF, useAnimations } from '@react-three/drei'
import { AnimationClip } from 'three'
import { AnimationName } from '../Player/interfaces'
import { useGLTFLoad } from '../hooks/useGLTFLoad'

const lft_models_pth = '/assets/gltf'
const MODEL_PATH = `${lft_models_pth}/avatars/models/avatar.glb`
const ANIMATION_PATHS = {
  idle: `${lft_models_pth}/avatars/animations/idle.glb`,
  walk: `${lft_models_pth}/avatars/animations/walk.glb`,
  run: `${lft_models_pth}/avatars/animations/run.glb`,
  jump: `${lft_models_pth}/avatars/animations/jump.glb`,
}

// Модификатор скорости — умножает базовые скорости анимаций и timeScale
const SPEED_MULTIPLIER = 1

/**
 * Удаляет root motion из анимации — убирает position track для Hips bone.
 * Это нужно, чтобы анимация не двигала модель относительно RigidBody,
 * а движение контролировалось только физикой.
 */
function removeRootMotion(clip: AnimationClip): AnimationClip {
  const newTracks = clip.tracks.filter((track) => {
    if (track.name.includes('Hips') && track.name.endsWith('.position')) {
      return false
    }
    return true
  })
  clip.tracks = newTracks
  return clip
}

useGLTF.preload(MODEL_PATH)
useGLTF.preload(ANIMATION_PATHS.idle)
useGLTF.preload(ANIMATION_PATHS.walk)
useGLTF.preload(ANIMATION_PATHS.run)
useGLTF.preload(ANIMATION_PATHS.jump)

interface AvatarProps {
  /** Current animation to play */
  animation: AnimationName
  /** Model scale (default 0.6) */
  scale?: number
}

/**
 * Avatar component — loads 3D model and animations, handles animation switching.
 * Reusable for both local player and remote players.
 */
export const Avatar: React.FC<AvatarProps> = ({ animation, scale = 0.6 }) => {
  const { scene } = useGLTFLoad(MODEL_PATH)
  const idleGltf = useGLTF(ANIMATION_PATHS.idle)
  const walkGltf = useGLTF(ANIMATION_PATHS.walk)
  const runGltf = useGLTF(ANIMATION_PATHS.run)
  const jumpGltf = useGLTF(ANIMATION_PATHS.jump)

  const animations = useMemo(
    () => [
      ...idleGltf.animations.map((clip) => {
        const c = clip.clone()
        c.name = 'idle'
        return c
      }),
      ...walkGltf.animations.map((clip) => {
        const c = clip.clone()
        c.name = 'walk'
        return removeRootMotion(c)
      }),
      ...runGltf.animations.map((clip) => {
        const c = clip.clone()
        c.name = 'run'
        return removeRootMotion(c)
      }),
      ...jumpGltf.animations.map((clip) => {
        const c = clip.clone()
        c.name = 'jump'
        return c
      }),
    ],
    [
      idleGltf.animations,
      jumpGltf.animations,
      runGltf.animations,
      walkGltf.animations,
    ],
  )

  const sceneRef = useRef(scene)
  sceneRef.current = scene

  const { actions } = useAnimations(animations, sceneRef)

  // Animation switching effect — crossfade between animations
  useEffect(() => {
    if (actions[animation]) {
      Object.values(actions).forEach((action) => action?.fadeOut(0.2))
      const action = actions[animation]
      action?.reset().fadeIn(0.2).play()
      // Ускоряем анимацию пропорционально модификатору скорости
      if (action && (animation === 'walk' || animation === 'run')) {
        action.timeScale = SPEED_MULTIPLIER
      }
    } else {
      console.error('[Avatar] Animation not found:', animation)
    }
  }, [animation, actions])

  return <primitive object={scene} scale={scale} />
}

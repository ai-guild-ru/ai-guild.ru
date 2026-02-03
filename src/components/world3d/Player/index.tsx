'use client'

import { useRef, useState, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { RigidBody, CapsuleCollider } from '@react-three/rapier'
import {
  useKeyboardControls,
  Html,
  useGLTF,
  useAnimations,
} from '@react-three/drei'
import { Vector3, Group, AnimationClip } from 'three'
import type { RapierRigidBody } from '@react-three/rapier'
import { ThirdPersonCamera } from '../ThirdPersonCamera'
import { DebugOverlay } from '../DebugOverlay'

const lft_models_pth = '/assets/gltf'
const MODEL_PATH = `${lft_models_pth}/avatars/models/avatar.glb`
const ANIMATION_PATHS = {
  idle: `${lft_models_pth}/avatars/animations/idle.glb`,
  walk: `${lft_models_pth}/avatars/animations/walk.glb`,
  run: `${lft_models_pth}/avatars/animations/run.glb`,
  jump: `${lft_models_pth}/avatars/animations/jump.glb`,
}

type AnimationName = 'idle' | 'walk' | 'run' | 'jump'

// Модификатор скорости — умножает базовые скорости анимаций и timeScale
const SPEED_MULTIPLIER = 1
// Базовые скорости из анализа анимаций (units/sec), умноженные на модификатор
const WALK_SPEED = 3.5248 * SPEED_MULTIPLIER
const RUN_SPEED = 11.6508 * SPEED_MULTIPLIER
const JUMP_FORCE = 5

interface Position {
  x: number
  y: number
  z: number
}

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

/**
 * Компонент игрока с физикой и анимациями.
 * Использует RigidBody для физического тела и CapsuleCollider для коллизий.
 * Анимации загружаются из отдельных GLB файлов и применяются к модели.
 */
export const Player: React.FC = () => {
  const rigidBodyRef = useRef<RapierRigidBody>(null)
  const rigidBodyGroupRef = useRef<Group>(null)
  const avatarRef = useRef<Group>(null)
  const [debugPosition, setDebugPosition] = useState<Position>({
    x: 0,
    y: 0,
    z: 0,
  })
  const [currentAnimation, setCurrentAnimation] =
    useState<AnimationName>('idle')
  const frameCount = useRef(0)
  const [, getKeys] = useKeyboardControls()

  const { scene } = useGLTF(MODEL_PATH)
  const idleGltf = useGLTF(ANIMATION_PATHS.idle)
  const walkGltf = useGLTF(ANIMATION_PATHS.walk)
  const runGltf = useGLTF(ANIMATION_PATHS.run)
  const jumpGltf = useGLTF(ANIMATION_PATHS.jump)

  const animations = useMemo(
    () => [
      ...idleGltf.animations.map((clip) => {
        clip.name = 'idle'
        return clip
      }),
      ...walkGltf.animations.map((clip) => {
        clip.name = 'walk'
        return removeRootMotion(clip)
      }),
      ...runGltf.animations.map((clip) => {
        clip.name = 'run'
        return removeRootMotion(clip)
      }),
      ...jumpGltf.animations.map((clip) => {
        clip.name = 'jump'
        return clip
      }),
    ],
    [
      idleGltf.animations,
      jumpGltf.animations,
      runGltf.animations,
      walkGltf.animations,
    ],
  )

  const sceneRef = useRef<Group>(scene as unknown as Group)
  sceneRef.current = scene as unknown as Group

  const { actions } = useAnimations(animations, sceneRef)

  // Debug: log animation state
  // useEffect(() => {
  //   console.log(
  //     '[Player] Animations loaded:',
  //     animations.length,
  //     animations.map((a) => a.name),
  //   )
  //   console.log('[Player] Actions available:', Object.keys(actions))
  //   console.log('[Player] avatarRef.current:', avatarRef.current)
  //   console.log('[Player] scene:', scene)
  //   console.log('[Player] mixer:', mixer)
  // }, [animations, actions, scene, mixer])

  useEffect(() => {
    if (actions[currentAnimation]) {
      Object.values(actions).forEach((action) => action?.fadeOut(0.2))
      const action = actions[currentAnimation]
      action?.reset().fadeIn(0.2).play()
      // Ускоряем анимацию пропорционально модификатору скорости
      if (currentAnimation === 'walk' || currentAnimation === 'run') {
        action.timeScale = SPEED_MULTIPLIER
      }
    } else {
      console.error('[Player] Animation not found:', currentAnimation)
    }
  }, [currentAnimation, actions])

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

    const isMoving = forward || backward || left || right
    let newAnimation: AnimationName = 'idle'
    if (!isOnGround) {
      newAnimation = 'jump'
    } else if (isMoving) {
      newAnimation = run ? 'run' : 'walk'
    }
    if (newAnimation !== currentAnimation) {
      setCurrentAnimation(newAnimation)
    }

    if (isMoving && avatarRef.current) {
      const angle = Math.atan2(direction.x, direction.z)
      avatarRef.current.rotation.y = angle
    }

    frameCount.current++
    if (frameCount.current % 10 === 0) {
      setDebugPosition({ x: position.x, y: position.y, z: position.z })
    }
  })

  // useEffect(() => {
  //   console.log('Player mounted')

  //   return () => {
  //     console.error('Player unmounted')
  //   }
  // }, [])

  // console.log('Player rendering')

  // console.log(
  //   'Player position',
  //   `X: ${debugPosition.x.toFixed(2)} Y: ${debugPosition.y.toFixed(2)} Z:{' '}
  //         ${debugPosition.z.toFixed(2)}`,
  // )

  return (
    <>
      {/* Физическое тело игрока — динамический RigidBody с капсульным коллайдером */}
      <RigidBody
        ref={rigidBodyRef}
        colliders={false}
        mass={1}
        type="dynamic"
        position={[0, 2, 0]}
        enabledRotations={[false, false, false]}
        linearDamping={0.5}
        // rotation={[0, 1.8, 0]}
        rotation={[0, 0, 0]}
      >
        {/* Группа-обёртка для отслеживания визуального объекта RigidBody */}
        <group ref={rigidBodyGroupRef}>
          {/* Капсульный коллайдер для физических столкновений */}
          <CapsuleCollider args={[0.5, 0.5]} position={[0, 1, 0]} />
          {/* Wireframe mesh для визуализации границ коллайдера (отладка) */}
          <mesh position={[0, 1, 0]}>
            <capsuleGeometry args={[0.5, 1, 8, 16]} />
            <meshBasicMaterial color="cyan" wireframe />
          </mesh>
          {/* Группа для аватара — вращается при движении */}
          <group ref={avatarRef} position={[0, 0, 0]}>
            {/* 3D модель персонажа */}
            <primitive object={scene} scale={0.6} />
          </group>
          {/* Камера третьего лица — дочерний объект RigidBody, вращается мышкой */}
          <ThirdPersonCamera />
        </group>
      </RigidBody>
      {/* HTML overlay для отображения координат (отладка) */}
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
      {/* Компонент отладки — отображает направления объектов */}
      <DebugOverlay rigidBodyRef={rigidBodyGroupRef} avatarRef={avatarRef} />
    </>
  )
}

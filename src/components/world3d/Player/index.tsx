'use client'

import { useRef, useEffect, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { RigidBody, CapsuleCollider } from '@react-three/rapier'
import { useKeyboardControls } from '@react-three/drei'
import { Vector3, Quaternion, Group, AudioListener } from 'three'
import type { RapierRigidBody } from '@react-three/rapier'
import { ThirdPersonCamera } from '../ThirdPersonCamera'
import { Avatar } from '../Avatar'
import { usePlayerReducer } from './hooks/usePlayerReducer'
import { AnimationName } from './interfaces'
import type { LocalPlayerState } from '../hooks/useMultiplayer'
import { DebugCapsuleGeometry } from '../components/debug/DebugCapsuleGeometry'
import { DebugAvatarGeometry } from '../components/debug/DebugAvatarGeometry'
import { DebugOverlay } from '../components/debug/DebugOverlay'

const TURN_SPEED = 2.5 // Скорость поворота (радиан/сек)
const MOUSE_SENSITIVITY = 0.005
const MIN_PITCH = -Math.PI / 6 // Минимальный pitch (смотрим вверх)
const MAX_PITCH = Math.PI / 3 // Максимальный pitch (смотрим вниз)

// Базовые скорости из анализа анимаций (units/sec)
const WALK_SPEED = 3.5248
const RUN_SPEED = 11.6508
const JUMP_FORCE = 5

type PlayerProps = {
  debug: boolean
  /** Callback to send local player state to multiplayer server (called every frame, internally throttled) */
  sendPlayerState?: (state: LocalPlayerState) => void
  /** Ref to expose the AudioListener instance for external control (e.g. world mute) */
  audioListenerRef: React.MutableRefObject<AudioListener | null>
}

/**
 * Компонент игрока с физикой и анимациями.
 * Использует RigidBody для физического тела и CapsuleCollider для коллизий.
 * Анимации загружаются из отдельных GLB файлов и применяются к модели.
 */
export const Player: React.FC<PlayerProps> = ({
  debug,
  sendPlayerState,
  audioListenerRef,
}) => {
  // === Refs ===
  // rigidBodyRef — ссылка на физическое тело Rapier для управления скоростью и позицией
  const rigidBodyRef = useRef<RapierRigidBody>(null)
  // rigidBodyGroupRef — группа-обёртка внутри RigidBody, к ней применяется визуальный поворот
  const rigidBodyGroupRef = useRef<Group>(null)
  // avatarRef — группа с 3D моделью персонажа
  const avatarRef = useRef<Group>(null)
  // headRef — точка "головы" для AudioListener
  const headRef = useRef<Group>(null)

  // === State ===
  // Централизованное состояние игрока через reducer (анимация, debug позиция)
  const [state, dispatch] = usePlayerReducer()
  // Угол поворота персонажа (в ref для мгновенного обновления в useFrame)
  const rotationRef = useRef(0)
  // Флаг для однократного разворота на 180° при нажатии S
  const wasBackwardRef = useRef(false)
  // Вертикальный угол камеры (pitch) — управляется мышкой
  const cameraPitchRef = useRef(0.2)
  const [cameraPitch, setCameraPitch] = useState(0.2)
  // Горизонтальный угол камеры (yaw) — дополнительный поворот относительно аватара
  const [cameraYaw, setCameraYaw] = useState(0)
  // Флаг для отслеживания зажатия мыши
  const isDragging = useRef(false)

  // === Input ===
  // Получение состояния клавиш (WASD, Shift, Space)
  const [, getKeys] = useKeyboardControls()
  const { gl } = useThree()

  // === Обработка мыши ===
  useEffect(() => {
    const canvas = gl.domElement

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        isDragging.current = true
      }
    }

    const onMouseUp = () => {
      isDragging.current = false
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) {
        return
      }

      // Горизонталь: движение мыши влево -> поворот аватара влево
      rotationRef.current -= e.movementX * MOUSE_SENSITIVITY

      // Вертикаль: тянем вниз -> камера опускается (смотрим вверх)
      cameraPitchRef.current += e.movementY * MOUSE_SENSITIVITY
      cameraPitchRef.current = Math.max(
        MIN_PITCH,
        Math.min(MAX_PITCH, cameraPitchRef.current),
      )
      setCameraPitch(cameraPitchRef.current)
    }

    canvas.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('mousemove', onMouseMove)

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('mousemove', onMouseMove)
    }
  }, [gl])

  // AudioListener attached to head group for spatial audio
  useEffect(() => {
    const head = headRef.current
    if (!head) {
      return
    }

    const listener = new AudioListener()
    head.add(listener)

    // Expose listener to parent via ref
    audioListenerRef.current = listener

    // Resume AudioContext on user interaction (browser autoplay policy)
    const resumeContext = () => {
      if (listener.context.state === 'suspended') {
        listener.context.resume()
      }
    }

    document.addEventListener('click', resumeContext)
    document.addEventListener('keydown', resumeContext)

    return () => {
      document.removeEventListener('click', resumeContext)
      document.removeEventListener('keydown', resumeContext)
      head.remove(listener)
      if (audioListenerRef) {
        audioListenerRef.current = null
      }
    }
  }, [audioListenerRef])

  // Вектор направления движения (переиспользуется каждый кадр)
  const direction = new Vector3()

  /**
   * Основной игровой цикл — вызывается каждый кадр.
   * Обрабатывает ввод, обновляет физику и состояние анимации.
   */
  useFrame((_, delta) => {
    if (!rigidBodyRef.current) {
      return
    }

    // --- Чтение ввода ---
    const { forward, backward, left, right, run, jump } = getKeys()

    // --- Получение текущего состояния физики ---
    const velocity = rigidBodyRef.current.linvel()
    const position = rigidBodyRef.current.translation()

    // --- Расчёт скорости ---
    const speed = run ? RUN_SPEED : WALK_SPEED

    // --- Обработка поворота (A/D) ---
    // A — поворот влево (увеличение угла)
    if (left) {
      rotationRef.current += TURN_SPEED * delta
    }
    // D — поворот вправо (уменьшение угла)
    if (right) {
      rotationRef.current -= TURN_SPEED * delta
    }

    // --- Обработка разворота (S) ---
    // При нажатии S — разворот на 180° (персонаж идёт на камеру)
    if (backward && !forward && !wasBackwardRef.current) {
      rotationRef.current += Math.PI
      wasBackwardRef.current = true
    }
    // При отпускании S — сброс флага для следующего разворота
    if (!backward) {
      wasBackwardRef.current = false
    }

    // Обновляем yaw камеры: при движении назад — поворот на 180°
    const newCameraYaw = backward && !forward ? Math.PI : 0
    if (newCameraYaw !== cameraYaw) {
      setCameraYaw(newCameraYaw)
    }

    // --- Расчёт направления движения ---
    // W или S — движение вперёд в направлении взгляда персонажа
    const isMovingForward = forward || backward
    if (isMovingForward) {
      // Вектор движения: sin/cos от угла поворота * скорость
      direction.set(
        Math.sin(rotationRef.current) * speed,
        0,
        Math.cos(rotationRef.current) * speed,
      )
    } else {
      direction.set(0, 0, 0)
    }

    // --- Применение скорости к физическому телу ---
    // Сохраняем вертикальную скорость (гравитация/прыжок)
    rigidBodyRef.current.setLinvel(
      { x: direction.x, y: velocity.y, z: direction.z },
      true,
    )

    // --- Обработка прыжка ---
    const isOnGround = position.y < 1.1
    if (jump && isOnGround) {
      rigidBodyRef.current.setLinvel(
        { x: velocity.x, y: JUMP_FORCE, z: velocity.z },
        true,
      )
    }

    // --- Определение анимации ---
    let newAnimation: AnimationName = 'idle'
    if (!isOnGround) {
      newAnimation = 'jump'
    } else if (isMovingForward) {
      newAnimation = run ? 'run' : 'walk'
    }
    dispatch({ type: 'SET_ANIMATION', payload: newAnimation })

    // --- Применение визуального поворота ---
    // Поворачиваем группу (аватар + камера) в направлении движения
    if (rigidBodyGroupRef.current) {
      rigidBodyGroupRef.current.rotation.y = rotationRef.current
    }

    // --- Отправка состояния на сервер мультиплеера ---
    if (sendPlayerState) {
      // Convert yaw angle to quaternion for server protocol
      const q = new Quaternion()
      q.setFromAxisAngle(new Vector3(0, 1, 0), rotationRef.current)
      sendPlayerState({
        position: { x: position.x, y: position.y, z: position.z },
        rotation: { x: q.x, y: q.y, z: q.z, w: q.w },
        animation: newAnimation,
      })
    }
  })

  return (
    <>
      {/* Физическое тело игрока — динамический RigidBody с капсульным коллайдером */}
      <RigidBody
        ref={rigidBodyRef}
        colliders={false}
        mass={1}
        type="dynamic"
        position={[0, 2, -10]}
        rotation={[0, 0, 0]}
        enabledRotations={[false, false, false]}
        linearDamping={0.5}
      >
        {/* Группа-обёртка для отслеживания визуального объекта RigidBody */}
        <group ref={rigidBodyGroupRef}>
          {/* Head group — AudioListener attachment point.
             rotation={[0, Math.PI, 0]} — разворот на 180° для корректной
             ориентации AudioListener. Без этого лево-право инвертированы,
             т.к. модель аватара создана с "передом" в +Z, а Three.js ожидает -Z. */}
          <group
            ref={headRef}
            position={[0, 2.1, 0]}
            rotation={[0, Math.PI, 0]}
          >
            {/* Debug ring for AudioListener position */}
            {debug && (
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.9, 1, 32]} />
                <meshBasicMaterial color="orange" side={2} />
              </mesh>
            )}
          </group>
          {/* Капсульный коллайдер для физических столкновений */}
          <CapsuleCollider args={[0.5, 0.5]} position={[0, 1, 0]} />
          {/* Wireframe mesh для визуализации границ коллайдера (отладка) */}

          {debug && <DebugCapsuleGeometry />}

          {/* Группа для аватара — вращается при движении */}
          <group ref={avatarRef} position={[0, 0, 0]}>
            <Avatar animation={state.animation} />
          </group>
          {/* Камера третьего лица — дочерний объект RigidBody */}
          <ThirdPersonCamera pitch={cameraPitch} yaw={cameraYaw} />
        </group>
      </RigidBody>
      {/* HTML overlay для отображения координат (отладка) */}
      {debug && (
        <DebugOverlay
          title="Avatar coords"
          style={{
            bottom: 280,
          }}
        >
          <>
            X: {state.debugPosition.x.toFixed(2)} Y:{' '}
            {state.debugPosition.y.toFixed(2)} Z:{' '}
            {state.debugPosition.z.toFixed(2)}
          </>
        </DebugOverlay>
      )}
      {/* Компонент отладки — отображает направления объектов */}
      {debug && (
        <DebugAvatarGeometry
          rigidBodyRef={rigidBodyGroupRef}
          avatarRef={avatarRef}
        />
      )}
    </>
  )
}

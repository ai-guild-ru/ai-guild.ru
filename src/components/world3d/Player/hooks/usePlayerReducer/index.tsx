import { useReducer } from 'react'
import { AnimationName } from '../../interfaces'

/**
 * Состояние игрока.
 * - animation: текущая анимация (idle, walk, run, jump)
 * - rotation: угол поворота персонажа в радианах (0 = смотрит вдоль +Z)
 * - wasBackward: флаг для однократного разворота на 180° при нажатии S
 * - debugPosition: позиция для отладочного overlay
 */
interface PlayerState {
  animation: AnimationName
  rotation: number
  wasBackward: boolean
  debugPosition: { x: number; y: number; z: number }
}

/**
 * Действия для управления состоянием игрока.
 * - SET_ANIMATION: смена анимации (игнорируется если уже активна)
 * - TURN_LEFT/TURN_RIGHT: поворот персонажа на заданный угол (A/D клавиши)
 * - REVERSE: разворот на 180° при нажатии S (срабатывает однократно)
 * - RESET_BACKWARD: сброс флага wasBackward при отпускании S
 * - SET_DEBUG_POSITION: обновление позиции для отладки
 */
type PlayerAction =
  | { type: 'SET_ANIMATION'; payload: AnimationName }
  | { type: 'TURN_LEFT'; payload: number }
  | { type: 'TURN_RIGHT'; payload: number }
  | { type: 'REVERSE' }
  | { type: 'RESET_BACKWARD' }
  | { type: 'SET_DEBUG_POSITION'; payload: { x: number; y: number; z: number } }

const initialPlayerState: PlayerState = {
  animation: 'idle',
  rotation: 0,
  wasBackward: false,
  debugPosition: { x: 0, y: 0, z: 0 },
}

/**
 * Reducer для управления состоянием игрока.
 * Чистая функция — не мутирует state, возвращает новый объект при изменениях.
 */
function playerReducer(state: PlayerState, action: PlayerAction): PlayerState {
  switch (action.type) {
    // Смена анимации — пропускаем если уже активна (избегаем лишних ре-рендеров)
    case 'SET_ANIMATION':
      if (state.animation === action.payload) {
        return state
      }
      return { ...state, animation: action.payload }

    // Поворот влево — увеличиваем угол (против часовой стрелки)
    case 'TURN_LEFT':
      return { ...state, rotation: state.rotation + action.payload }

    // Поворот вправо — уменьшаем угол (по часовой стрелке)
    case 'TURN_RIGHT':
      return { ...state, rotation: state.rotation - action.payload }

    // Разворот на 180° — срабатывает только один раз при зажатии S
    case 'REVERSE':
      if (state.wasBackward) {
        return state
      }
      return { ...state, rotation: state.rotation + Math.PI, wasBackward: true }

    // Сброс флага разворота — при отпускании S
    case 'RESET_BACKWARD':
      if (!state.wasBackward) {
        return state
      }
      return { ...state, wasBackward: false }

    // Обновление позиции для отладочного overlay
    case 'SET_DEBUG_POSITION':
      return { ...state, debugPosition: action.payload }

    default:
      return state
  }
}

/**
 * Хук для управления состоянием игрока через reducer.
 * Возвращает [state, dispatch] — текущее состояние и функцию отправки действий.
 */
export function usePlayerReducer() {
  return useReducer(playerReducer, initialPlayerState)
}

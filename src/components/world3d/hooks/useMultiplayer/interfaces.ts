/**
 * Multiplayer shared types — used by hook, reducer, and consumer components.
 */

export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface Quaternion {
  x: number
  y: number
  z: number
  w: number
}

export type AnimationName = 'idle' | 'walk' | 'run' | 'jump'

/** Remote player data received from server */
export interface RemotePlayerData {
  playerId: string
  username: string | null
  position: Vec3
  rotation: Quaternion
  animation: AnimationName
}

/** Local player state to send to server */
export interface LocalPlayerState {
  position: Vec3
  rotation: Quaternion
  animation: AnimationName
}

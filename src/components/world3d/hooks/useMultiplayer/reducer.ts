/**
 * Multiplayer state reducer — manages remote players map.
 * Pure state management, no side effects.
 */

import type { RemotePlayerData } from './interfaces'

// --- State ---

export interface MultiplayerState {
  remotePlayers: Map<string, RemotePlayerData>
}

export const initialMultiplayerState: MultiplayerState = {
  remotePlayers: new Map(),
}

// --- Actions ---

type MultiplayerAction =
  | { type: 'WORLD_STATE'; players: RemotePlayerData[] }
  | { type: 'PLAYER_LEFT'; playerId: string }
  | { type: 'RESET' }

// --- Reducer ---

export function multiplayerReducer(
  state: MultiplayerState,
  action: MultiplayerAction,
): MultiplayerState {
  switch (action.type) {
    // Replace entire remote players map from server snapshot
    case 'WORLD_STATE': {
      const next = new Map<string, RemotePlayerData>()
      for (const p of action.players) {
        next.set(p.playerId, p)
      }
      return { ...state, remotePlayers: next }
    }

    // Remove a single player
    case 'PLAYER_LEFT': {
      const next = new Map(state.remotePlayers)
      next.delete(action.playerId)
      return { ...state, remotePlayers: next }
    }

    // Clear all state (disconnect / cleanup)
    case 'RESET':
      return initialMultiplayerState

    default:
      return state
  }
}

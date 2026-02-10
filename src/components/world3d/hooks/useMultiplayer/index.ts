import { useEffect, useRef, useCallback } from 'react'

/**
 * Multiplayer WebSocket hook — connects to world3d WS server.
 * Handles: connection with JWT auth, heartbeat (pong), reconnection.
 * Phase 1: connection only, no state sync yet.
 */

// Message types matching docker/world3d/src/protocol.ts
const S2C_PING = 'ping'
const S2C_PLAYER_JOINED = 'player_joined'
const S2C_PLAYER_LEFT = 'player_left'
const S2C_WORLD_STATE = 'world_state'
const S2C_ERROR = 'error'
const C2S_PONG = 'pong'

const WS_URL = process.env.NEXT_PUBLIC_WORLD3D_WS_URL || 'ws://localhost:4100'
const RECONNECT_DELAY = 3000

interface UseMultiplayerOptions {
  /** Whether multiplayer connection is enabled */
  enabled: boolean
}

/**
 * Hook for multiplayer WebSocket connection to world3d server.
 * Automatically connects when enabled and user has a JWT token.
 * Handles heartbeat (pong responses) and reconnection.
 */
export function useMultiplayer({ enabled }: UseMultiplayerOptions) {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  const cleanup = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }, [])

  const connect = useCallback(() => {
    if (!enabledRef.current) {
      return
    }

    const token =
      typeof globalThis !== 'undefined' && 'localStorage' in globalThis
        ? globalThis.localStorage?.getItem('token')
        : null

    if (!token) {
      // No token — not authenticated, skip connection
      return
    }

    cleanup()

    const ws = new WebSocket(`${WS_URL}?token=${token}`)
    wsRef.current = ws

    ws.onopen = () => {
      // eslint-disable-next-line no-console
      console.log('[multiplayer] Connected to world3d server')
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string)
        if (!msg || typeof msg.type !== 'string') {
          return
        }

        switch (msg.type) {
          case S2C_PING:
            // Respond to heartbeat
            ws.send(JSON.stringify({ type: C2S_PONG }))
            break

          case S2C_PLAYER_JOINED:
            // eslint-disable-next-line no-console
            console.log(
              `[multiplayer] Player joined: ${msg.playerId}`,
              msg.username,
            )
            break

          case S2C_PLAYER_LEFT:
            // eslint-disable-next-line no-console
            console.log(`[multiplayer] Player left: ${msg.playerId}`)
            break

          case S2C_WORLD_STATE:
            // eslint-disable-next-line no-console
            console.log(
              `[multiplayer] World state: ${msg.players?.length ?? 0} players`,
            )
            break

          case S2C_ERROR:
            console.error(`[multiplayer] Server error: ${msg.message}`)
            break
        }
      } catch {
        // Ignore invalid messages
      }
    }

    ws.onclose = (event) => {
      // eslint-disable-next-line no-console
      console.log(
        `[multiplayer] Disconnected (code: ${event.code}, reason: ${event.reason})`,
      )
      wsRef.current = null

      // Reconnect unless intentionally closed or disabled
      if (enabledRef.current && event.code !== 1000) {
        reconnectTimerRef.current = setTimeout(connect, RECONNECT_DELAY)
      }
    }

    ws.onerror = () => {
      // onclose will fire after onerror, reconnect handled there
    }
  }, [cleanup])

  useEffect(() => {
    if (enabled) {
      connect()
    } else {
      cleanup()
    }

    return cleanup
  }, [enabled, connect, cleanup])

  return { wsRef }
}

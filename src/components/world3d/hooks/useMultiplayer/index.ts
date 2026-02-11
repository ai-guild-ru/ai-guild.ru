/* eslint-disable no-console */
import { useEffect, useRef, useCallback, useReducer, useState } from 'react'
import { multiplayerReducer, initialMultiplayerState } from './reducer'
import type { LocalPlayerState } from './interfaces'

export type { RemotePlayerData, LocalPlayerState } from './interfaces'

export type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'error'
  | 'session_replaced'

/**
 * Multiplayer WebSocket hook — connects to world3d WS server.
 * Handles: connection with JWT auth, heartbeat (pong), reconnection,
 * remote players state (via reducer), and adaptive player state sending.
 */

// Message types matching docker/world3d/src/protocol.ts
const S2C_PING = 'ping'
const S2C_PLAYER_JOINED = 'player_joined'
const S2C_PLAYER_LEFT = 'player_left'
const S2C_WORLD_STATE = 'world_state'
const S2C_ERROR = 'error'
const S2C_OFFER = 'offer'
const S2C_ANSWER = 'answer'
const S2C_ICE_CANDIDATE = 'ice_candidate'
const S2C_TURN_CREDENTIALS = 'turn_credentials'
const C2S_PONG = 'pong'
const C2S_PLAYER_STATE = 'player_state'

const WS_URL = process.env.NEXT_PUBLIC_WORLD3D_WS_URL || 'ws://localhost:4100'
const RECONNECT_DELAY = 3000
const WS_CLOSE_SESSION_REPLACED = 4009

// Adaptive send rate thresholds (ms)
const SEND_INTERVAL_IDLE = 3000
const SEND_INTERVAL_ACTIVE = 500

// Minimum position change to consider "active" movement
const POSITION_CHANGE_THRESHOLD = 0.01

/** TURN server credentials received from world3d server */
export interface TurnCredentials {
  urls: string[]
  username: string
  credential: string
  ttl: number
}

/** WebRTC signaling message relayed through world3d WS server */
export type SignalingMessage =
  | { type: 'offer'; fromPlayerId: string; sdp: string }
  | { type: 'answer'; fromPlayerId: string; sdp: string }
  | { type: 'ice_candidate'; fromPlayerId: string; candidate: string }

interface UseMultiplayerOptions {
  /** Whether multiplayer connection is enabled */
  enabled: boolean
}

/**
 * Hook for multiplayer WebSocket connection to world3d server.
 * Automatically connects when enabled and user has a JWT token.
 * Handles heartbeat, reconnection, remote players state, and adaptive state sending.
 */
export function useMultiplayer({ enabled }: UseMultiplayerOptions) {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>('idle')
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  // Callback ref for signaling messages — set by useVoiceChat
  const onSignalingMessageRef = useRef<
    ((msg: SignalingMessage) => void) | null
  >(null)
  // TURN credentials received from server
  const turnCredentialsRef = useRef<TurnCredentials | null>(null)

  const [state, dispatch] = useReducer(
    multiplayerReducer,
    initialMultiplayerState,
  )

  // Adaptive send rate state (refs for use in useFrame without re-renders)
  const lastSentStateRef = useRef<LocalPlayerState | null>(null)
  const lastSendTimeRef = useRef(0)

  const cleanup = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
    if (wsRef.current) {
      wsRef.current.close(1000, 'unmount')
      wsRef.current = null
    }
    dispatch({ type: 'RESET' })
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

    setConnectionStatus('connecting')

    const ws = new WebSocket(`${WS_URL}?token=${token}`)
    wsRef.current = ws

    ws.onopen = () => {
      console.log('[multiplayer] Connected to world3d server')
      setConnectionStatus('connected')
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
            console.log(
              `[multiplayer] Player joined: ${msg.playerId}`,
              msg.username,
            )
            break

          case S2C_PLAYER_LEFT:
            console.log(`[multiplayer] Player left: ${msg.playerId}`)
            dispatch({ type: 'PLAYER_LEFT', playerId: msg.playerId })
            break

          case S2C_WORLD_STATE:
            dispatch({ type: 'WORLD_STATE', players: msg.players })
            break

          case S2C_ERROR:
            console.error(`[multiplayer] Server error: ${msg.message}`)
            break

          case S2C_TURN_CREDENTIALS:
            turnCredentialsRef.current = {
              urls: msg.urls,
              username: msg.username,
              credential: msg.credential,
              ttl: msg.ttl,
            }

            console.log('[multiplayer] Received TURN credentials')
            break

          case S2C_OFFER:
          case S2C_ANSWER:
          case S2C_ICE_CANDIDATE:
            // Forward signaling messages to voice chat hook
            if (onSignalingMessageRef.current) {
              onSignalingMessageRef.current(msg)
            }
            break
        }
      } catch {
        // Ignore invalid messages
      }
    }

    ws.onclose = (event) => {
      console.log(
        `[multiplayer] Disconnected (code: ${event.code}, reason: ${event.reason})`,
      )
      wsRef.current = null

      if (event.code === WS_CLOSE_SESSION_REPLACED) {
        // Session replaced — do not reconnect, wait for user action
        console.warn('[multiplayer] Session replaced by another tab/window')
        setConnectionStatus('session_replaced')
      } else if (enabledRef.current && event.code !== 1000) {
        // Connection lost unexpectedly — set error and schedule reconnect
        setConnectionStatus('error')
        reconnectTimerRef.current = setTimeout(connect, RECONNECT_DELAY)
      }
    }

    ws.onerror = () => {
      // onclose will fire after onerror, reconnect handled there
    }
  }, [cleanup])

  /**
   * Send local player state to server with adaptive throttling.
   * Call this every frame from useFrame — it will internally throttle.
   * - Active movement: sends every ~500ms
   * - Idle (no position change): sends every ~3s
   * - Skips send if state hasn't changed at all
   */
  const sendPlayerState = useCallback((playerState: LocalPlayerState) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return
    }

    const now = Date.now()
    const last = lastSentStateRef.current
    const elapsed = now - lastSendTimeRef.current

    // Determine if position changed significantly
    const positionChanged =
      !last ||
      Math.abs(playerState.position.x - last.position.x) >
        POSITION_CHANGE_THRESHOLD ||
      Math.abs(playerState.position.y - last.position.y) >
        POSITION_CHANGE_THRESHOLD ||
      Math.abs(playerState.position.z - last.position.z) >
        POSITION_CHANGE_THRESHOLD

    // Determine if animation changed
    const animationChanged = !last || playerState.animation !== last.animation

    // Adaptive interval: active movement → faster, idle → slower
    const interval = positionChanged ? SEND_INTERVAL_ACTIVE : SEND_INTERVAL_IDLE

    // Skip if not enough time elapsed and nothing important changed
    if (elapsed < interval && !animationChanged) {
      return
    }

    // Skip if absolutely nothing changed and we already sent at least once
    if (last && !positionChanged && !animationChanged) {
      return
    }

    ws.send(
      JSON.stringify({
        type: C2S_PLAYER_STATE,
        position: playerState.position,
        rotation: playerState.rotation,
        animation: playerState.animation,
      }),
    )

    lastSentStateRef.current = { ...playerState }
    lastSendTimeRef.current = now
  }, [])

  useEffect(() => {
    if (enabled) {
      connect()
    } else {
      cleanup()
    }

    return cleanup
  }, [enabled, connect, cleanup])

  return {
    wsRef,
    remotePlayers: state.remotePlayers,
    sendPlayerState,
    onSignalingMessageRef,
    turnCredentialsRef,
    connectionStatus,
    reconnect: connect,
  }
}

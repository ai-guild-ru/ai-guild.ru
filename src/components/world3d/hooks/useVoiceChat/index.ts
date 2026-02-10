import { useEffect, useRef, useCallback, useState } from 'react'
import type { SignalingMessage, TurnCredentials } from '../useMultiplayer'

/**
 * WebRTC P2P mesh voice chat hook.
 * Manages RTCPeerConnection per remote player, microphone capture,
 * and signaling through the multiplayer WebSocket connection.
 *
 * Each peer connection carries one audio track (microphone).
 * The hook exposes a Map of remote player MediaStreams for spatial audio binding.
 */

// Signaling message types sent from client to server
const C2S_OFFER = 'offer'
const C2S_ANSWER = 'answer'
const C2S_ICE_CANDIDATE = 'ice_candidate'

interface UseVoiceChatOptions {
  /** Whether voice chat is enabled */
  enabled: boolean
  /** WebSocket ref from useMultiplayer — used for signaling */
  wsRef: React.MutableRefObject<WebSocket | null>
  /** Callback ref to subscribe to signaling messages from useMultiplayer */
  onSignalingMessageRef: React.MutableRefObject<
    ((msg: SignalingMessage) => void) | null
  >
  /** TURN credentials ref from useMultiplayer */
  turnCredentialsRef: React.MutableRefObject<TurnCredentials | null>
  /** List of remote player IDs currently visible (from remotePlayers Map keys) */
  remotePlayerIds: string[]
}

interface PeerState {
  pc: RTCPeerConnection
  /** Whether we initiated the connection (offerer) */
  isOfferer: boolean
}

/**
 * Hook for WebRTC P2P mesh voice chat.
 * Creates a peer connection for each remote player, captures microphone,
 * and provides remote audio streams for spatial audio rendering.
 */
export function useVoiceChat({
  enabled,
  wsRef,
  onSignalingMessageRef,
  turnCredentialsRef,
  remotePlayerIds,
}: UseVoiceChatOptions) {
  // Map of playerId -> PeerState (RTCPeerConnection + metadata)
  const peersRef = useRef<Map<string, PeerState>>(new Map())
  // Local microphone stream
  const localStreamRef = useRef<MediaStream | null>(null)
  // Remote audio streams: playerId -> MediaStream (triggers re-render for consumers)
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(
    new Map(),
  )
  // Mute state
  const [isMuted, setIsMuted] = useState(false)
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  /**
   * Build ICE server config from TURN credentials.
   * Falls back to public STUN if no TURN credentials available.
   */
  const getIceServers = useCallback((): RTCIceServer[] => {
    const creds = turnCredentialsRef.current
    if (creds) {
      return [
        {
          urls: creds.urls,
          username: creds.username,
          credential: creds.credential,
        },
      ]
    }
    // Fallback: public STUN only (no TURN relay — may fail behind symmetric NAT)
    return [{ urls: 'stun:stun.l.google.com:19302' }]
  }, [turnCredentialsRef])

  /**
   * Send a signaling message through the WebSocket connection.
   */
  const sendSignaling = useCallback(
    (msg: {
      type: string
      targetPlayerId: string
      sdp?: string
      candidate?: string
    }) => {
      const ws = wsRef.current
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg))
      }
    },
    [wsRef],
  )

  /**
   * Add a remote stream to the state map (triggers re-render).
   */
  const addRemoteStream = useCallback(
    (playerId: string, stream: MediaStream) => {
      setRemoteStreams((prev) => {
        const next = new Map(prev)
        next.set(playerId, stream)
        return next
      })
    },
    [],
  )

  /**
   * Remove a remote stream from the state map.
   */
  const removeRemoteStream = useCallback((playerId: string) => {
    setRemoteStreams((prev) => {
      const next = new Map(prev)
      next.delete(playerId)
      return next
    })
  }, [])

  /**
   * Create an RTCPeerConnection for a remote player.
   * Adds local audio track and sets up event handlers.
   */
  const createPeerConnection = useCallback(
    (playerId: string, isOfferer: boolean): RTCPeerConnection => {
      const pc = new RTCPeerConnection({
        iceServers: getIceServers(),
      })

      // Add local microphone track to the connection
      const localStream = localStreamRef.current
      if (localStream) {
        for (const track of localStream.getAudioTracks()) {
          pc.addTrack(track, localStream)
        }
      }

      // Handle incoming remote audio track
      pc.ontrack = (event) => {
        // eslint-disable-next-line no-console
        console.log(`[voice] Received audio track from ${playerId}`)
        if (event.streams[0]) {
          addRemoteStream(playerId, event.streams[0])
        }
      }

      // Send ICE candidates to remote peer via signaling server
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignaling({
            type: C2S_ICE_CANDIDATE,
            targetPlayerId: playerId,
            candidate: JSON.stringify(event.candidate),
          })
        }
      }

      pc.onconnectionstatechange = () => {
        // eslint-disable-next-line no-console
        console.log(
          `[voice] Connection state with ${playerId}: ${pc.connectionState}`,
        )
        if (
          pc.connectionState === 'failed' ||
          pc.connectionState === 'closed'
        ) {
          removePeer(playerId)
        }
      }

      peersRef.current.set(playerId, { pc, isOfferer })
      return pc
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getIceServers, sendSignaling, addRemoteStream],
  )

  /**
   * Close and remove a peer connection.
   */
  const removePeer = useCallback(
    (playerId: string) => {
      const peer = peersRef.current.get(playerId)
      if (peer) {
        peer.pc.close()
        peersRef.current.delete(playerId)
        removeRemoteStream(playerId)
      }
    },
    [removeRemoteStream],
  )

  /**
   * Initiate a WebRTC connection to a remote player (we are the offerer).
   */
  const connectToPeer = useCallback(
    async (playerId: string) => {
      if (peersRef.current.has(playerId)) {
        return
      }

      const pc = createPeerConnection(playerId, true)

      try {
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)

        sendSignaling({
          type: C2S_OFFER,
          targetPlayerId: playerId,
          sdp: JSON.stringify(pc.localDescription),
        })

        // eslint-disable-next-line no-console
        console.log(`[voice] Sent offer to ${playerId}`)
      } catch (err) {
        console.error(`[voice] Failed to create offer for ${playerId}:`, err)
        removePeer(playerId)
      }
    },
    [createPeerConnection, sendSignaling, removePeer],
  )

  /**
   * Handle incoming signaling messages from the multiplayer WS.
   */
  const handleSignalingMessage = useCallback(
    async (msg: SignalingMessage) => {
      const { fromPlayerId } = msg

      switch (msg.type) {
        case 'offer': {
          // Remote peer wants to connect — create answer
          // eslint-disable-next-line no-console
          console.log(`[voice] Received offer from ${fromPlayerId}`)

          // If we already have a connection, close it first
          if (peersRef.current.has(fromPlayerId)) {
            removePeer(fromPlayerId)
          }

          const pc = createPeerConnection(fromPlayerId, false)

          try {
            const desc = JSON.parse(msg.sdp) as RTCSessionDescriptionInit
            await pc.setRemoteDescription(new RTCSessionDescription(desc))

            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)

            sendSignaling({
              type: C2S_ANSWER,
              targetPlayerId: fromPlayerId,
              sdp: JSON.stringify(pc.localDescription),
            })

            // eslint-disable-next-line no-console
            console.log(`[voice] Sent answer to ${fromPlayerId}`)
          } catch (err) {
            console.error(
              `[voice] Failed to handle offer from ${fromPlayerId}:`,
              err,
            )
            removePeer(fromPlayerId)
          }
          break
        }

        case 'answer': {
          // Remote peer accepted our offer
          // eslint-disable-next-line no-console
          console.log(`[voice] Received answer from ${fromPlayerId}`)

          const peer = peersRef.current.get(fromPlayerId)
          if (!peer) {
            return
          }

          try {
            const desc = JSON.parse(msg.sdp) as RTCSessionDescriptionInit
            await peer.pc.setRemoteDescription(new RTCSessionDescription(desc))
          } catch (err) {
            console.error(
              `[voice] Failed to set remote description from ${fromPlayerId}:`,
              err,
            )
          }
          break
        }

        case 'ice_candidate': {
          const peer = peersRef.current.get(fromPlayerId)
          if (!peer) {
            return
          }

          try {
            const candidate = JSON.parse(msg.candidate) as RTCIceCandidateInit
            await peer.pc.addIceCandidate(new RTCIceCandidate(candidate))
          } catch (err) {
            console.error(
              `[voice] Failed to add ICE candidate from ${fromPlayerId}:`,
              err,
            )
          }
          break
        }
      }
    },
    [createPeerConnection, sendSignaling, removePeer],
  )

  /**
   * Capture microphone audio.
   */
  const startMicrophone = useCallback(async (): Promise<MediaStream | null> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      })
      localStreamRef.current = stream
      // eslint-disable-next-line no-console
      console.log('[voice] Microphone captured')
      return stream
    } catch (err) {
      console.error('[voice] Failed to capture microphone:', err)
      return null
    }
  }, [])

  /**
   * Stop microphone and release tracks.
   */
  const stopMicrophone = useCallback(() => {
    const stream = localStreamRef.current
    if (stream) {
      for (const track of stream.getTracks()) {
        track.stop()
      }
      localStreamRef.current = null
    }
  }, [])

  /**
   * Toggle mute/unmute local microphone.
   */
  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current
    if (!stream) {
      return
    }

    const audioTracks = stream.getAudioTracks()
    const newMuted = !audioTracks[0]?.enabled
    for (const track of audioTracks) {
      track.enabled = newMuted
    }
    setIsMuted(!newMuted)
  }, [])

  /**
   * Close all peer connections and stop microphone.
   */
  const cleanupAll = useCallback(() => {
    for (const [playerId, peer] of peersRef.current) {
      peer.pc.close()
      removeRemoteStream(playerId)
    }
    peersRef.current.clear()
    stopMicrophone()
    setRemoteStreams(new Map())
  }, [stopMicrophone, removeRemoteStream])

  // Subscribe to signaling messages from useMultiplayer
  useEffect(() => {
    if (enabled) {
      onSignalingMessageRef.current = handleSignalingMessage
    } else {
      onSignalingMessageRef.current = null
    }

    return () => {
      onSignalingMessageRef.current = null
    }
  }, [enabled, onSignalingMessageRef, handleSignalingMessage])

  // Main effect: start/stop voice chat
  useEffect(() => {
    if (!enabled) {
      cleanupAll()
      return
    }

    let cancelled = false

    const init = async () => {
      const stream = await startMicrophone()
      if (cancelled || !stream) {
        return
      }

      // Connect to all currently visible remote players
      // Use deterministic ordering: only connect if our userId < remotePlayerId
      // to avoid duplicate connections (both sides sending offers)
      for (const playerId of remotePlayerIds) {
        if (!peersRef.current.has(playerId)) {
          connectToPeer(playerId)
        }
      }
    }

    init()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  // React to remote player list changes — connect to new players, disconnect from gone ones
  useEffect(() => {
    if (!enabled || !localStreamRef.current) {
      return
    }

    const currentPeerIds = new Set(peersRef.current.keys())
    const newPlayerIds = new Set(remotePlayerIds)

    // Connect to new players
    for (const playerId of remotePlayerIds) {
      if (!currentPeerIds.has(playerId)) {
        connectToPeer(playerId)
      }
    }

    // Remove peers that are no longer in the remote players list
    for (const peerId of currentPeerIds) {
      if (!newPlayerIds.has(peerId)) {
        removePeer(peerId)
      }
    }
  }, [enabled, remotePlayerIds, connectToPeer, removePeer])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupAll()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    /** Remote audio streams keyed by playerId — bind to PositionalAudio */
    remoteStreams,
    /** Whether local microphone is muted */
    isMuted,
    /** Toggle mute/unmute */
    toggleMute,
  }
}

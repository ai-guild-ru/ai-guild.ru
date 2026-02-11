/* eslint-disable no-console */
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
  /** Local player ID (userId) — used for deterministic offer ordering to prevent glare */
  localPlayerId: string | null
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

export interface PeerState {
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
  localPlayerId,
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
  // Mute state — microphone is off by default
  const [isMuted, setIsMuted] = useState(true)
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled
  // Ref for remotePlayerIds — accessible in toggleMute without re-creating callback
  const remotePlayerIdsRef = useRef(remotePlayerIds)
  remotePlayerIdsRef.current = remotePlayerIds

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
        console.log(
          `[voice][ontrack] Received track from ${playerId}:`,
          'kind:',
          event.track.kind,
          'readyState:',
          event.track.readyState,
          'enabled:',
          event.track.enabled,
          'muted:',
          event.track.muted,
          'streams:',
          event.streams.length,
        )
        if (event.streams[0]) {
          console.log(
            `[voice][ontrack] Adding remote stream for ${playerId}, stream id:`,
            event.streams[0].id,
            'audioTracks:',
            event.streams[0].getAudioTracks().length,
          )
          addRemoteStream(playerId, event.streams[0])
        } else {
          console.warn(
            `[voice][ontrack] No streams in ontrack event for ${playerId}`,
          )
        }
      }

      // Send ICE candidates to remote peer via signaling server
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log(
            `[voice][ice] Sending ICE candidate to ${playerId}:`,
            event.candidate.type,
            event.candidate.protocol,
            event.candidate.address,
          )
          sendSignaling({
            type: C2S_ICE_CANDIDATE,
            targetPlayerId: playerId,
            candidate: JSON.stringify(event.candidate),
          })
        } else {
          console.log(`[voice][ice] ICE gathering complete for ${playerId}`)
        }
      }

      pc.onconnectionstatechange = () => {
        console.log(
          `[voice][state] Connection state with ${playerId}: ${pc.connectionState}, ICE: ${pc.iceConnectionState}, signaling: ${pc.signalingState}`,
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
    // [getIceServers, sendSignaling, addRemoteStream],
    [getIceServers, addRemoteStream, sendSignaling, removePeer],
  )

  /**
   * Initiate a WebRTC connection to a remote player (we are the offerer).
   */
  const connectToPeer = useCallback(
    async (playerId: string) => {
      if (peersRef.current.has(playerId)) {
        return
      }

      // Deterministic offer ordering: only the peer with the smaller ID initiates
      // the offer to prevent glare (both sides sending offers simultaneously)
      if (!localPlayerId || localPlayerId >= playerId) {
        return
      }

      const pc = createPeerConnection(playerId, true)

      try {
        console.log(
          `[voice][connect] Creating offer for ${playerId}, localStream tracks:`,
          localStreamRef.current?.getAudioTracks().length ?? 0,
        )
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)

        sendSignaling({
          type: C2S_OFFER,
          targetPlayerId: playerId,
          sdp: JSON.stringify(pc.localDescription),
        })

        console.log(
          `[voice][connect] Sent offer to ${playerId}, signalingState:`,
          pc.signalingState,
        )
      } catch (err) {
        console.error(`[voice] Failed to create offer for ${playerId}:`, err)
        removePeer(playerId)
      }
    },
    [createPeerConnection, sendSignaling, removePeer, localPlayerId],
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

          console.log(
            `[voice][signal] Received offer from ${fromPlayerId}, existing peer:`,
            peersRef.current.has(fromPlayerId),
          )

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

            console.log(
              `[voice][signal] Sent answer to ${fromPlayerId}, signalingState:`,
              pc.signalingState,
            )
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

          console.log(
            `[voice][signal] Received answer from ${fromPlayerId}, peer exists:`,
            peersRef.current.has(fromPlayerId),
          )

          const peer = peersRef.current.get(fromPlayerId)
          if (!peer) {
            return
          }

          // Guard against glare: answer is only valid when we are waiting for it
          if (peer.pc.signalingState !== 'have-local-offer') {
            console.warn(
              `[voice][signal] Ignoring answer from ${fromPlayerId} — signalingState is ${peer.pc.signalingState}, expected have-local-offer`,
            )
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
            console.warn(
              `[voice][signal] ICE candidate from ${fromPlayerId} but no peer exists`,
            )
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
   * Add local audio tracks to all existing peer connections.
   * Called when microphone is acquired after peers are already connected.
   */
  const addTracksToPeers = useCallback((stream: MediaStream) => {
    for (const [playerId, peer] of peersRef.current) {
      const senders = peer.pc.getSenders()
      const hasAudio = senders.some((s) => s.track?.kind === 'audio')
      if (!hasAudio) {
        for (const track of stream.getAudioTracks()) {
          peer.pc.addTrack(track, stream)
        }
        console.log(`[voice] Added audio track to existing peer ${playerId}`)
      }
    }
  }, [])

  /**
   * Toggle mute/unmute local microphone.
   * On first unmute — requests microphone access and adds tracks to peers.
   * On subsequent toggles — flips track.enabled.
   */
  const toggleMute = useCallback(async () => {
    // First unmute: acquire microphone
    if (!localStreamRef.current) {
      const stream = await startMicrophone()
      if (!stream) {
        return
      }
      // Add tracks to already-established peer connections
      addTracksToPeers(stream)
      // Connect to remote players that we haven't connected to yet
      for (const playerId of remotePlayerIdsRef.current) {
        if (!peersRef.current.has(playerId)) {
          connectToPeer(playerId)
        }
      }
      setIsMuted(false)
      return
    }

    // Subsequent toggles: flip track.enabled
    const audioTracks = localStreamRef.current.getAudioTracks()
    const newMuted = !audioTracks[0]?.enabled
    for (const track of audioTracks) {
      track.enabled = newMuted
    }
    setIsMuted(!newMuted)
  }, [startMicrophone, addTracksToPeers, connectToPeer])

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

    // Microphone is NOT started here — it will be acquired lazily
    // when the user clicks unmute (toggleMute).
    // We only set up signaling subscription above.
    console.log(
      '[voice][init] Main effect started (mic off by default), enabled:',
      enabled,
      'remotePlayerIds:',
      remotePlayerIds,
    )

    return () => {
      console.log('[voice][init] Main effect cleanup')
    }
  }, [cleanupAll, enabled, remotePlayerIds])

  // React to remote player list changes — connect to new players, disconnect from gone ones
  useEffect(() => {
    console.log(
      '[voice][reactive] Remote players changed. enabled:',
      enabled,
      'localStream:',
      !!localStreamRef.current,
      'remotePlayerIds:',
      remotePlayerIds,
      'currentPeers:',
      [...peersRef.current.keys()],
    )

    if (!enabled || !localStreamRef.current) {
      console.log(
        '[voice][reactive] Skipping — enabled:',
        enabled,
        'localStream:',
        !!localStreamRef.current,
      )
      return
    }

    const currentPeerIds = new Set(peersRef.current.keys())
    const newPlayerIds = new Set(remotePlayerIds)

    // Connect to new players
    for (const playerId of remotePlayerIds) {
      if (!currentPeerIds.has(playerId)) {
        console.log('[voice][reactive] Connecting to NEW player:', playerId)
        connectToPeer(playerId)
      }
    }

    // Remove peers that are no longer in the remote players list
    for (const peerId of currentPeerIds) {
      if (!newPlayerIds.has(peerId)) {
        console.log('[voice][reactive] Removing GONE player:', peerId)
        removePeer(peerId)
      }
    }
  }, [enabled, remotePlayerIds, connectToPeer, removePeer])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupAll()
    }
  }, [cleanupAll])

  return {
    /** Remote audio streams keyed by playerId — bind to PositionalAudio */
    remoteStreams,
    /** Whether local microphone is muted */
    isMuted,
    /** Toggle mute/unmute */
    toggleMute,
    /** Peer connections map ref — for debug overlay */
    peersRef,
    /** Local microphone stream ref — for debug overlay */
    localStreamRef,
  }
}

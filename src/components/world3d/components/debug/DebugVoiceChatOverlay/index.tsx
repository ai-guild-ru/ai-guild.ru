'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { PeerState } from '../../../hooks/useVoiceChat'
import {
  DebugVoiceChatOverlayStyled,
  DebugVoiceChatOverlayTitleStyled,
  DebugVoiceChatOverlayRowStyled,
  DebugVoiceChatOverlayLabelStyled,
  DebugVoiceChatOverlayValueStyled,
  DebugVoiceChatOverlaySectionStyled,
  DebugVoiceChatOverlayPeerStyled,
  DebugVoiceChatOverlayLevelBarStyled,
  DebugVoiceChatOverlayLevelFillStyled,
} from './styles'

/**
 * Per-peer debug snapshot collected from RTCPeerConnection stats.
 */
interface PeerDebugInfo {
  playerId: string
  connectionState: string
  iceConnectionState: string
  isOfferer: boolean
  /** Local ICE candidate type (host / srflx / relay) */
  localCandidateType: string
  /** Remote ICE candidate type */
  remoteCandidateType: string
  /** Remote audio level (0–100 %) */
  remoteAudioLevel: number
  /** Whether remote stream exists in remoteStreams map */
  hasStream: boolean
  /** Number of audio tracks in remote stream */
  trackCount: number
  /** First audio track readyState (live / ended) */
  trackState: string
  /** First audio track enabled flag */
  trackEnabled: boolean
  /** First audio track muted flag (browser-level, not user mute) */
  trackMuted: boolean
}

/**
 * Aggregated debug state for the voice chat overlay.
 */
interface VoiceChatDebugState {
  micCaptured: boolean
  isMuted: boolean
  localAudioLevel: number
  peerCount: number
  connectedPeerCount: number
  peers: PeerDebugInfo[]
  hasTurnCredentials: boolean
  wsState: string
}

interface DebugVoiceChatOverlayProps {
  /** Peer connections map ref from useVoiceChat */
  peersRef: React.MutableRefObject<Map<string, PeerState>>
  /** Local microphone stream ref from useVoiceChat */
  localStreamRef: React.MutableRefObject<MediaStream | null>
  /** Whether microphone is muted */
  isMuted: boolean
  /** Remote audio streams from useVoiceChat */
  remoteStreams: Map<string, MediaStream>
  /** WebSocket ref from useMultiplayer */
  wsRef: React.MutableRefObject<WebSocket | null>
  /** TURN credentials ref from useMultiplayer */
  turnCredentialsRef: React.MutableRefObject<{ urls: string[] } | null>
}

const WS_STATE_NAMES: Record<number, string> = {
  0: 'CONNECTING',
  1: 'OPEN',
  2: 'CLOSING',
  3: 'CLOSED',
}

/**
 * Debug overlay for WebRTC voice chat — shows peer connections,
 * audio levels, ICE candidate types, and connection states.
 * Rendered as HTML overlay outside the Canvas.
 */
export const DebugVoiceChatOverlay: React.FC<DebugVoiceChatOverlayProps> = ({
  peersRef,
  localStreamRef,
  isMuted,
  remoteStreams,
  wsRef,
  turnCredentialsRef,
}) => {
  const [state, setState] = useState<VoiceChatDebugState>({
    micCaptured: false,
    isMuted: false,
    localAudioLevel: 0,
    peerCount: 0,
    connectedPeerCount: 0,
    peers: [],
    hasTurnCredentials: false,
    wsState: 'N/A',
  })

  // AnalyserNode for local microphone level metering.
  // Uses its own AudioContext — safe because Three.js AudioListener
  // does not consume the local mic stream, so no resource conflict.
  const localAnalyserRef = useRef<AnalyserNode | null>(null)
  const localAudioContextRef = useRef<AudioContext | null>(null)

  /**
   * Compute RMS audio level (0–100) from an AnalyserNode.
   */
  const getAudioLevel = useCallback((analyser: AnalyserNode): number => {
    const data = new Uint8Array(analyser.fftSize)
    analyser.getByteTimeDomainData(data)
    let sum = 0
    for (let i = 0; i < data.length; i++) {
      const val = (data[i] - 128) / 128
      sum += val * val
    }
    const rms = Math.sqrt(sum / data.length)
    // Scale to 0–100 with some amplification for visibility
    return Math.min(100, rms * 300)
  }, [])

  // Setup local microphone analyser when stream changes
  useEffect(() => {
    const stream = localStreamRef.current
    if (!stream) {
      localAnalyserRef.current = null
      return
    }

    const ctx = new AudioContext()
    localAudioContextRef.current = ctx
    const source = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    source.connect(analyser)
    localAnalyserRef.current = analyser

    return () => {
      source.disconnect()
      ctx.close()
      localAnalyserRef.current = null
      localAudioContextRef.current = null
    }
  }, [localStreamRef])

  // Polling interval — collect debug state every 500ms.
  // Remote audio levels are read from RTCPeerConnection.getStats()
  // (inbound-rtp audioLevel field) — no extra AudioContext needed,
  // avoids competing with Three.js AudioListener for audio resources.
  useEffect(() => {
    const interval = setInterval(async () => {
      const peers = peersRef.current
      const localStream = localStreamRef.current

      // Local audio level (from dedicated AnalyserNode)
      let localAudioLevel = 0
      if (localAnalyserRef.current) {
        localAudioLevel = getAudioLevel(localAnalyserRef.current)
      }

      // Collect per-peer info
      const peerInfos: PeerDebugInfo[] = []
      let connectedCount = 0

      for (const [playerId, peerState] of peers) {
        const { pc } = peerState

        // Get ICE candidate types and remote audio level from stats
        let localCandidateType = '—'
        let remoteCandidateType = '—'
        let remoteAudioLevel = 0
        try {
          const stats = await pc.getStats()
          // Build a lookup map — RTCStatsReport.get() is not in TS types
          const reportMap = new Map<string, Record<string, unknown>>()
          stats.forEach((report) => {
            reportMap.set(report.id, report)
          })
          stats.forEach((report) => {
            if (
              report.type === 'candidate-pair' &&
              (report as Record<string, unknown>).state === 'succeeded'
            ) {
              const localCandId = (report as Record<string, unknown>)
                .localCandidateId
              const remoteCandId = (report as Record<string, unknown>)
                .remoteCandidateId
              if (typeof localCandId === 'string') {
                const localCand = reportMap.get(localCandId)
                if (localCand && typeof localCand.candidateType === 'string') {
                  localCandidateType = localCand.candidateType
                }
              }
              if (typeof remoteCandId === 'string') {
                const remoteCand = reportMap.get(remoteCandId)
                if (
                  remoteCand &&
                  typeof remoteCand.candidateType === 'string'
                ) {
                  remoteCandidateType = remoteCand.candidateType
                }
              }
            }
            // Read remote audio level from inbound-rtp stats (0.0–1.0)
            if (report.type === 'inbound-rtp') {
              const r = report as Record<string, unknown>
              if (r.kind === 'audio' && typeof r.audioLevel === 'number') {
                remoteAudioLevel = Math.min(100, r.audioLevel * 100)
              }
            }
          })
        } catch {
          // getStats may fail if connection is closed
        }

        if (pc.connectionState === 'connected') {
          connectedCount++
        }

        // Remote stream track diagnostics
        const remoteStream = remoteStreams.get(playerId)
        const audioTracks = remoteStream?.getAudioTracks() || []
        const firstTrack = audioTracks[0]

        peerInfos.push({
          playerId,
          connectionState: pc.connectionState,
          iceConnectionState: pc.iceConnectionState,
          isOfferer: peerState.isOfferer,
          localCandidateType,
          remoteCandidateType,
          remoteAudioLevel,
          hasStream: !!remoteStream,
          trackCount: audioTracks.length,
          trackState: firstTrack?.readyState || '—',
          trackEnabled: firstTrack?.enabled ?? false,
          trackMuted: firstTrack?.muted ?? false,
        })
      }

      // WebSocket state
      const ws = wsRef.current
      const wsState = ws ? WS_STATE_NAMES[ws.readyState] || 'UNKNOWN' : 'N/A'

      setState({
        micCaptured: !!localStream,
        isMuted,
        localAudioLevel,
        peerCount: peers.size,
        connectedPeerCount: connectedCount,
        peers: peerInfos,
        hasTurnCredentials: !!turnCredentialsRef.current,
        wsState,
      })
    }, 500)

    return () => clearInterval(interval)
  }, [
    peersRef,
    localStreamRef,
    isMuted,
    remoteStreams,
    wsRef,
    turnCredentialsRef,
    getAudioLevel,
  ])

  // Cleanup local mic audio context on unmount
  useEffect(() => {
    return () => {
      localAudioContextRef.current?.close()
    }
  }, [])

  return (
    <DebugVoiceChatOverlayStyled>
      <DebugVoiceChatOverlayTitleStyled>
        Voice Chat Debug
      </DebugVoiceChatOverlayTitleStyled>

      {/* WebSocket */}
      <DebugVoiceChatOverlayRowStyled>
        <DebugVoiceChatOverlayLabelStyled>
          WS:{' '}
        </DebugVoiceChatOverlayLabelStyled>
        <span style={{ color: state.wsState === 'OPEN' ? '#0f0' : '#f00' }}>
          {state.wsState}
        </span>
      </DebugVoiceChatOverlayRowStyled>

      {/* TURN */}
      <DebugVoiceChatOverlayRowStyled>
        <DebugVoiceChatOverlayLabelStyled>
          TURN:{' '}
        </DebugVoiceChatOverlayLabelStyled>
        <span style={{ color: state.hasTurnCredentials ? '#0f0' : '#ff0' }}>
          {state.hasTurnCredentials ? 'credentials received' : 'STUN only'}
        </span>
      </DebugVoiceChatOverlayRowStyled>

      {/* Microphone */}
      <DebugVoiceChatOverlaySectionStyled>
        <DebugVoiceChatOverlayRowStyled>
          <DebugVoiceChatOverlayLabelStyled>
            Mic:{' '}
          </DebugVoiceChatOverlayLabelStyled>
          <span style={{ color: state.micCaptured ? '#0f0' : '#f00' }}>
            {state.micCaptured ? 'captured' : 'not captured'}
          </span>
          {state.micCaptured && (
            <>
              {' | '}
              <span style={{ color: state.isMuted ? '#f00' : '#0f0' }}>
                {state.isMuted ? 'MUTED' : 'active'}
              </span>
            </>
          )}
        </DebugVoiceChatOverlayRowStyled>

        {state.micCaptured && (
          <DebugVoiceChatOverlayRowStyled>
            <DebugVoiceChatOverlayLabelStyled>
              Level:{' '}
            </DebugVoiceChatOverlayLabelStyled>
            <DebugVoiceChatOverlayLevelBarStyled>
              <DebugVoiceChatOverlayLevelFillStyled
                $level={state.localAudioLevel}
              />
            </DebugVoiceChatOverlayLevelBarStyled>
            <DebugVoiceChatOverlayValueStyled>
              {' '}
              {state.localAudioLevel.toFixed(0)}%
            </DebugVoiceChatOverlayValueStyled>
          </DebugVoiceChatOverlayRowStyled>
        )}
      </DebugVoiceChatOverlaySectionStyled>

      {/* Peers summary */}
      <DebugVoiceChatOverlaySectionStyled>
        <DebugVoiceChatOverlayRowStyled>
          <DebugVoiceChatOverlayLabelStyled>
            Peers:{' '}
          </DebugVoiceChatOverlayLabelStyled>
          <DebugVoiceChatOverlayValueStyled>
            {state.connectedPeerCount}/{state.peerCount}
          </DebugVoiceChatOverlayValueStyled>
          <DebugVoiceChatOverlayLabelStyled>
            {' '}
            connected
          </DebugVoiceChatOverlayLabelStyled>
        </DebugVoiceChatOverlayRowStyled>

        {/* Per-peer details */}
        {state.peers.map((peer) => (
          <DebugVoiceChatOverlayPeerStyled key={peer.playerId}>
            <DebugVoiceChatOverlayRowStyled>
              <DebugVoiceChatOverlayLabelStyled>
                ID:{' '}
              </DebugVoiceChatOverlayLabelStyled>
              <DebugVoiceChatOverlayValueStyled>
                {peer.playerId.slice(0, 8)}...
              </DebugVoiceChatOverlayValueStyled>
              <DebugVoiceChatOverlayLabelStyled>
                {' '}
                ({peer.isOfferer ? 'offerer' : 'answerer'})
              </DebugVoiceChatOverlayLabelStyled>
            </DebugVoiceChatOverlayRowStyled>

            <DebugVoiceChatOverlayRowStyled>
              <DebugVoiceChatOverlayLabelStyled>
                State:{' '}
              </DebugVoiceChatOverlayLabelStyled>
              <span
                style={{
                  color:
                    peer.connectionState === 'connected'
                      ? '#0f0'
                      : peer.connectionState === 'connecting' ||
                          peer.connectionState === 'new'
                        ? '#ff0'
                        : '#f00',
                }}
              >
                {peer.connectionState}
              </span>
              <DebugVoiceChatOverlayLabelStyled>
                {' '}
                / ICE:{' '}
              </DebugVoiceChatOverlayLabelStyled>
              <span
                style={{
                  color:
                    peer.iceConnectionState === 'connected'
                      ? '#0f0'
                      : peer.iceConnectionState === 'checking' ||
                          peer.iceConnectionState === 'new'
                        ? '#ff0'
                        : '#f00',
                }}
              >
                {peer.iceConnectionState}
              </span>
            </DebugVoiceChatOverlayRowStyled>

            <DebugVoiceChatOverlayRowStyled>
              <DebugVoiceChatOverlayLabelStyled>
                ICE type:{' '}
              </DebugVoiceChatOverlayLabelStyled>
              <DebugVoiceChatOverlayValueStyled>
                {peer.localCandidateType}
              </DebugVoiceChatOverlayValueStyled>
              <DebugVoiceChatOverlayLabelStyled>
                {' '}
                /{' '}
              </DebugVoiceChatOverlayLabelStyled>
              <DebugVoiceChatOverlayValueStyled>
                {peer.remoteCandidateType}
              </DebugVoiceChatOverlayValueStyled>
            </DebugVoiceChatOverlayRowStyled>

            <DebugVoiceChatOverlayRowStyled>
              <DebugVoiceChatOverlayLabelStyled>
                Stream:{' '}
              </DebugVoiceChatOverlayLabelStyled>
              <span style={{ color: peer.hasStream ? '#0f0' : '#f00' }}>
                {peer.hasStream ? 'yes' : 'no'}
              </span>
              <DebugVoiceChatOverlayLabelStyled>
                {' '}
                tracks:{' '}
              </DebugVoiceChatOverlayLabelStyled>
              <DebugVoiceChatOverlayValueStyled>
                {peer.trackCount}
              </DebugVoiceChatOverlayValueStyled>
              <DebugVoiceChatOverlayLabelStyled>
                {' '}
                state:{' '}
              </DebugVoiceChatOverlayLabelStyled>
              <span
                style={{
                  color: peer.trackState === 'live' ? '#0f0' : '#f00',
                }}
              >
                {peer.trackState}
              </span>
            </DebugVoiceChatOverlayRowStyled>

            <DebugVoiceChatOverlayRowStyled>
              <DebugVoiceChatOverlayLabelStyled>
                Track:{' '}
              </DebugVoiceChatOverlayLabelStyled>
              <span
                style={{
                  color: peer.trackEnabled ? '#0f0' : '#f00',
                }}
              >
                {peer.trackEnabled ? 'enabled' : 'disabled'}
              </span>
              <DebugVoiceChatOverlayLabelStyled>
                {' '}
                / hw-muted:{' '}
              </DebugVoiceChatOverlayLabelStyled>
              <span
                style={{
                  color: peer.trackMuted ? '#f00' : '#0f0',
                }}
              >
                {peer.trackMuted ? 'yes' : 'no'}
              </span>
            </DebugVoiceChatOverlayRowStyled>

            <DebugVoiceChatOverlayRowStyled>
              <DebugVoiceChatOverlayLabelStyled>
                Audio:{' '}
              </DebugVoiceChatOverlayLabelStyled>
              <DebugVoiceChatOverlayLevelBarStyled>
                <DebugVoiceChatOverlayLevelFillStyled
                  $level={peer.remoteAudioLevel}
                />
              </DebugVoiceChatOverlayLevelBarStyled>
              <DebugVoiceChatOverlayValueStyled>
                {' '}
                {peer.remoteAudioLevel.toFixed(0)}%
              </DebugVoiceChatOverlayValueStyled>
            </DebugVoiceChatOverlayRowStyled>
          </DebugVoiceChatOverlayPeerStyled>
        ))}

        {state.peerCount === 0 && (
          <DebugVoiceChatOverlayRowStyled>
            <DebugVoiceChatOverlayLabelStyled>
              No peers connected
            </DebugVoiceChatOverlayLabelStyled>
          </DebugVoiceChatOverlayRowStyled>
        )}
      </DebugVoiceChatOverlaySectionStyled>
    </DebugVoiceChatOverlayStyled>
  )
}

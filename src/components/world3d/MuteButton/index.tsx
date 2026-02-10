'use client'

import { MuteButtonStyled } from './styles'

interface MuteButtonProps {
  /** Whether the microphone is currently muted */
  isMuted: boolean
  /** Toggle mute/unmute callback */
  onToggle: () => void
}

/**
 * Microphone mute/unmute button — HTML overlay on top of the 3D canvas.
 * Shows mic icon when active, crossed-out mic when muted.
 */
export const MuteButton: React.FC<MuteButtonProps> = ({
  isMuted,
  onToggle,
}) => {
  return (
    <MuteButtonStyled
      onClick={onToggle}
      $isMuted={isMuted}
      title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
      aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
    >
      {isMuted ? (
        // Muted mic icon (SVG)
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="1" y1="1" x2="23" y2="23" />
          <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
          <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .76-.13 1.49-.35 2.17" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      ) : (
        // Active mic icon (SVG)
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      )}
    </MuteButtonStyled>
  )
}

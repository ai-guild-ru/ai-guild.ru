'use client'

import { MuteWorldButtonStyled } from './styles'

interface MuteWorldButtonProps {
  /** Whether all world sounds are currently muted */
  isMuted: boolean
  /** Toggle world sound mute/unmute callback */
  onToggle: () => void
}

/**
 * World sound mute/unmute button — HTML overlay on top of the 3D canvas.
 * Controls AudioListener gain to mute/unmute all 3D sounds
 * (spatial audio sources + remote player voices).
 * Shows speaker icon when active, crossed-out speaker when muted.
 */
export const MuteWorldButton: React.FC<MuteWorldButtonProps> = ({
  isMuted,
  onToggle,
}) => {
  return (
    <MuteWorldButtonStyled
      onClick={onToggle}
      $isMuted={isMuted}
      title={isMuted ? 'Unmute world sounds' : 'Mute world sounds'}
      aria-label={isMuted ? 'Unmute world sounds' : 'Mute world sounds'}
    >
      {isMuted ? (
        // Muted speaker icon (SVG) — speaker with X
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
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <line x1="23" y1="9" x2="17" y2="15" />
          <line x1="17" y1="9" x2="23" y2="15" />
        </svg>
      ) : (
        // Active speaker icon (SVG) — speaker with sound waves
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
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        </svg>
      )}
    </MuteWorldButtonStyled>
  )
}

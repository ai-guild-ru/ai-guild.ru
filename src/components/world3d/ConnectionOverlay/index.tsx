import React from 'react'
import type { ConnectionStatus } from '../hooks/useMultiplayer'
import {
  OverlayStyled,
  ModalStyled,
  ModalTitle,
  ModalText,
  ModalButton,
} from './styles'

interface ConnectionOverlayProps {
  /** Current WS connection status */
  status: ConnectionStatus
  /** Callback to manually reconnect (used for session_replaced) */
  onReconnect: () => void
}

/**
 * Overlay shown on top of the 3D scene when WS connection has issues.
 * Shown only for 'error' and 'session_replaced' statuses.
 * Not shown for 'idle' or 'connecting' (initial load).
 */
export const ConnectionOverlay: React.FC<ConnectionOverlayProps> = ({
  status,
  onReconnect,
}) => {
  if (status === 'error') {
    return (
      <OverlayStyled>
        <ModalStyled>
          <ModalTitle>Connection lost</ModalTitle>
          <ModalText>
            Failed to connect to the world server. Reconnecting...
          </ModalText>
        </ModalStyled>
      </OverlayStyled>
    )
  }

  if (status === 'session_replaced') {
    return (
      <OverlayStyled>
        <ModalStyled>
          <ModalTitle>Session closed</ModalTitle>
          <ModalText>
            Your session was closed because a new one was opened in another
            window. Would you like to use this window instead?
          </ModalText>
          <ModalButton onClick={onReconnect}>Yes, reconnect here</ModalButton>
        </ModalStyled>
      </OverlayStyled>
    )
  }

  return null
}

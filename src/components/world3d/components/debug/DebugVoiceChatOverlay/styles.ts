import styled from 'styled-components'

export const DebugVoiceChatOverlayStyled = styled.div`
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 10;

  background: rgba(0, 0, 0, 0.85);
  color: #fff;
  padding: 12px 16px;
  border-radius: 8px;
  pointer-events: none;
  min-width: 300px;
  font-family: monospace;
  font-size: 13px;
`

export const DebugVoiceChatOverlayTitleStyled = styled.div`
  font-weight: bold;
  margin-bottom: 8px;
  color: #0ff;
`

export const DebugVoiceChatOverlayRowStyled = styled.div`
  margin-bottom: 4px;

  &:last-child {
    margin-bottom: 0;
  }
`

export const DebugVoiceChatOverlayLabelStyled = styled.span`
  color: #888;
`

export const DebugVoiceChatOverlayValueStyled = styled.span`
  color: #0f0;
`

export const DebugVoiceChatOverlaySectionStyled = styled.div`
  margin-top: 8px;
  padding-top: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.15);
`

export const DebugVoiceChatOverlayPeerStyled = styled.div`
  margin-top: 4px;
  padding: 4px 6px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
`

/** Audio level bar — horizontal bar with fill */
export const DebugVoiceChatOverlayLevelBarStyled = styled.div`
  display: inline-block;
  width: 80px;
  height: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  overflow: hidden;
  vertical-align: middle;
  margin-left: 4px;
`

export const DebugVoiceChatOverlayLevelFillStyled = styled.div<{
  $level: number
}>`
  height: 100%;
  width: ${({ $level }) => Math.min(100, $level)}%;
  background: ${({ $level }) =>
    $level > 60 ? '#f00' : $level > 30 ? '#ff0' : '#0f0'};
  transition: width 0.1s ease-out;
`

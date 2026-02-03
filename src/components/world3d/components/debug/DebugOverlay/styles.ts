import styled from 'styled-components'

import { Html } from '@react-three/drei'

export const DebugOverlayContainerStyled = styled.div`
  background: rgba(0, 0, 0, 0.85);
  color: #fff;
  padding: 12px 16px;
  border-radius: 8px;
  pointer-events: none;
  min-width: 280px;
`

export const DebugOverlayTitleStyled = styled.div`
  font-weight: bold;
  margin-bottom: 8px;
  color: #0ff;
`

export const DebugOverlayRowStyled = styled.div`
  margin-bottom: 6px;

  &:last-child {
    margin-bottom: 0;
  }
`

export const DebugOverlayLabelStyled = styled.span`
  color: #888;
`

export const DebugOverlayValueStyled = styled.span`
  color: #0f0;
`

export const DebugOverlayValueRigidBodyStyled = styled.span`
  color: #ff0;
`

export const DebugOverlayValueAvatarStyled = styled.span`
  color: #f80;
`

export const DebugOverlayValueCameraStyled = styled.span`
  color: #f0f;
`

export const DebugOverlayRotationStyled = styled.div`
  color: #666;
  margin-left: 10px;
`

export const DebugOverlayStyled = styled(Html)`
  position: fixed;
  bottom: 60px;
  left: 60px;
  font-size: 14px;
  transform: none;
  z-index: 10000;

  font-family: monospace;
`

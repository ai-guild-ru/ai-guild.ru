import styled from 'styled-components'

/** Full-screen overlay covering the 3D scene */
export const OverlayStyled = styled.div`
  position: absolute;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
`

/** Modal card centered on the overlay */
export const ModalStyled = styled.div`
  background: #1a1a2e;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 32px;
  max-width: 420px;
  width: 90%;
  text-align: center;
  color: #e0e0e0;
`

export const ModalTitle = styled.h3`
  margin: 0 0 12px;
  font-size: 18px;
  color: #fff;
`

export const ModalText = styled.p`
  margin: 0 0 24px;
  font-size: 14px;
  line-height: 1.5;
  color: #b0b0b0;
`

export const ModalButton = styled.button`
  padding: 10px 24px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  background: #4a6cf7;
  color: #fff;
  transition: background 0.2s;

  &:hover {
    background: #3b5de7;
  }
`

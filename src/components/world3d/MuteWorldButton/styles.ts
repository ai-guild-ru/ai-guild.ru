import styled from 'styled-components'

export const MuteWorldButtonStyled = styled.button<{ $isMuted: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  transition:
    background-color 0.2s,
    opacity 0.2s;

  background-color: ${({ $isMuted }) =>
    $isMuted ? 'rgba(220, 38, 38, 0.85)' : 'rgba(255, 255, 255, 0.15)'};
  color: ${({ $isMuted }) => ($isMuted ? '#fff' : 'rgba(255, 255, 255, 0.9)')};
  backdrop-filter: blur(8px);

  &:hover {
    background-color: ${({ $isMuted }) =>
      $isMuted ? 'rgba(220, 38, 38, 1)' : 'rgba(255, 255, 255, 0.25)'};
  }

  &:active {
    opacity: 0.8;
  }
`

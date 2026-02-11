import styled, { createGlobalStyle } from 'styled-components'

export const World3DSceneGlobalStyles = createGlobalStyle`
  .drai--debug-overlay-warpper {
    display: contents;
  }

  .drai--debug-stats {
    top: 10px !important;
    left: 60px !important;
    z-index: 800 !important;
  }
`

export const World3DSceneStyled = styled.div`
  width: 100%;
  height: 100%;
  position: relative;
`

/** Container for audio control buttons (mic mute + world mute) — bottom center overlay */
export const World3DSceneControlsStyled = styled.div`
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  display: flex;
  gap: 12px;
`

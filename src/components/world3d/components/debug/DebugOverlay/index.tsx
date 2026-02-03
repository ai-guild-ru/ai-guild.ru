'use client'

import { useRef, CSSProperties } from 'react'
import {
  DebugOverlayStyled,
  DebugOverlayContainerStyled,
  DebugOverlayTitleStyled,
} from './styles'
import { Vector3 } from '@react-three/fiber'

const calculatePosition = () => [0, 0]

type DebugOverlayProps = React.PropsWithChildren & {
  title: string
  position?: Vector3 | undefined
  style?: CSSProperties
}

/**
 * Компонент отладки — отображает направления объектов через React.createPortal.
 * Показывает forward direction для: мира, RigidBody, аватара, камеры.
 */
export const DebugOverlay: React.FC<DebugOverlayProps> = ({
  children,
  title,
  position = [0, 0, 0],
  style,
}) => {
  return (
    <DebugOverlayStyled
      position={position}
      calculatePosition={calculatePosition}
      // fullscreen
      portal={useRef(global.document?.body)}
      wrapperClass="drai--debug-overlay-warpper"
      style={style}
    >
      <DebugOverlayContainerStyled>
        <DebugOverlayTitleStyled>🔍 Debug: {title}</DebugOverlayTitleStyled>

        {children}
      </DebugOverlayContainerStyled>
    </DebugOverlayStyled>
  )
}

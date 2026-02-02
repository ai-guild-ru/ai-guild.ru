import { World3DScene } from 'src/components/world3d/World3DScene'
import { Page } from '../_App/interfaces'
import { World3DScenePageGlobalStyles } from './styles'

export const World3DScenePage: Page = () => {
  return (
    <>
      <World3DScenePageGlobalStyles />
      <World3DScene />
    </>
  )
}

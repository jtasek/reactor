import { Compute } from 'cerebral'
import { state } from 'cerebral'

export default Compute(state`workspace.shapes`, shapes =>
  Object.keys(shapes).filter(key => shapes[key].selected)
)

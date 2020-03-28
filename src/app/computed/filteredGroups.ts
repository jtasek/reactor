import { Compute } from 'cerebral'
import { state } from 'cerebral'

export default Compute(
  state`workspace.filter`,
  state`workspace.groups`,
  (filter, groups) =>
    Object.keys(groups).filter(key => {
      const group = groups[key]
      return group && group.name && group.name.includes(filter)
    })
)

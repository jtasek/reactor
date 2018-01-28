import { Compute } from 'cerebral'
import { state } from 'cerebral/tags'

export default Compute(
    state`tools`,
    ( tools ) => (Object.keys(tools).map(name => tools[name]).filter(tool => tool.active).map(tool => tool.name))
)
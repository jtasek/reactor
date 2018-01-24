import { compute } from 'cerebral'
import { state } from 'cerebral/tags'

export default compute(
    state`tools`,
    ( tools ) => (Object.keys(tools).map(name => tools[name]).filter(tool => tool.active).map(tool => tool.name))
)
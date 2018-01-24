import { compute } from 'cerebral'
import { state } from 'cerebral/tags'

export default compute(
    state`workspace.filter`,
    state`workspace.links`,
    (filter, links) => (
        Object.keys(links).filter(key => {
            const link = links[key]
            return link && link.name && link.name.includes(filter)
        })
    ))
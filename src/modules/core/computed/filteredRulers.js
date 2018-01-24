import { compute } from 'cerebral'
import { state } from 'cerebral/tags'

export default compute(
    state`workspace.filter`,
    state`workspace.rulers`,
    (filter, rulers) => (
        Object.keys(rulers).filter(key => {
            const ruler = rulers[key]
            return ruler && ruler.name && ruler.name.includes(filter)
        })
    ))
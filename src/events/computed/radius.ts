
import { Compute } from 'cerebral'
import getCentre from './centre'
import getInitialPosition from './initialPosition'

export default Compute({
    centre: getCentre,
    initial: getInitialPosition
}, (centre, initial) => {
    const a = centre.x - initial.x
    const b = centre.y - initial.y

    return Math.sqrt(a * a + b * b)
})
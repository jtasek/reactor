/* @flow */
import { compute } from 'cerebral'
import getCentre from './getCentre'
import getInitialPosition from './getInitialPosition'

export default compute({
    centre: getCentre,
    initial: getInitialPosition
}, (centre, initial) => {
    const a = centre.x - initial.x
    const b = centre.y - initial.y

    return Math.sqrt(a * a + b * b)
})
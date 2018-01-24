import { compute } from 'cerebral'
import selectedShapes from './selectedShapes'

export default compute(
    selectedShapes,
    (selectedShapes) => (
        selectedShapes.length
    ))
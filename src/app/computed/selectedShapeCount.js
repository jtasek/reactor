import { Compute } from 'cerebral'
import selectedShapes from './selectedShapes'

export default Compute(
    selectedShapes,
    (selectedShapes) => (
        selectedShapes.length
    ))
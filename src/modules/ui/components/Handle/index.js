import React from 'react'
import styles from './styles.css'

const Handle = ({x, y, size}) => (
    <circle className={styles.handle} cx={x} cy={y} r={size} />
)

export default Handle
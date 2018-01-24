import React from 'react'
import styles from './styles.css'
import { connect } from '@cerebral/react'
import { props, signal, state } from 'cerebral/tags'

const Switch = ({ visible, onChangeHandler }) => (
    <label className={styles.switch + (visible ? ' ' + styles.selected : '')}>
        <input type="checkbox" name="distructionfreemode" checked={visible} onChange={function (e) { e.preventDefault(); onChangeHandler() }} />
        <div className={styles.track}>
            <div className={styles.thumb} />
        </div>
    </label>
)

export default connect({
    visible: state`core.distractionFreeMode`,
    onChangeHandler: signal`core.distructionFreeModeToggled`
}, Switch)
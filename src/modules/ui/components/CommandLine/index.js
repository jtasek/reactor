import React from 'react'
import { connect } from '@cerebral/react'
import { props, signal, state } from 'cerebral/tags'
import styles from './styles.css'

const CommandLine = ({ visible, commandHandler }) => (
    <div className={styles.commandline} style={!visible ? { display: 'none' } : { display: 'inline-block' }}>
        <input type="search" placeholder="type command..." onChange={(e) => commandHandler({ command: e.target.value })} />
    </div>
)

export default connect({
    command: state`activeCommand`,
    visible: state`ui.controls.commandline.visible`,
    commandHandler: signal`commandExecuted`
}, CommandLine)
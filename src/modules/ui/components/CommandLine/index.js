import React from 'react'
import { connect } from '@cerebral/react'
import { props, sequences, state } from 'cerebral'
import styles from './styles.css'

const CommandLine = ({ visible, commandHandler }) => (
  <div
    className={styles.commandline}
    style={!visible ? { display: 'none' } : { display: 'inline-block' }}
  >
    <input
      type="search"
      placeholder="type command..."
      onChange={e => commandHandler({ command: e.target.value })}
    />
  </div>
)

export default connect(
  {
    command: state`activeCommand`,
    visible: state`ui.controls.commandline.visible`,
    commandHandler: sequences`commandExecuted`
  },
  CommandLine
)

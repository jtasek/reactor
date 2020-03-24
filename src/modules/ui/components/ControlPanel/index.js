import React, { Component } from 'react'
import { connect } from '@cerebral/react'
import { props, sequences, state } from 'cerebral'
import Icon from '../Icon'
import styles from './styles.css'

const vicons = {
  true: {
    group: 'action',
    name: 'visibility',
    color: 'rgba(255,255,255)',
    size: 16
  },
  false: {
    group: 'action',
    name: 'visibility_off',
    color: 'rgba(255,255,255)',
    size: 16
  }
}

const ControlPanelItem = ({ control, onChangeHandler }) => (
  <li className={styles.controlItem}>
    <label>
      <input
        type="checkbox"
        value={control.name}
        checked={control.visible}
        onChange={onChangeHandler}
      />
      {control.name}
      <Icon {...vicons[control.visible]} key="visible" />
    </label>
  </li>
)

const ControlPanel = ({ visible, controls, controlVisibilityChanged }) => (
  <ul
    className={styles.controlPanel}
    style={!visible ? { display: 'none' } : { display: 'block' }}
  >
    {Object.keys(controls).map((name, index) => (
      <ControlPanelItem
        key={index}
        control={controls[name]}
        onChangeHandler={e =>
          controlVisibilityChanged({ id: index, name: name })
        }
      />
    ))}
  </ul>
)

export default connect(
  {
    visible: state`ui.controls.controlpanel.visible`,
    controls: state`ui.controls`,
    controlVisibilityChanged: sequences`ui.controlVisibilityChanged`
  },
  ControlPanel
)

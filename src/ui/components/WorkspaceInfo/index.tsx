
import React, { Component } from 'react'
import { connect } from '@cerebral/react'
import { props, state } from 'cerebral'
import { getPropValue } from '../../../app/utils'
import styles from './styles.css'

const WorkspaceInfoItem = ({ name, value }) => (
  <tr>
    <td>{name}: </td>
    <td>{value}</td>
  </tr>
)

const WorkspaceInfo = ({ visible, workspace }) => (
  <table
    className={styles.workspaceInfo}
    style={!visible ? { display: 'none' } : { display: 'block' }}
  >
    <tbody>
      {Object.keys(workspace).map((name, index) => (
        <WorkspaceInfoItem
          key={index}
          name={name}
          value={getPropValue(workspace[name])}
        />
      ))}
    </tbody>
  </table>
)

export default connect(
  {
    visible: state`'ui.controls.workspace.visible`,
    workspace: state`workspace`
  },
  WorkspaceInfo
)

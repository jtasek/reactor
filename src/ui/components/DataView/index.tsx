import React, { Component } from 'react'
//import styles from './styles.css'

/*
 * Displays component data
 */
export const DataView = ({ visible }) => (
  <div
    width="200"
    height="200"
    style={!visible ? { display: 'none' } : { display: 'block' }}
  >
    sdfg sdfg sdfg sdfg sdfg
  </div>
)

export default connect(
  {
    visible: state`ui.controls.dataview.visible`
  },
  DataView
)

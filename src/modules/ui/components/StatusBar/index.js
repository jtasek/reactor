import React, { Component } from 'react'
import { connect } from '@cerebral/react'
import { props, signal, state } from 'cerebral/tags'
import selectedShapeCount from '../../../app/computed/selectedShapeCount'
import getOffset from '../../../reflex/computed/getOffset'
import styles from './styles.css'
import Slider from '../Slider'

const Slot = ({ name, text, style, children }) =>
  <span id={name} style={style}>
    {children}
  </span>

const ZoomSlider = connect(
  {
    scale: state`workspace.camera.scale`,
    scaleChanged: signal`scaleChanged`
  },
  ({ scale, scaleChanged }) =>
    <Slider
      min={0.1}
      max={5.0}
      step={0.1}
      start={1}
      value={scale}
      onChange={value => scaleChanged({ scale: value })}
    />
)

class StatusBar extends Component {
  render() {
    const { selectedShapeCount, visible, position, status, offset } = this.props

    return (
      <div
        className={styles.statusBar}
        style={!visible ? { display: 'none' } : { display: 'flex' }}
      >
        <Slot name="message" style={{ width: '30%' }}>
          {status}
        </Slot>
        <Slot
          name="selection"
          style={{ width: '30%' }}
        >{`selection: ${selectedShapeCount}`}</Slot>
        <Slot
          name="position"
          style={{ width: '15%' }}
        >{`position: [${position.x}, ${position.y}]`}</Slot>
        <Slot
          name="offset"
          style={{ width: '15%' }}
        >{`size: [${offset.x}, ${offset.y}]`}</Slot>
        <Slot
          name="tools"
          style={{ width: '10%', display: 'flex', justifyContent: 'center' }}
        >
          <ZoomSlider />
        </Slot>
      </div>
    )
  }
}

export default connect(
  {
    position: state`reflex.monitor.position`,
    offset: getOffset,
    selectedShapeCount: selectedShapeCount,
    visible: state`ui.controls.statusbar.visible`,
    status: state`workspace.status`
  },
  StatusBar
)

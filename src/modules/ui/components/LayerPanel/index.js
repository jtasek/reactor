import React, { Component } from 'react'
import { connect } from '@cerebral/react'
import { state } from 'cerebral'
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

const licons = {
  true: {
    group: 'action',
    name: 'lock_outline',
    color: 'rgba(255,255,255)',
    size: 16
  },
  false: {
    group: 'action',
    name: 'lock_open',
    color: 'rgba(255,255,255)',
    size: 16
  }
}

const LayerPanelItem = ({ layer, onChangeHandler }) => (
  <li className={styles.layerItem}>
    <label>
      <input
        type="checkbox"
        value={layer.name}
        checked={layer.visible}
        onChange={onChangeHandler}
      />
      {layer.name}
    </label>
    <Icon {...vicons[layer.visible]} key="visible" />
    <Icon {...licons[layer.locked]} key="locked" />
  </li>
)

export class LayerPanel extends Component {
  render() {
    const layers = Object.keys(this.props.layers).map((layerId, index) => {
      const layer = this.props.layers[layerId]
      return (
        <LayerPanelItem
          key={index}
          layer={layer}
          onChangeHandler={e => {
            /*this.props.signals.ui.layerVisibilityChanged({ id: index, name: layer.name, visible: layer.visible }) */
          }}
        />
      )
    })

    return (
      <ul
        className={styles.layerPanel}
        style={!this.props.visible ? { display: 'none' } : { display: 'block' }}
      >
        {layers}
      </ul>
    )
  }
}

export default connect(
  {
    visible: state`ui.controls.layerpanel.visible`,
    layers: state`workspace.layers`
  },
  LayerPanel
)

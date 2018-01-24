// @flow
import React, { Component } from 'react'
import { connect } from '@cerebral/react'
import { props, signal, state } from 'cerebral/tags'
import selectedShapes from '../../../app/computed/selectedShapes'
import { getPropValue } from '../../../app/utils'
import styles from './styles.css'

function intersect(arrays: Array<Array<string>>) {
  var result = arrays.shift().reduce(function(res, v) {
    if (
      res.indexOf(v) === -1 &&
      arrays.every(function(a) {
        return a.indexOf(v) !== -1
      })
    )
      res.push(v)
    return res
  }, [])

  return result
}

const PropertyPanelItem = ({ name, value }) => (
  <tr>
    <td>{name}: </td>
    <td>{value}</td>
  </tr>
)

const PropertyGroupItem = ({ name, children }) => (
  <tr>
    <td>{name}</td>
    <td>
      <table>
        <tbody>{children}</tbody>
      </table>
    </td>
  </tr>
)

const PropertyList = ({ isroot: boolean, name, value }) => {
  console.dir(value)
  if (typeof value === 'object') {
    return (
      <PropertyGroupItem key={name} name={name}>
        {Object.keys(value).map(key => (
          <PropertyList key={key} name={key} value={value[key]} />
        ))}
      </PropertyGroupItem>
    )
  } else {
    return (
      <PropertyPanelItem key={name} name={name} value={getPropValue(value)} />
    )
  }
}

const PropertyPanel = ({ visible, shapes }) => (
  <table
    className={styles.propertyPanel}
    style={!visible ? { display: 'none' } : { display: 'block' }}
  >
    <tbody>
      <PropertyList key="properties" name="properties" value={shapes[0]} />
    </tbody>
  </table>
)

export default connect(
  {
    visible: state`ui.controls.propertypanel.visible`,
    shapes: selectedShapes,
    controlVisibilityChanged: signal`ui.controlVisibilityChanged`
  },
  PropertyPanel
)

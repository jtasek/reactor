// @flow
import React, { Component } from 'react'
import { connect } from '@cerebral/react'
import { props, state } from 'cerebral/tags'
//import styles from './styles.css'

/*
* Displays component data
*/
export const DataView = ({visible}) => (
    <div width="200" height="200" style={!visible ? { display: 'none' } : { display: 'block' }}>
        sdfg
        sdfg
        sdfg
        sdfg
        sdfg        
    </div>
)

export default connect({
    visible: state`ui.controls.dataview.visible`
}, DataView)
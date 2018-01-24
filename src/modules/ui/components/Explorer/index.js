import React, {Component} from 'react'
import styles from './styles.css'
import {connect} from '@cerebral/react'
import { props, state } from 'cerebral/tags'

export default connect({
  visible: state`ui.controls.explorer.visible`,
},
  class Explorer extends Component {
    render() {
      return (
        <div className={styles.explorer} style={!this.props.visible ? { display: 'none' } : { display: 'block' }}>
          {this.props.children}
        </div>
      )
    }
  })
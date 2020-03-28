import React, { Component } from 'react';
import styles from './styles.css';

export default connect(
  {
    visible: state`ui.controls.sidebar.visible`
  },
  class SideBar extends Component {
    render() {
      return (
        <div
          className={styles.sidebar}
          style={
            !this.props.visible ? { display: 'none' } : { display: 'flex' }
          }
        >
          {this.props.children}
        </div>
      );
    }
  }
);

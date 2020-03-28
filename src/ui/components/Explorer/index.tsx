import React, { Component } from 'react';
import styles from './styles.css';

export default connect(
    {
        visible: state`ui.controls.explorer.visible`
    },
    class Explorer extends Component {
        render() {
            return (
                <div
                    className={styles.explorer}
                    style={
                        !this.props.visible ? { display: 'none' } : { display: 'block' }
                    }
                >
                    {this.props.children}
                </div>
            );
        }
    }
);

import React, { Component } from 'react';

import styles from './styles.css';

const MenuBarButton = props => (
    <li className={styles.menuBarButton}>
        <a href="#">{props.action.name}</a>
    </li>
);

class MenuBar extends Component {
    render() {
        const buttons = this.props.actions.map(action => {
            return <MenuBarButton key={action.id} action={action} />;
        });

        return (
            <ul
                className={styles.menuBar}
                style={!this.props.visible ? { display: 'none' } : { display: 'flex' }}
            >
                {buttons}
            </ul>
        );
    }
}

export default connect(
    {
        visible: state.ui.controls.menubar.visible`,
    controls: state.workspace.controls`
    },
    MenuBar
);

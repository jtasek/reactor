import React, { Component } from 'react';

import Icon from '../Icon';
import styles from './styles.css';

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
};

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
};

const GroupPanelItem = ({ group, onChangeHandler }) => (
    <li className={styles.groupItem}>
      <label>
        <input
            type="checkbox"
            value={group.name}
            checked={group.visible}
            onChange={onChangeHandler}
        />
        {group.name}
        <Icon {...vicons[group.visible]} key="visible" />
        <Icon {...licons[group.locked]} key="locked" />
      </label>
    </li>
);

export class GroupPanel extends Component {
  render() {
    const groups = Object.keys(this.props.groups).map((groupId, index) => {
      const group = this.props.groups[groupId];
      return (
          <GroupPanelItem
              key={index}
              group={group}
              onChangeHandler={e => {
                groupVisibilityChanged({ id: index });
              }}
          />
      );
    });

    return (
        <ul
            className={styles.groupPanel}
            style={!this.props.visible ? { display: 'none' } : { display: 'block' }}
        >
          {groups}
        </ul>
    );
  }
}

export default connect(
    {
      visible: state`ui.controls.grouppanel.visible`,
      groups: state`workspace.groups`,
      groupVisibilityChanged: signal`ui.groupVisibilityChanged`
    },
    GroupPanel
);

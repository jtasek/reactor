import React, { FC } from 'react';
import { Control } from 'src/ui/types';
import styles from './styles.css';

import { Icon } from '../Icon';

const visible = {
  group: 'action',
  name: 'visibility',
  color: 'rgba(255,255,255)',
  size: 16
};

const hidden = {
  group: 'action',
  name: 'visibility_off',
  color: 'rgba(255,255,255)',
  size: 16
};

interface Props {
  control: Control;
  onChange: (toolId: string, visible: boolean) => void;
}

export const ControlPanelItem: FC<Props> = ({ control, onChange }) => (
  <li className={styles.controlItem}>
    <label>
      <input
        type="checkbox"
        value={control.name}
        checked={control.visible}
        onChange={(e) => onChange(control.id, Boolean(e.target.value))}
      />
      {control.name}
    </label>
    {control.visible ? <Icon {...visible} key="visible" /> : <Icon {...hidden} key="hidden" />}
  </li>
);

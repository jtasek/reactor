import React, { FC } from 'react';
import { Control } from 'src/ui/types';
import styles from './styles.css';

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
    </li>
);

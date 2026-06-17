import React, { FC } from 'react';

import { Control } from '../../types';
import { ControlPanelItem } from './ControlPanelItem';
import styles from './styles.css';

export interface Props {
    controls: Control[];
    onChange: (toolId: string, visible: boolean) => void;
}

export const ControlPanel: FC<Props> = ({ controls, onChange }) => (
    <ul className={styles.controlPanel}>
        {Object.values(controls).map((control, index) => (
            <ControlPanelItem key={index} control={control} onChange={onChange} />
        ))}
    </ul>
);

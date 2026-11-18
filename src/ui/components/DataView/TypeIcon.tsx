import React from 'react';
import { Hash, Link2, List, ToggleLeft, Type } from 'lucide-react';
import type { DataType } from 'src/app/dataTypes';
import styles from './styles.css';

const TYPE_ICONS = {
    text: Type,
    number: Hash,
    boolean: ToggleLeft,
    choice: List,
    reference: Link2
};

export const TypeIcon = ({ type }: { type: DataType }) => {
    const Icon = TYPE_ICONS[type];

    return (
        <span className={styles.typeIcon} data-type={type} title={type}>
            <Icon aria-hidden size={12} strokeWidth={2.25} />
        </span>
    );
};

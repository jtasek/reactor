import React, { FC, ReactNode } from 'react';
import styles from './styles.css';
import { Overlay } from '../Overlay/Overlay';

import { Icon } from '../Icon';

const closeIcon = { group: 'content', name: 'clear', color: 'none', size: 18 };

export const CloseButton: FC = () => <Icon icon={closeIcon} />;

export interface Props {
    title: string;
    description: string;
    visible: boolean;
    children?: ReactNode;
}

export const Dialog: FC<Props> = ({ title, description, visible, children }) => {
    if (!visible) {
        return null;
    }

    return (
        <div style={{ width: '100%', height: '100%', position: 'absolute' }}>
            <Overlay />
            <div className={styles.dialog}>
                <CloseButton />
                <h4>{title}</h4>
                <p>{description}</p>
                <form>
                    <fieldset>{children}</fieldset>
                </form>
                <div className={styles.actions}>
                    <button data-action="close">Close</button>
                </div>
            </div>
        </div>
    );
};

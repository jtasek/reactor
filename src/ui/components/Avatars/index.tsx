import React, { FC } from 'react';
import { UserRound } from 'lucide-react';
import { Icon } from '../Icon';
import styles from './styles.css';

/** A single person or an overlapping group, using the names available to this view. */
export const Avatars: FC<{ names: string[] }> = ({ names }) => {
    const people = [...new Set(names.map((name) => name.trim()).filter(Boolean))];

    if (people.length === 0) {
        return null;
    }

    return (
        <span className={styles.avatars} role="img" aria-label={people.join(', ')}>
            {people.map((name) => (
                <span className={styles.avatar} title={name} key={name}>
                    <Icon icon={{ component: UserRound, size: 14 }} />
                </span>
            ))}
        </span>
    );
};

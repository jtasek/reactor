import React, { FC } from 'react';
import { UserRound } from 'lucide-react';
import { Icon } from '../Icon';
import styles from './styles.css';

const AVATAR_ICON_SIZE = 14;

interface Props {
    names: string[];
    /** Hides the avatars from assistive technology where the names are written next to them. */
    decorative?: boolean;
}

/** A single person or an overlapping group, using the names available to this view. */
export const Avatars: FC<Props> = ({ names, decorative = false }) => {
    const people = [...new Set(names.map((name) => name.trim()).filter(Boolean))];

    if (people.length === 0) {
        return null;
    }

    const label = decorative
        ? { 'aria-hidden': true }
        : { role: 'img', 'aria-label': people.join(', ') };

    return (
        <span className={styles.avatars} {...label}>
            {people.map((name) => (
                <span className={styles.avatar} title={name} key={name}>
                    <Icon icon={{ component: UserRound, size: AVATAR_ICON_SIZE }} />
                </span>
            ))}
        </span>
    );
};

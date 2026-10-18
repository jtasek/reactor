import React, { FC, useState } from 'react';
import { UserRound } from 'lucide-react';
import { Icon } from '../Icon';
import styles from './styles.css';

const AVATAR_ICON_SIZE = 14;

interface Person {
    name: string;
    image?: string | null;
}

interface Props {
    people: Person[];
    /** Hides the avatars from assistive technology where the names are written next to them. */
    decorative?: boolean;
}

/** A failed photo leaves the same fallback as a person without one. */
const Avatar: FC<Person> = ({ name, image }) => {
    const [failedImage, setFailedImage] = useState<string>();

    return (
        <span className={styles.avatar} title={name}>
            <Icon icon={{ component: UserRound, size: AVATAR_ICON_SIZE }} />
            {image && image !== failedImage && (
                <img
                    src={image}
                    alt=""
                    referrerPolicy="no-referrer"
                    onError={() => setFailedImage(image)}
                />
            )}
        </span>
    );
};

/** A single person or an overlapping group, using the identities available to this view. */
export const Avatars: FC<Props> = ({ people, decorative = false }) => {
    const unique = [
        ...new Map(
            people.filter(({ name }) => name.trim()).map((person) => [person.name.trim(), person])
        ).values()
    ];

    if (unique.length === 0) {
        return null;
    }

    const label = decorative
        ? { 'aria-hidden': true }
        : { role: 'img', 'aria-label': unique.map(({ name }) => name).join(', ') };

    return (
        <span className={styles.avatars} {...label}>
            {unique.map((person) => (
                <Avatar key={person.name.trim()} {...person} />
            ))}
        </span>
    );
};

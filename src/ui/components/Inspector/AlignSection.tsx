import React, { FC } from 'react';
import { ALIGN_MINIMUM } from 'src/app/alignment';
import {
    useActions,
    useCommands,
    useCommandsEnabled,
    useMovableSelectedItemsCount
} from 'src/app/hooks';
import { ItemMenu, commandAction } from '../ItemMenu';
import styles from './styles.css';

const ROWS = [
    { category: 'align', name: 'Align' },
    { category: 'space', name: 'Space' }
];

const SECTION_CATEGORIES = new Set(ROWS.map(({ category }) => category));

/** The align and space commands, for two selected items or more. */
export const AlignSection: FC = () => {
    const commands = useCommands().filter(({ category }) => SECTION_CATEGORIES.has(category));
    const enabled = useCommandsEnabled(commands);
    const movable = useMovableSelectedItemsCount();
    const { runCommand } = useActions();

    if (movable < ALIGN_MINIMUM) {
        return null;
    }

    return (
        <section className={styles.align} aria-label="Align">
            {ROWS.map(({ category, name }) => (
                <ItemMenu
                    key={category}
                    itemName={name}
                    actions={commands.flatMap((command, index) =>
                        command.category === category
                            ? [commandAction(command, () => runCommand(command), !enabled[index])]
                            : []
                    )}
                />
            ))}
        </section>
    );
};

import React, { FC, useRef, useState } from 'react';
import { ChevronUp } from 'lucide-react';

import styles from './styles.css';

import { ToolBarButton, toolBarIcon } from './ToolBarButton';
import { ExplorerMenu } from '../Explorer/ExplorerMenu';
import { shortcutLabel, usesCommandKey } from '../CommandBar/shortcutLabel';
import type { Tool } from 'src/tools/types';

interface Props {
    tools: Tool[];
    activeToolsIds: string[];
    onClick: (toolId: string) => void;
}

const mac = usesCommandKey();

/**
 * Similar tools in one slot: the button runs the active one, or else the last one
 * picked from the menu its chevron opens.
 */
export const ToolBarGroup: FC<Props> = ({ tools, activeToolsIds, onClick }) => {
    const [pickedId, setPickedId] = useState(tools[0].id);
    const [menuAt, setMenuAt] = useState<{ x: number; y: number }>();
    const more = useRef<HTMLButtonElement>(null);
    const shown =
        tools.find((tool) => activeToolsIds.includes(tool.id)) ??
        tools.find((tool) => tool.id === pickedId) ??
        tools[0];
    const label = `Choose ${tools.map((tool) => tool.name).join(', ')}`;

    const toggleMenu = () => {
        const slot = more.current?.parentElement?.getBoundingClientRect();

        setMenuAt(menuAt || !slot ? undefined : { x: slot.left, y: slot.top - 8 });
    };

    return (
        <ToolBarButton active={activeToolsIds.includes(shown.id)} onClick={onClick} tool={shown}>
            <button
                ref={more}
                type="button"
                className={styles.more}
                aria-label={label}
                aria-haspopup="menu"
                aria-expanded={!!menuAt}
                title={label}
                onClick={toggleMenu}
            >
                <ChevronUp aria-hidden size={12} />
            </button>
            {menuAt && (
                <ExplorerMenu
                    label={label}
                    position={menuAt}
                    above
                    anchor={more.current}
                    onClose={() => setMenuAt(undefined)}
                    items={tools.map((tool) => ({
                        id: tool.id,
                        label: tool.name,
                        icon: toolBarIcon(tool),
                        checked: tool.id === shown.id,
                        detail: tool.shortcut && shortcutLabel(tool.shortcut, mac),
                        onRun: () => {
                            setPickedId(tool.id);
                            onClick(tool.id);
                        }
                    }))}
                />
            )}
        </ToolBarButton>
    );
};

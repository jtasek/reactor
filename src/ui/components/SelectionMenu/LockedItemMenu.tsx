import React, { FC, useEffect, useRef, useState } from 'react';
import type { CanvasItem } from 'src/app/membership';
import type { SelectionMenuPlacement } from 'src/app/selectionMenu';
import {
    useActions,
    useGroup,
    useHoveredLockedItem,
    useLockedItemMenuPlacement,
    useScopedCommands,
    useShape
} from 'src/app/hooks';
import { hideAction, lockAction, useItemCommandActions } from '../ItemMenu';
import { CanvasMenu } from './CanvasMenu';

type MenuProps = { id: string; placement: SelectionMenuPlacement };

const LockedShapeMenu: FC<MenuProps> = ({ id, placement }) => {
    const shape = useShape(id);
    const { toggleShapeLocked, toggleShapeVisible } = useActions();
    const commands = useItemCommandActions([id], true);

    return (
        <CanvasMenu
            placement={placement}
            shown={placement.shown}
            itemName={shape.name}
            actions={[
                hideAction(!shape.visible, () => toggleShapeVisible(id)),
                lockAction(true, () => toggleShapeLocked(id)),
                ...commands(useScopedCommands('shape'))
            ]}
        />
    );
};

const LockedGroupMenu: FC<MenuProps> = ({ id, placement }) => {
    const group = useGroup(id);
    const { toggleGroupLocked, toggleGroupVisible } = useActions();
    const commands = useItemCommandActions(group.shapesIds, true);

    return (
        <CanvasMenu
            placement={placement}
            shown={placement.shown}
            itemName={group.name}
            actions={[
                hideAction(!group.visible, () => toggleGroupVisible(id)),
                lockAction(true, () => toggleGroupLocked(id)),
                ...commands(useScopedCommands('group'))
            ]}
        />
    );
};

const sameItem = (a: CanvasItem | null, b: CanvasItem | null) =>
    a?.kind === b?.kind && a?.id === b?.id;

/**
 * The menu of the locked shape or group under the pointer, which a press passes
 * through, so it cannot be selected for the selection's menu. It fades in over
 * the item and stays while the pointer goes to it, as the selection's does.
 */
export const LockedItemMenu: FC = () => {
    const hovered = useHoveredLockedItem();
    const [item, setItem] = useState<CanvasItem | null>(null);
    const shownBefore = useRef(false);

    // The last item hovered keeps its menu while the pointer leaves it for the menu.
    if (hovered && !sameItem(hovered, item)) {
        setItem(hovered);
    }

    const placement = useLockedItemMenuPlacement(item, shownBefore.current);

    useEffect(() => {
        shownBefore.current = placement?.shown ?? false;
    });

    if (!item || !placement) {
        return null;
    }

    return item.kind === 'shape' ? (
        <LockedShapeMenu key={item.id} id={item.id} placement={placement} />
    ) : (
        <LockedGroupMenu key={item.id} id={item.id} placement={placement} />
    );
};

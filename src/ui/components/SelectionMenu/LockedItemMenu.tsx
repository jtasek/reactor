import React, { FC } from 'react';
import type { CanvasItem } from 'src/app/membership';
import type { SelectionMenuPlacement } from 'src/app/selectionMenu';
import { useActions, useGroup, useScopedCommands, useShape } from 'src/app/hooks';
import { hideAction, lockAction, useItemCommandActions } from '../ItemMenu';
import { CanvasMenu } from './CanvasMenu';

type MenuProps = {
    id: string;
    placement: SelectionMenuPlacement;
    onEngagedChange: (engaged: boolean) => void;
};

const LockedShapeMenu: FC<MenuProps> = ({ id, placement, onEngagedChange }) => {
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
            onEngagedChange={onEngagedChange}
        />
    );
};

const LockedGroupMenu: FC<MenuProps> = ({ id, placement, onEngagedChange }) => {
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
            onEngagedChange={onEngagedChange}
        />
    );
};

interface Props {
    item: CanvasItem;
    placement: SelectionMenuPlacement;
    onEngagedChange: (engaged: boolean) => void;
}

/**
 * The menu of a locked shape or group, which a press passes through, so it cannot
 * be selected for the selection's menu.
 */
export const LockedItemMenu: FC<Props> = ({ item, placement, onEngagedChange }) =>
    item.kind === 'shape' ? (
        <LockedShapeMenu
            key={item.id}
            id={item.id}
            placement={placement}
            onEngagedChange={onEngagedChange}
        />
    ) : (
        <LockedGroupMenu
            key={item.id}
            id={item.id}
            placement={placement}
            onEngagedChange={onEngagedChange}
        />
    );

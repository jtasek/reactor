import { useScreenSourceGroup } from 'src/app/frameHooks';
import type { ContainerStates } from 'src/app/containerState';
import { hasLayoutOffset } from 'src/app/frameLayout';
import type { GroupFrame } from 'src/app/membership';
import { useGroupFrames, useHoveredGroupsIds } from 'src/app/selectionHooks';
import { useAppState } from 'src/app/hooks';
import React, { FC, memo } from 'react';
import styles from './styles.css';
import { Handles } from '../Selectable/Resizable';
import {
    useGesture,
    useGroupFrame,
    useGroupLocked,
    useContainerStates,
    useSelectedGroupsIds
} from 'src/app/hooks';
import { boxCenter } from 'src/app/utils';

interface Props {
    groupId: string;
}

interface SelectionProps extends Props {
    states?: ContainerStates;
}

/** A selected group's box and handles, turned with the group. */
const GroupSelection: FC<SelectionProps> = memo(function GroupSelection({ groupId, states }) {
    const source = useScreenSourceGroup(groupId);
    const frame = useGroupFrame(groupId, states);
    const locked = useGroupLocked(groupId, states);
    const inLayout = useAppState((state) =>
        hasLayoutOffset(
            state.currentDocument,
            state.currentDocument.groups[groupId]?.shapesIds ?? []
        )
    );
    const gesture = useGesture();

    if (!frame || source) {
        return null;
    }

    const { box, rotation } = frame;
    const center = boxCenter(box);
    const activeHandle =
        gesture.kind === 'resizingGroup' && gesture.groupId === groupId
            ? gesture.handle
            : undefined;
    const rotateActive = gesture.kind === 'rotatingGroup' && gesture.groupId === groupId;

    return (
        <g transform={rotation ? `rotate(${rotation} ${center.x} ${center.y})` : undefined}>
            <rect
                className={styles.groupSelection}
                x={box.topLeft.x}
                y={box.topLeft.y}
                width={box.width}
                height={box.height}
            />
            {/* A locked group, or one with a locked shape, cannot be resized or rotated. */}
            {!locked && !inLayout && (
                <Handles
                    box={box}
                    rotation={rotation}
                    owner={{ groupId }}
                    activeHandle={activeHandle}
                    rotateActive={rotateActive}
                />
            )}
        </g>
    );
});

/** The box of a group the pointer is over, turned with the group. */
const GroupHighlight: FC<Props & { frame: GroupFrame }> = ({ groupId, frame }) => {
    const source = useScreenSourceGroup(groupId);

    if (source) {
        return null;
    }

    const { box, rotation } = frame;
    const center = boxCenter(box);

    return (
        <rect
            className={styles.groupHighlight}
            transform={rotation ? `rotate(${rotation} ${center.x} ${center.y})` : undefined}
            x={box.topLeft.x}
            y={box.topLeft.y}
            width={box.width}
            height={box.height}
        />
    );
};

/**
 * The boxes of the groups under the pointer. On its own, so a pointer move
 * renders only this, not the selected groups too.
 */
const GroupHighlights: FC = () => {
    const frames = useGroupFrames();
    const hoveredIds = useHoveredGroupsIds(frames);

    return hoveredIds.map((groupId) => {
        const frame = frames?.[groupId];

        return frame && <GroupHighlight key={groupId} groupId={groupId} frame={frame} />;
    });
};

/** Reads the container states once for all selected groups. */
const SelectedGroups: FC = () => {
    const groupsIds = useSelectedGroupsIds();
    const states = useContainerStates();

    return groupsIds.map((groupId) => (
        <GroupSelection key={groupId} groupId={groupId} states={states} />
    ));
};

/** The boxes and handles of the selected groups, and the boxes of those under the pointer. */
export const GroupSelections: FC = () => (
    <g id="group-selections">
        <GroupHighlights />
        <SelectedGroups />
    </g>
);

import React, { FC } from 'react';
import styles from './styles.css';
import { Handles } from '../Selectable/Resizable';
import {
    useGesture,
    useGroupFrame,
    useGroupLocked,
    useHoveredGroupsIds,
    useSelectedGroupsIds
} from 'src/app/hooks';
import { boxCenter } from 'src/app/utils';

interface Props {
    groupId: string;
}

/** A selected group's box and handles, turned with the group. */
export const GroupSelection: FC<Props> = ({ groupId }) => {
    const frame = useGroupFrame(groupId);
    const locked = useGroupLocked(groupId);
    const gesture = useGesture();

    if (!frame) {
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
            {!locked && (
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
};

/** The box of a group the pointer is over, turned with the group. */
const GroupHighlight: FC<Props> = ({ groupId }) => {
    const frame = useGroupFrame(groupId);

    if (!frame) {
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

/** The boxes and handles of the selected groups, and the boxes of those under the pointer. */
export const GroupSelections: FC = () => {
    const groupsIds = useSelectedGroupsIds();
    const hoveredIds = useHoveredGroupsIds();

    return (
        <g id="group-selections">
            {hoveredIds.map((groupId) => (
                <GroupHighlight key={groupId} groupId={groupId} />
            ))}
            {groupsIds.map((groupId) => (
                <GroupSelection key={groupId} groupId={groupId} />
            ))}
        </g>
    );
};

import React, { FC } from 'react';
import { useGesture } from 'src/app/hooks';
import {
    useComponent,
    useComponentFrame,
    useComponentLocked,
    useHoveredComponentsIds,
    useSelectedComponentsIds
} from 'src/app/componentHooks';
import { boxCenter } from 'src/app/utils';
import { Handles } from '../Selectable/Resizable';
import styles from './componentSelection.css';

const ComponentSelection: FC<{ componentId: string; selected: boolean }> = ({
    componentId,
    selected
}) => {
    const component = useComponent(componentId);
    const frame = useComponentFrame(componentId);
    const locked = useComponentLocked(componentId);
    const gesture = useGesture();

    if (!frame) {
        return null;
    }
    const { box, rotation } = frame;
    const center = boxCenter(box);
    const activeHandle =
        gesture.kind === 'resizingComponent' && gesture.componentId === componentId
            ? gesture.handle
            : undefined;
    const rotateActive =
        gesture.kind === 'rotatingComponent' && gesture.componentId === componentId;

    return (
        <g
            data-component-selection={componentId}
            transform={`rotate(${rotation} ${center.x} ${center.y})`}
        >
            <rect
                className={selected ? styles.selected : styles.highlight}
                x={box.topLeft.x}
                y={box.topLeft.y}
                width={box.width}
                height={box.height}
            />
            {!selected && (
                <text className={styles.label} x={box.topLeft.x} y={box.topLeft.y - 6}>
                    {component.name}
                </text>
            )}
            {selected && !locked && (
                <Handles
                    box={box}
                    rotation={rotation}
                    owner={{ componentId }}
                    activeHandle={activeHandle}
                    rotateActive={rotateActive}
                />
            )}
        </g>
    );
};

/** One bounding box and handle set per component, rather than one per source member. */
export const ComponentOutlines: FC = () => {
    const selectedIds = useSelectedComponentsIds();
    const hoveredIds = useHoveredComponentsIds();

    return (
        <g id="component-selections">
            {hoveredIds.map((componentId) => (
                <ComponentSelection key={componentId} componentId={componentId} selected={false} />
            ))}
            {selectedIds.map((componentId) => (
                <ComponentSelection key={componentId} componentId={componentId} selected />
            ))}
        </g>
    );
};

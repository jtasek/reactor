import React, { type FC } from 'react';
import { useGesture } from 'src/app/hooks';
import type { useScreenViewContainers } from 'src/app/frameHooks';
import { boxCenter } from 'src/app/utils';
import { Handles } from '../Selectable/Resizable';
import groupStyles from '../GroupSelection/styles.css';
import componentStyles from '../Shape/componentSelection.css';

type ContainerSelection = ReturnType<typeof useScreenViewContainers>[number];

/** Pointer-following handle state stays out of the view's geometry projection. */
export const ScreenViewContainerSelection: FC<ContainerSelection & { viewId: string }> = ({
    owner,
    frame: { box, rotation },
    transformable,
    viewId
}) => {
    const gesture = useGesture();
    const ownsGesture =
        'screenView' in gesture &&
        gesture.screenView?.address.viewId === viewId &&
        ('groupId' in owner
            ? 'groupId' in gesture && gesture.groupId === owner.groupId
            : 'componentId' in gesture && gesture.componentId === owner.componentId);
    const center = boxCenter(box);
    const component = 'componentId' in owner;

    return (
        <g
            data-group-selection={'groupId' in owner ? owner.groupId : undefined}
            data-component-selection={component ? owner.componentId : undefined}
            transform={`rotate(${rotation} ${center.x} ${center.y})`}
        >
            <rect
                className={component ? componentStyles.selected : groupStyles.groupSelection}
                x={box.topLeft.x}
                y={box.topLeft.y}
                width={box.width}
                height={box.height}
            />
            {transformable && (
                <Handles
                    box={box}
                    rotation={rotation}
                    owner={owner}
                    activeHandle={
                        ownsGesture && 'handle' in gesture && gesture.handle !== 'move'
                            ? gesture.handle
                            : undefined
                    }
                    rotateActive={
                        ownsGesture &&
                        (gesture.kind === 'rotatingGroup' || gesture.kind === 'rotatingComponent')
                    }
                />
            )}
        </g>
    );
};

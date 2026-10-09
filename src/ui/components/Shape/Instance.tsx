import React, { CSSProperties, FC } from 'react';
import type { InstanceShape, Shape } from 'src/app/types';
import type { ComponentSource } from 'src/app/componentSource';
import { componentSource } from 'src/app/componentSource';
import { instanceMember } from 'src/app/componentProps';
import { boxCenter, getShapeBounds } from 'src/app/utils';
import { useCurrentDocument } from 'src/app/hooks';
import { getComponentByType } from 'src/tools/components';

interface Props {
    instance: InstanceShape;
    source: ComponentSource | null;
    ancestors?: ReadonlySet<string>;
}

/** Draws source primitives in an instance's own frame; source flags do not affect them. */
export const Instance: FC<Props> = ({ instance, source, ancestors = new Set() }) => {
    const document = useCurrentDocument();

    if (!source) {
        return (
            <rect
                x={instance.position.x}
                y={instance.position.y}
                width={24}
                height={24}
                fill="none"
                stroke="currentColor"
                strokeDasharray="4 3"
            />
        );
    }

    const next = new Set(ancestors).add(instance.componentId);
    const component = document.components[instance.componentId];
    const offsetX = instance.position.x - source.box.topLeft.x;
    const offsetY = instance.position.y - source.box.topLeft.y;

    return (
        <g transform={`translate(${offsetX} ${offsetY})`}>
            {source.shapes.map((member: Shape) => {
                const shape = component
                    ? instanceMember(member, instance, component, document)
                    : member;
                if (!shape.visible) {
                    return null;
                }
                const center = boxCenter(getShapeBounds(shape));
                const transform = shape.rotation
                    ? `rotate(${shape.rotation} ${center.x} ${center.y})`
                    : undefined;

                if (shape.type === 'instance') {
                    return (
                        <g key={shape.id} transform={transform}>
                            <Instance
                                instance={shape}
                                source={componentSource(document, shape.componentId, next)}
                                ancestors={next}
                            />
                        </g>
                    );
                }

                const Primitive = getComponentByType(shape.type) as FC<Omit<Shape, 'key'>>;

                return (
                    <g
                        key={shape.id}
                        transform={transform}
                        opacity={shape.opacity}
                        style={
                            {
                                '--shape-fill': shape.fill,
                                '--shape-stroke': shape.stroke,
                                pointerEvents: 'none'
                            } as CSSProperties
                        }
                    >
                        <Primitive {...shape} selected={false} />
                    </g>
                );
            })}
        </g>
    );
};

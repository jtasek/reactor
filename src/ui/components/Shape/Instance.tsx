import React, { CSSProperties, FC } from 'react';
import type { InstanceShape, Shape, VariableContext } from 'src/app/types';
import type { ComponentSource } from 'src/app/componentSource';
import { instanceComponent, instanceSource } from 'src/app/componentSource';
import { applyInstanceOverrides } from 'src/app/componentProps';
import { boxCenter, getShapeBounds } from 'src/app/utils';
import { themeColors } from 'src/app/themeColors';
import { useCurrentDocument } from 'src/app/hooks';
import { instanceModes } from 'src/app/inheritedModes';
import { getComponentByType } from 'src/tools/components';

interface Props {
    instance: InstanceShape;
    source: ComponentSource | null;
    ancestors?: ReadonlySet<string>;
    context: VariableContext;
}

/** Draws source primitives in an instance's own frame; source flags do not affect them. */
export const Instance: FC<Props> = ({
    instance,
    source,
    ancestors = new Set(),
    context: theme
}) => {
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

    const component = instanceComponent(document, instance);
    const ancestorComponentIds = new Set(ancestors).add(component?.id ?? instance.componentId);
    const offsetX = instance.position.x - source.box.topLeft.x;
    const offsetY = instance.position.y - source.box.topLeft.y;

    return (
        <g transform={`translate(${offsetX} ${offsetY})`}>
            {source.shapes.map((member: Shape) => {
                const painted = themeColors(member, document, theme);
                const shape =
                    component && !instance.projectedSource
                        ? applyInstanceOverrides(painted, instance, component, document, theme)
                        : painted;
                if (!shape.visible) {
                    return null;
                }
                const center = boxCenter(getShapeBounds(shape));
                const transform = shape.rotation
                    ? `rotate(${shape.rotation} ${center.x} ${center.y})`
                    : undefined;

                if (shape.type === 'instance') {
                    return (
                        <g key={shape.id} transform={transform} opacity={shape.opacity}>
                            <Instance
                                instance={shape}
                                source={instanceSource(document, shape, ancestorComponentIds)}
                                ancestors={ancestorComponentIds}
                                context={instanceModes(document, theme, shape)}
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

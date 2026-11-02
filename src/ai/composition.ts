import { composeScreen, type CompositionLibrary } from 'src/app/screenComposition';
import type { PropertyValue } from 'src/app/types';
import { columnComposition, type ColumnComposition } from 'src/app/columnComposition';

function object(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Screen composition requires objects for its records.');
    }

    return value as Record<string, unknown>;
}

function string(value: unknown, label: string, empty = false): string {
    if (typeof value !== 'string' || (!empty && !value.trim())) {
        throw new Error(`Supply ${label} as text.`);
    }

    return value;
}

function number(value: unknown, label: string, minimum = 0): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum) {
        throw new Error(`${label} must be a finite number of at least ${minimum}.`);
    }

    return value;
}

function items(value: unknown, label: string) {
    if (!Array.isArray(value) || value.length > 100) {
        throw new Error(`${label} must be a list of at most 100 items.`);
    }

    return value.map(object);
}

/** Only public descriptions supplied with the request are available to the compiler. */
function libraryFrom(context: unknown): CompositionLibrary {
    const contextObject = object(context);
    const variables = Object.fromEntries(
        Object.entries(object(contextObject.variables ?? {})).map(([id, raw]) => {
            const variable = object(raw);
            const resolved = variable.resolved === undefined ? variable : object(variable.resolved);

            return [
                id,
                {
                    type: string(variable.type, 'variable type'),
                    value: resolved.value as PropertyValue
                }
            ];
        })
    );
    const components = Object.fromEntries(
        Object.entries(object(contextObject.components ?? {})).map(([id, raw]) => {
            const component = object(raw);
            const interaction = object(component.interaction ?? { role: 'none', props: {} });
            const links = Object.fromEntries(
                Object.entries(object(interaction.props)).map(([field, value]) => [
                    field,
                    string(value, 'property ID')
                ])
            );
            const size = component.size === undefined ? undefined : object(component.size);

            return [
                id,
                {
                    role: string(interaction.role, 'component role'),
                    links,
                    textProperties: items(component.props ?? [], 'Component properties')
                        .filter((prop) => prop.type === 'text')
                        .map((prop) => string(prop.id, 'property ID')),
                    ...(size
                        ? {
                              size: {
                                  width: number(size.width, 'Component width'),
                                  height: number(size.height, 'Component height')
                              }
                          }
                        : {})
                }
            ];
        })
    );

    return { variables, components };
}

/** Parse the high-level authoring payload before it reaches the canonical batch validator. */
export function readScreenComposition(
    value: unknown,
    context: unknown,
    reservedKeys: Iterable<string>
) {
    const screen = object(value);
    if (screen.content !== undefined) {
        const library = libraryFrom(context);
        const content = items(screen.content, 'Content');
        if (!content.length) {
            throw new Error('Include the screen content, not just its background.');
        }
        const textContent = (item: Record<string, unknown>) => ({
            text: string(item.text, 'visible text'),
            fontSize: number(item.fontSize, 'Font size', 1),
            color: string(item.color, 'text color')
        });
        const column: ColumnComposition = {
            key: string(screen.key, 'screen key'),
            name: string(screen.name, 'screen name'),
            x: number(screen.x ?? 0, 'Screen X', -Infinity),
            y: number(screen.y ?? 0, 'Screen Y', -Infinity),
            width: number(screen.width, 'Screen width', 1),
            height: number(screen.height, 'Screen height', 1),
            background: string(screen.background, 'background color'),
            padding: number(screen.padding, 'Padding'),
            gap: number(screen.gap, 'Gap'),
            content: content.map((item) => {
                const spacing =
                    item.gapBefore === undefined
                        ? {}
                        : { gapBefore: number(item.gapBefore, 'Gap before content') };
                if (item.kind === 'text') {
                    return { kind: 'text', ...textContent(item), ...spacing };
                }
                if (item.kind !== 'button' && item.kind !== 'input') {
                    throw new Error(
                        'Content must be text, button or input. Use other drawing tools for decorative artwork.'
                    );
                }
                const candidates = Object.keys(library.components).filter(
                    (id) => library.components[id].role === item.kind
                );
                const componentId =
                    item.componentId === undefined && candidates.length === 1
                        ? candidates[0]
                        : string(
                              item.componentId,
                              `component ID for ${item.kind}: choose ${candidates.join(', ')}`
                          );
                if (!candidates.includes(componentId)) {
                    throw new Error(
                        `${componentId} is not a ${item.kind}. Choose ${candidates.join(', ')}.`
                    );
                }

                return {
                    kind: item.kind,
                    componentId,
                    label: string(item.label, 'control label'),
                    placeholder: string(item.placeholder, 'placeholder (empty for buttons)', true),
                    ...spacing
                };
            }),
            ...(screen.footer === undefined ? {} : { footer: textContent(object(screen.footer)) })
        };

        return composeScreen(columnComposition(column, library), library, reservedKeys);
    }
    const texts = items(screen.texts, 'Texts');
    const controls = items(screen.controls, 'Controls');
    const rectangles = items(screen.rectangles, 'Rectangles');
    if (!texts.length && !controls.length && !rectangles.length) {
        throw new Error('Include the screen content, not just its background.');
    }
    if (texts.length + controls.length + rectangles.length > 100) {
        throw new Error('A composition supports at most 100 content items.');
    }

    return composeScreen(
        {
            key: string(screen.key, 'screen key'),
            name: string(screen.name, 'screen name'),
            x: number(screen.x ?? 0, 'Screen X', -Infinity),
            y: number(screen.y ?? 0, 'Screen Y', -Infinity),
            width: number(screen.width, 'Screen width', 1),
            height: number(screen.height, 'Screen height', 1),
            background: string(screen.background, 'background color'),
            texts: texts.map((item) => ({
                text: string(item.text, 'visible text'),
                x: number(item.x, 'Text X'),
                y: number(item.y, 'Text Y'),
                width: number(item.width, 'Text width', 1),
                fontSize: number(item.fontSize, 'Font size', 1),
                color: string(item.color, 'text color')
            })),
            controls: controls.map((item) => ({
                componentId: string(item.componentId, 'component ID'),
                x: number(item.x, 'Control X'),
                y: number(item.y, 'Control Y'),
                label: string(item.label, 'control label'),
                placeholder: string(item.placeholder, 'placeholder (empty for buttons)', true)
            })),
            rectangles: rectangles.map((item) => ({
                x: number(item.x, 'Rectangle X'),
                y: number(item.y, 'Rectangle Y'),
                width: number(item.width, 'Rectangle width', 1),
                height: number(item.height, 'Rectangle height', 1),
                fill: string(item.fill, 'fill color', true),
                stroke: string(item.stroke, 'stroke color', true),
                radius: number(item.radius, 'Corner radius')
            }))
        },
        libraryFrom(context),
        reservedKeys
    );
}

import type { AddFrame, AddShape } from './operations';
import type { PropertyValue } from './types';
import { measureContextualText } from './textMeasurement';
import { screenOperations } from './screenAuthoring';
import { escapeTemplate } from './variables';

export interface CompositionLibrary {
    variables: Record<string, { type: string; value: PropertyValue; alias?: string }>;
    components: Record<
        string,
        {
            role: string;
            links: Record<string, string>;
            textProperties: string[];
            size?: { width: number; height: number };
        }
    >;
}

export interface ScreenComposition {
    key: string;
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
    background: string;
    texts: Array<{
        text: string;
        x: number;
        y: number;
        width: number;
        fontSize: number;
        color: string;
    }>;
    controls: Array<{
        componentId: string;
        x: number;
        y: number;
        label: string;
        placeholder: string;
    }>;
    rectangles: Array<{
        x: number;
        y: number;
        width: number;
        height: number;
        fill: string;
        stroke: string;
        radius: number;
    }>;
}

/** Explicit color IDs follow variables. An exact, unambiguous palette match follows it too. */
function color(value: string, field: string, library: CompositionLibrary) {
    if (value === '') {
        return {};
    }
    const variable = Object.hasOwn(library.variables, value) ? library.variables[value] : undefined;
    if (variable) {
        if (variable.type !== 'color') {
            throw new Error(`${value} is not a color variable.`);
        }

        return { bindings: { [field]: value } };
    }
    if (!/^#[\da-f]{6}$/i.test(value)) {
        throw new Error(`${value} must be a color variable ID or #rrggbb.`);
    }
    const exact = Object.entries(library.variables).filter(
        ([, variable]) =>
            variable.type === 'color' &&
            String(variable.value).toLowerCase() === value.toLowerCase()
    );
    // A semantic alias and the primitive it points at show the same color: prefer the alias.
    const aliased = new Set(exact.flatMap(([, variable]) => variable.alias ?? []));
    const matches = exact.filter(([id]) => !aliased.has(id));
    if (matches.length > 1) {
        throw new Error(
            `Several variables match ${value}; specify the intended color variable ID.`
        );
    }

    return matches.length ? { bindings: { [field]: matches[0][0] } } : { [field]: value };
}

function colors(fill: string, stroke: string, library: CompositionLibrary) {
    const inside = color(fill, 'fill', library);
    const outline = color(stroke, 'stroke', library);

    return { ...inside, ...outline, bindings: { ...inside.bindings, ...outline.bindings } };
}

function inside(screen: ScreenComposition, x: number, y: number, width: number, height: number) {
    if (x < 0 || y < 0 || x + width > screen.width || y + height > screen.height) {
        throw new Error(
            `Content at ${x}, ${y} extends outside the screen. Use top-left coordinates and keep the complete content inside ${screen.width} × ${screen.height}.`
        );
    }
}

/** Composed controls and external text are independent content, never deliberate overlays. */
function checkContentLayout(screen: ScreenComposition, library: CompositionLibrary) {
    const boxes = [
        ...screen.texts.map((item) => {
            const measured = measureContextualText({
                value: item.text,
                fontSize: item.fontSize,
                wrapWidth: item.width,
                position: { x: 0, y: 0 }
            });

            return {
                name: `text “${item.text}”`,
                x: item.x,
                y: item.y,
                width: measured.bounds.width,
                height: measured.bounds.height
            };
        }),
        ...screen.controls.flatMap((item) => {
            const component = library.components[item.componentId];

            return component?.size
                ? [{ name: `control “${item.label}”`, x: item.x, y: item.y, ...component.size }]
                : [];
        })
    ];
    const overlaps = boxes.flatMap((first, index) =>
        boxes.slice(index + 1).flatMap((second) => {
            const intersects =
                first.x < second.x + second.width &&
                first.x + first.width > second.x &&
                first.y < second.y + second.height &&
                first.y + first.height > second.y;

            return intersects
                ? [
                      `${first.name} (${first.x},${first.y}, ${first.width}×${first.height}) overlaps ${second.name} (${second.x},${second.y}, ${second.width}×${second.height})`
                  ]
                : [];
        })
    );
    if (overlaps.length) {
        throw new Error(
            `Separate the content: ${overlaps.slice(0, 8).join('; ')}. Keep input labels above their fields, not on another control. Return the complete corrected composition.`
        );
    }
}

/** Semantic authoring only; no template lookup, document writes or new durable entity types. */
export function composeScreen(
    screen: ScreenComposition,
    library: CompositionLibrary,
    reservedKeys: Iterable<string> = []
): Array<AddFrame | AddShape> {
    checkContentLayout(screen, library);
    const frame: AddFrame = {
        op: 'addFrame',
        key: screen.key,
        frame: {
            kind: 'screen',
            name: screen.name,
            position: { x: screen.x, y: screen.y },
            size: { width: screen.width, height: screen.height },
            visible: true,
            locked: false
        }
    };
    const background: AddShape = {
        op: 'addShape',
        key: 'background',
        shape: {
            type: 'rectangle',
            name: 'Background',
            position: { x: screen.x, y: screen.y },
            size: { width: screen.width, height: screen.height },
            ...color(screen.background, 'fill', library)
        }
    };
    const rectangles: AddShape[] = screen.rectangles.map((item, index) => {
        inside(screen, item.x, item.y, item.width, item.height);

        return {
            op: 'addShape',
            key: `rectangle-${index}`,
            shape: {
                type: 'rectangle',
                position: { x: screen.x + item.x, y: screen.y + item.y },
                size: { width: item.width, height: item.height },
                cornerRadius: item.radius,
                ...colors(item.fill, item.stroke, library)
            }
        };
    });
    const texts: AddShape[] = screen.texts.map((item, index) => {
        const measured = measureContextualText({
            value: item.text,
            fontSize: item.fontSize,
            wrapWidth: item.width,
            position: { x: 0, y: 0 }
        });
        inside(screen, item.x, item.y, item.width, measured.bounds.height);

        return {
            op: 'addShape',
            key: `text-${index}`,
            shape: {
                type: 'text',
                name: item.text,
                value: escapeTemplate(item.text),
                fontSize: item.fontSize,
                wrapWidth: item.width,
                position: {
                    x: screen.x + item.x - measured.bounds.topLeft.x,
                    y: screen.y + item.y - measured.bounds.topLeft.y
                },
                ...color(item.color, 'fontColor', library)
            }
        };
    });
    const controls: AddShape[] = screen.controls.map((item, index) => {
        const component = Object.hasOwn(library.components, item.componentId)
            ? library.components[item.componentId]
            : undefined;
        if (!component || !['button', 'input'].includes(component.role)) {
            throw new Error(
                `${item.componentId} is not an available Button or Input component. Use a supplied component ID, or draw unavailable controls using text and rectangles.`
            );
        }
        const property = (field: string) => {
            const id = component.links[field];
            if (!id || !component.textProperties.includes(id)) {
                throw new Error(
                    `${item.componentId} has no compatible ${field} property. Choose a compatible component.`
                );
            }

            return id;
        };
        if (!item.label.trim()) {
            throw new Error('Every control needs its actual label, including inputs.');
        }
        const overrides = { [property('label')]: escapeTemplate(item.label) };
        if (component.role === 'input') {
            overrides[property('placeholder')] = escapeTemplate(item.placeholder);
        }
        inside(screen, item.x, item.y, component.size?.width ?? 0, component.size?.height ?? 0);

        return {
            op: 'addShape',
            key: `control-${index}`,
            shape: {
                type: 'instance',
                name: item.label,
                componentId: item.componentId,
                position: { x: screen.x + item.x, y: screen.y + item.y },
                overrides
            }
        };
    });

    return screenOperations(
        frame,
        [background, ...rectangles, ...texts, ...controls],
        reservedKeys
    );
}

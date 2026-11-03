import { CREATION_PATTERN, readParameters } from './creation';
import { SELECTION_PATTERN } from './selection';

export interface ParameterEditor {
    title: string;
    prefix: string;
    values: Record<string, string>;
    creation: boolean;
}

export const EDIT_ACTIONS = [
    {
        id: 'edit size',
        name: 'Resize selection',
        description: 'Set width and height',
        keys: ['width', 'height']
    },
    {
        id: 'edit radius',
        name: 'Set radius',
        description: 'Round rectangles or size circles',
        keys: ['radius']
    },
    {
        id: 'edit position',
        name: 'Move selection',
        description: 'Move by horizontal and vertical offsets',
        keys: ['x', 'y']
    },
    {
        id: 'edit stack',
        name: 'Edit stack spacing',
        description: 'Set gap and padding on an existing stack',
        keys: ['gap', 'padding']
    }
];

export const parameterLabel = (key: string) =>
    ({
        width: 'Width',
        height: 'Height',
        radius: 'Radius',
        x: 'Horizontal offset',
        y: 'Vertical offset',
        gap: 'Gap',
        padding: 'Padding',
        value: 'Text',
        fontSize: 'Font size',
        fill: 'Fill',
        name: 'Name'
    })[key] ?? key;

export function editorForAction(id: string): ParameterEditor | undefined {
    const kind = id.startsWith('create ') ? id.slice(7) : undefined;
    if (kind && ['rectangle', 'circle', 'text'].includes(kind)) {
        return {
            title: `Create ${kind}`,
            prefix: `create ${kind}`,
            creation: true,
            values:
                kind === 'rectangle'
                    ? { width: '160', height: '48' }
                    : kind === 'circle'
                      ? { radius: '24' }
                      : { value: 'Text', fontSize: '24' }
        };
    }
    const action = EDIT_ACTIONS.find((item) => item.id === id);

    return action
        ? {
              title: action.name,
              prefix: id === 'edit position' ? 'move' : '',
              creation: false,
              values: Object.fromEntries(action.keys.map((key) => [key, '']))
          }
        : undefined;
}

/** Reading typed input never normalizes it until the user edits a parameter. */
export function editorForInput(input: string): ParameterEditor | undefined {
    const creation = CREATION_PATTERN.exec(input.trim());
    if (creation && !input.includes('=')) {
        return undefined;
    }
    if (!creation && !SELECTION_PATTERN.test(input.trim())) {
        return undefined;
    }
    try {
        const prefix = creation ? creation[0] : /^move\s/i.test(input.trim()) ? 'move' : '';
        const values = readParameters(` ${input.trim().slice(prefix.length).trim()}`);

        return {
            title: creation
                ? `Create ${creation[1].toLowerCase()}`
                : prefix
                  ? 'Move selection'
                  : 'Edit selection',
            prefix,
            values,
            creation: Boolean(creation)
        };
    } catch {
        return undefined;
    }
}

export function editorInput(editor: ParameterEditor): string {
    const values = Object.entries(editor.values)
        .filter(([, value]) => editor.creation || value !== '')
        .map(
            ([key, value]) =>
                `${key}=${['value', 'name'].includes(key) ? JSON.stringify(value) : value}`
        );

    return [editor.prefix, ...values].filter(Boolean).join(' ');
}

import { CREATION_PARAMETERS, CREATION_PATTERN, parameterKey, readParameters } from './creation';
import type { Suggestion } from './search';

export interface CompletionProperty {
    key: string;
    label: string;
    kind: string;
    /** Whether a selected target follows a variable here; unbind offers only these. */
    bound?: boolean;
}
export interface CompletionVariable {
    id: string;
    name: string;
    type: string;
    /** Property keys this variable can bind to on the current selection, when known. */
    bindsTo?: string[];
}

/** Whether a variable can follow this property; without `bindsTo`, only the type is known. */
export const canSuggestBinding = (variable: CompletionVariable, property?: CompletionProperty) =>
    Boolean(property) &&
    (variable.bindsTo
        ? variable.bindsTo.includes(property!.key)
        : variable.type === property!.kind);

/** Complete only the trailing token; quoted text and earlier arguments remain untouched. */
export function completeParameters(
    input: string,
    properties: CompletionProperty[],
    variables: CompletionVariable[],
    literalProperties = properties.map(({ key }) => key)
): Suggestion[] {
    const creation = CREATION_PATTERN.exec(input.trimStart());
    const binding = /^(bind|unbind)\s+/i.exec(input.trimStart());
    const moving = /^move\s+/i.exec(input.trimStart());
    const prefix = creation?.[0] ?? binding?.[0] ?? moving?.[0] ?? '';
    const offset = input.length - input.trimStart().length + prefix.length;
    const rest = input.slice(offset);
    if (creation && !rest) {
        return [];
    }
    const start = tokenStart(rest);
    const token = rest.slice(start);
    const head = input.slice(0, offset + start);
    const equals = token.indexOf('=');
    const key = equals < 0 ? '' : parameterKey(token.slice(0, equals));
    const fragment = equals < 0 ? token : token.slice(equals + 1);
    const prior = readPrior(rest.slice(0, start));
    if (!prior) {
        return [];
    }
    const candidates = () => {
        if (key === 'variable' && binding?.[1].toLowerCase() === 'bind') {
            const propertyKey = bindingKey(prior.property ?? '');
            const property = properties.find((item) => bindingKey(item.key) === propertyKey);

            return variables
                .filter((variable) => canSuggestBinding(variable, property))
                .map((variable) => ({
                    value: JSON.stringify(variable.id),
                    name: variable.name,
                    description: `${variable.type} · ${variable.id}`,
                    search: [variable.name, variable.id]
                }));
        }
        if (key === 'property' && binding) {
            return properties
                .filter(
                    (property) => binding[1].toLowerCase() === 'bind' || property.bound !== false
                )
                .map((property) => ({
                    value: property.key,
                    name: property.label,
                    description: property.key,
                    search: [property.key, property.label]
                }));
        }
        if (equals >= 0 || (!prefix && !input.includes('=') && token.length < 2)) {
            return [];
        }
        const keys = binding
            ? binding[1].toLowerCase() === 'bind'
                ? ['property', 'variable']
                : ['property']
            : moving
              ? ['x', 'y']
              : creation
                ? CREATION_PARAMETERS[creation[1].toLowerCase()]
                : literalProperties.map((key) => (key === 'cornerRadius' ? 'radius' : key));

        return keys
            .filter((key) => !Object.hasOwn(prior, parameterKey(key)))
            .map((key) => ({
                value: `${key}=`,
                name: key,
                description: 'Insert property',
                search: [key]
            }));
    };
    const query = completionQuery(fragment);
    if (query === undefined) {
        return [];
    }

    return candidates()
        .filter((item) => item.search.some((value) => value.toLowerCase().startsWith(query)))
        .filter((item) => item.value !== fragment)
        .slice(0, 8)
        .map((item) => ({
            id: `complete:${item.value}`,
            name: item.name,
            description: item.description,
            enabled: true,
            input: `${head}${equals < 0 ? '' : token.slice(0, equals + 1)}${item.value}`
        }));
}

function readPrior(input: string): Record<string, string> | undefined {
    try {
        return readParameters(` ${input}`);
    } catch {
        return undefined;
    }
}

function tokenStart(input: string): number {
    // These cursors track lexical state, including spaces inside a quoted variable name.
    let start = 0;
    let quoted = false;
    let escaped = false;
    for (const [index, character] of input.split('').entries()) {
        if (escaped) {
            escaped = false;
            continue;
        }
        if (character === '\\' && quoted) {
            escaped = true;
            continue;
        }
        if (character === '"') {
            quoted = !quoted;
            continue;
        }
        if (/\s/.test(character) && !quoted) {
            start = index + 1;
        }
    }

    return start;
}

function bindingKey(key: string) {
    const normalized = parameterKey(key);

    return normalized === 'radius' ? 'cornerradius' : normalized;
}

function completionQuery(fragment: string): string | undefined {
    if (!fragment.startsWith('"')) {
        return fragment.toLowerCase();
    }
    for (const candidate of [fragment, `${fragment}"`]) {
        try {
            return (JSON.parse(candidate) as string).toLowerCase();
        } catch {
            // A partial quoted name may need its closing quote; invalid escapes wait for typing.
        }
    }

    return undefined;
}

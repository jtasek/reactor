import type { Theme, Variable } from './types';

/** The variable named `name`; of several, as merges can leave, the one with the lowest id. */
export function variableNamed(
    variables: Readonly<Record<string, Variable>>,
    name: string
): Variable | undefined {
    return Object.values(variables)
        .filter((variable) => variable.name === name)
        .sort((a, b) => (a.id < b.id ? -1 : 1))[0];
}

/**
 * `\${`, kept as written, or `${...}`: a variable's name, or its id followed by `$`
 * and the name it had, which shows when no variable has the id.
 */
export const TEMPLATE_PART = /\\\$\{|\$\{([^{}$]*)(?:\$([^{}$]*))?\}/g;

/** How deep text variables may name others in their values, so a long chain still ends. */
const TEMPLATE_DEPTH = 16;

/** The variable a template's `${...}` holds: by id, else by name. */
export const templateVariable = (
    variables: Readonly<Record<string, Variable>>,
    inside: string,
    name: string | undefined
) =>
    Object.hasOwn(variables, inside) ? variables[inside] : variableNamed(variables, name ?? inside);

/**
 * The text `template` makes: each `${...}` naming a variable, or holding its id,
 * replaced by its value, a text variable's own template made too. A part naming no
 * variable, or a text variable leading back to itself, shows its name as written.
 * With `problems`, it collects those names instead of building the text.
 */
export function resolveText(
    template: string,
    variables: Readonly<Record<string, Variable>>,
    within: string[],
    problems?: string[]
): string {
    return template.replace(
        TEMPLATE_PART,
        (_, inside: string | undefined, name: string | undefined) => {
            if (inside === undefined) {
                return '${';
            }

            const variable = templateVariable(variables, inside, name);

            if (!variable) {
                problems?.push(name ?? inside);

                return `\${${name ?? inside}}`;
            }

            if (within.includes(variable.id) || within.length >= TEMPLATE_DEPTH) {
                problems?.push(variable.name);

                return `\${${variable.name}}`;
            }

            const value = resolveValue(variable, variables, within, problems);

            // Diagnostics follow the same references without building expanded text.
            return problems ? '' : String(value);
        }
    );
}

/** Resolve aliases and templates together, sharing the same cycle and depth bounds. */
function resolveValue(
    variable: Variable,
    variables: Readonly<Record<string, Variable>>,
    within: string[],
    problems?: string[],
    theme: Theme = 'light'
): string | number | boolean {
    const path = [...within, variable.id];
    let source = variable;
    while (source.alias !== undefined) {
        const target = variables[source.alias];
        if (
            !target ||
            target.type !== source.type ||
            path.includes(target.id) ||
            path.length >= TEMPLATE_DEPTH
        ) {
            problems?.push(
                !target
                    ? `Missing source ${source.alias}`
                    : target.type !== source.type
                      ? `${source.name} requires a ${source.type} source`
                      : `Circular or too deep: ${target.name}`
            );
            source = variable;
            break;
        }
        source = target;
        path.push(source.id);
    }
    return source.type === 'text'
        ? resolveText(source.values.default, variables, path, problems)
        : source.type === 'color' && theme === 'dark'
          ? (source.values.dark ?? source.values.default)
          : source.values.default;
}

/** The value a variable writes, following same-type aliases and text templates. */
export const resolveVariable = (
    variable: Variable,
    variables: Readonly<Record<string, Variable>>,
    theme: Theme = 'light'
) => resolveValue(variable, variables, [], undefined, theme);

/** Reference problems in an alias's resolved value; useful for validation and editor diagnostics. */
export function variableProblems(
    variable: Variable,
    variables: Readonly<Record<string, Variable>>
): string[] {
    const problems: string[] = [];
    resolveValue(variable, variables, [], problems);
    return problems;
}

/** The text a template makes, using the document's default variable values. */
export const resolveTemplate = (
    template: string,
    variables: Readonly<Record<string, Variable>>
): string => resolveText(template, variables, []);

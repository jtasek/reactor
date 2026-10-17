import type { Variable } from './types';

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
 */
function resolveText(
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

            const value =
                variable.type === 'text'
                    ? resolveText(
                          variable.values.default,
                          variables,
                          [...within, variable.id],
                          problems
                      )
                    : String(variable.values.default);

            // Diagnostics follow the same references without building expanded text.
            return problems ? '' : value;
        }
    );
}

/** The value a variable writes: a text variable's template made into text. */
export const resolveVariable = (
    variable: Variable,
    variables: Readonly<Record<string, Variable>>
) =>
    variable.type === 'text'
        ? resolveText(variable.values.default, variables, [variable.id])
        : variable.values.default;

/** The text a template makes, using the document's default variable values. */
export const resolveTemplate = (
    template: string,
    variables: Readonly<Record<string, Variable>>
): string => resolveText(template, variables, []);

/** The names of missing, cyclic or too deeply nested references, in template order. */
export function templateProblems(
    template: string,
    variables: Readonly<Record<string, Variable>>,
    within: string[] = []
): string[] {
    const problems: string[] = [];
    resolveText(template, variables, within, problems);

    return problems;
}

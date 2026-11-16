import type { DataField, DataValue } from './dataTypes';

/**
 * The one condition vocabulary for form rules, interactive state and later workflows (see the
 * plan's "Actions and expressions" decision). Conditions are typed trees stored as JSON; there is
 * no formula text to parse.
 */
export type Operand =
    | { kind: 'value'; value: DataValue }
    /** A field of the record being checked, such as the record a form edits. */
    | { kind: 'field'; fieldId: string }
    /** A named boolean state value of the player session. */
    | { kind: 'state'; stateId: string };

export type Comparison = 'equals' | 'notEquals' | 'less' | 'greater' | 'contains';

export type Condition =
    | { kind: Comparison; left: Operand; right: Operand }
    | { kind: 'isSet'; operand: Operand }
    | { kind: 'and' | 'or'; conditions: Condition[] }
    | { kind: 'not'; condition: Condition };

export const COMPARISONS: readonly Comparison[] = [
    'equals',
    'notEquals',
    'less',
    'greater',
    'contains'
];

/** Bounds a stored tree so a damaged or hostile document can't make checking expensive. */
export const MAX_CONDITION_DEPTH = 8;
export const MAX_CONDITION_NODES = 50;

/** What a condition may refer to where it is used. A form rule has no state, for example. */
export interface ConditionScope {
    field?: (id: string) => DataField | undefined;
    state?: (id: string) => { name: string } | undefined;
}

/** `missing` is a field already reported as missing, so it adds no type problem. */
type OperandType = 'string' | 'number' | 'boolean' | 'null' | 'missing';

const unset = (value: DataValue | undefined) =>
    value === null || value === undefined || (typeof value === 'string' && !value.trim());

/**
 * Problems that make a condition meaningless where it is used: missing fields or state, or
 * operands that can never compare. An empty list means the evaluator can run it.
 */
export function conditionProblems(condition: Condition, scope: ConditionScope): string[] {
    const problems: string[] = [];
    const operand = (item: Operand): { type: OperandType; field?: DataField } => {
        if (item.kind === 'value') {
            return {
                type:
                    item.value === null
                        ? 'null'
                        : (typeof item.value as 'string' | 'number' | 'boolean')
            };
        }
        if (item.kind === 'state') {
            if (!scope.state) {
                problems.push('State values are not available here.');
            } else if (!scope.state(item.stateId)) {
                problems.push('Uses a state value that no longer exists.');
            }

            return { type: 'boolean' };
        }
        const field = scope.field?.(item.fieldId);
        if (!scope.field) {
            problems.push('Record fields are not available here.');
        } else if (!field) {
            problems.push('Uses a field that no longer exists.');
        }

        return {
            type: !field
                ? 'missing'
                : field.type === 'number' || field.type === 'boolean'
                  ? field.type
                  : 'string',
            field
        };
    };
    const visit = (node: Condition) => {
        if ('conditions' in node) {
            node.conditions.forEach(visit);

            return;
        }
        if (node.kind === 'not') {
            visit(node.condition);

            return;
        }
        if (node.kind === 'isSet') {
            operand(node.operand);

            return;
        }
        const left = operand(node.left);
        const right = operand(node.right);
        if (left.type === 'missing' || right.type === 'missing') {
            return;
        }
        if (left.type === 'null' || right.type === 'null') {
            problems.push('Use "is set" to check for a missing value.');
        } else if (node.kind === 'less' || node.kind === 'greater') {
            if (left.type !== 'number' || right.type !== 'number') {
                problems.push('Only numbers can be less or greater.');
            }
        } else if (node.kind === 'contains') {
            if (
                left.type !== 'string' ||
                right.type !== 'string' ||
                left.field?.type === 'reference' ||
                right.field?.type === 'reference'
            ) {
                problems.push('Only text can contain text.');
            }
        } else if (left.type !== right.type) {
            problems.push('Compares values of different types.');
        }
        for (const [side, other] of [
            [left, node.right],
            [right, node.left]
        ] as const) {
            if (
                side.field?.type === 'choice' &&
                other.kind === 'value' &&
                typeof other.value === 'string' &&
                node.kind !== 'contains' &&
                !side.field.options?.includes(other.value)
            ) {
                problems.push(`${side.field.name} has no option "${other.value}".`);
            }
        }
    };
    visit(condition);

    return [...new Set(problems)];
}

/**
 * Runs a condition. Any comparison with an unset value is false, except `notEquals`, which is
 * `not equals`, and `isSet`. Text comparisons ignore surrounding spaces, and `contains` also ignores case.
 */
export function evaluateCondition(
    condition: Condition,
    read: (operand: Exclude<Operand, { kind: 'value' }>) => DataValue | undefined
): boolean {
    const value = (operand: Operand) => (operand.kind === 'value' ? operand.value : read(operand));
    switch (condition.kind) {
        case 'and':
            return condition.conditions.every((item) => evaluateCondition(item, read));
        case 'or':
            return condition.conditions.some((item) => evaluateCondition(item, read));
        case 'not':
            return !evaluateCondition(condition.condition, read);
        case 'isSet':
            return !unset(value(condition.operand));
        case 'notEquals':
            return !evaluateCondition({ ...condition, kind: 'equals' }, read);
    }
    if (!('left' in condition)) {
        return false;
    }
    const left = value(condition.left);
    const right = value(condition.right);
    if (unset(left) || unset(right)) {
        return false;
    }
    if (condition.kind === 'less' || condition.kind === 'greater') {
        return (
            typeof left === 'number' &&
            typeof right === 'number' &&
            (condition.kind === 'less' ? left < right : left > right)
        );
    }
    const trim = (item: DataValue | undefined) => (typeof item === 'string' ? item.trim() : item);
    if (condition.kind === 'contains') {
        return (
            typeof left === 'string' &&
            typeof right === 'string' &&
            left.toLocaleLowerCase().includes(right.trim().toLocaleLowerCase())
        );
    }

    return trim(left) === trim(right);
}

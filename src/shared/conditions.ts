/**
 * The condition trees the editor stores and the player runs (see the plan's "Actions and
 * expressions" decision). Shared so a shared link's player and the server read the same shape.
 */
export type ConditionValue = string | number | boolean | null;

export type Operand =
    | { kind: 'value'; value: ConditionValue }
    /** A field of the record being checked, such as the record a form edits. */
    | { kind: 'field'; fieldId: string }
    /** A named state value of the player session. */
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
/** Text literals in conditions and state values. */
export const MAX_CONDITION_TEXT = 1000;

const unset = (value: ConditionValue | undefined) =>
    value === null || value === undefined || (typeof value === 'string' && !value.trim());

/**
 * Runs a condition. Any comparison with an unset value is false, except `notEquals`, which is
 * `not equals`, and `isSet`. Text comparisons ignore surrounding spaces, and `contains` also
 * ignores case.
 */
export function evaluateCondition(
    condition: Condition,
    read: (operand: Exclude<Operand, { kind: 'value' }>) => ConditionValue | undefined
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
    const trim = (item: ConditionValue | undefined) =>
        typeof item === 'string' ? item.trim() : item;
    if (condition.kind === 'contains') {
        return (
            typeof left === 'string' &&
            typeof right === 'string' &&
            left.toLocaleLowerCase().includes(right.trim().toLocaleLowerCase())
        );
    }

    return trim(left) === trim(right);
}

/** The operands a condition reads, other than literals. */
export function conditionOperands(condition: Condition): Exclude<Operand, { kind: 'value' }>[] {
    if ('conditions' in condition) {
        return condition.conditions.flatMap(conditionOperands);
    }
    if (condition.kind === 'not') {
        return conditionOperands(condition.condition);
    }
    const operands =
        condition.kind === 'isSet' ? [condition.operand] : [condition.left, condition.right];

    return operands.flatMap((operand) => (operand.kind === 'value' ? [] : [operand]));
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

/** A literal: text up to 1,000 characters, a finite number, a boolean or null. */
export function readConditionValue(value: unknown): ConditionValue {
    if (
        value === null ||
        typeof value === 'boolean' ||
        (typeof value === 'number' && Number.isFinite(value))
    ) {
        return value;
    }
    if (typeof value === 'string') {
        if (value.length > MAX_CONDITION_TEXT) {
            throw new Error('Values in conditions have up to 1,000 characters');
        }

        return value;
    }
    throw new Error('Invalid value');
}

/**
 * A typed condition tree, bounded in depth and size; unknown kinds are refused. `readId` checks
 * the IDs operands name, and `allowed` limits which operand kinds may appear.
 */
export function readConditionTree(
    value: unknown,
    readId: (value: unknown) => string,
    allowed: ReadonlySet<Operand['kind']> = new Set(['value', 'field', 'state'])
): Condition {
    let nodes = 0;
    const operand = (value: unknown): Operand => {
        const data = isRecord(value) ? value : {};
        if (!allowed.has(data.kind as Operand['kind'])) {
            throw new Error('Invalid operand');
        }
        if (data.kind === 'value') {
            return { kind: 'value', value: readConditionValue(data.value) };
        }

        return data.kind === 'field'
            ? { kind: 'field', fieldId: readId(data.fieldId) }
            : { kind: 'state', stateId: readId(data.stateId) };
    };
    const read = (value: unknown, depth: number): Condition => {
        if (++nodes > MAX_CONDITION_NODES || depth > MAX_CONDITION_DEPTH) {
            throw new Error('This condition is too large');
        }
        if (!isRecord(value)) {
            throw new Error('Invalid condition');
        }
        const kind = value.kind;
        if (kind === 'and' || kind === 'or') {
            if (!Array.isArray(value.conditions) || !value.conditions.length) {
                throw new Error('Combine at least one condition');
            }

            return { kind, conditions: value.conditions.map((item) => read(item, depth + 1)) };
        }
        if (kind === 'not') {
            return { kind, condition: read(value.condition, depth + 1) };
        }
        if (kind === 'isSet') {
            return { kind, operand: operand(value.operand) };
        }
        if (COMPARISONS.includes(kind as Comparison)) {
            return {
                kind: kind as Comparison,
                left: operand(value.left),
                right: operand(value.right)
            };
        }
        throw new Error('Invalid condition');
    };

    return read(value, 1);
}

/** A state value as the player shows it in text: yes/no values read On and Off. */
export function formatStateValue(value: ConditionValue | undefined): string {
    if (value === null || value === undefined) {
        return '';
    }

    return typeof value === 'boolean' ? (value ? 'On' : 'Off') : String(value);
}

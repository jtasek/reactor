import type { DataField } from './dataTypes';
import type { Condition, Operand } from '../shared/conditions';

/**
 * The one condition vocabulary for form rules, interactive state and later workflows (see the
 * plan's "Actions and expressions" decision). Conditions are typed trees stored as JSON; there is
 * no formula text to parse. Their types and evaluator live in `src/shared/conditions.ts` so the
 * player and the server read the same trees.
 */
export {
    COMPARISONS,
    MAX_CONDITION_DEPTH,
    MAX_CONDITION_NODES,
    evaluateCondition,
    type Comparison,
    type Condition,
    type Operand
} from '../shared/conditions';

/** What a condition may refer to where it is used. A form rule has no state, for example. */
export interface ConditionScope {
    field?: (id: string) => DataField | undefined;
    state?: (id: string) => { name: string; type?: 'text' | 'number' } | undefined;
}

/** `missing` is a field or state already reported as missing, so it adds no type problem. */
type OperandType = 'string' | 'number' | 'boolean' | 'null' | 'missing';

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
            const state = scope.state?.(item.stateId);
            if (!scope.state) {
                problems.push('State values are not available here.');
            } else if (!state) {
                problems.push('Uses a state value that no longer exists.');
            }

            return {
                type: !state
                    ? 'missing'
                    : state.type === 'text'
                      ? 'string'
                      : (state.type ?? 'boolean')
            };
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
        } else if (
            left.type !== right.type ||
            (left.field?.type === 'reference' &&
                right.field &&
                right.field.targetEntityId !== left.field.targetEntityId) ||
            (right.field?.type === 'reference' &&
                left.field &&
                left.field.targetEntityId !== right.field.targetEntityId)
        ) {
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

/** The fields a condition reads, for telling what a field delete affects. */
export function conditionFields(condition: Condition): string[] {
    if ('conditions' in condition) {
        return condition.conditions.flatMap(conditionFields);
    }
    if (condition.kind === 'not') {
        return conditionFields(condition.condition);
    }
    const operands =
        condition.kind === 'isSet' ? [condition.operand] : [condition.left, condition.right];

    return operands.flatMap((operand) => (operand.kind === 'field' ? [operand.fieldId] : []));
}

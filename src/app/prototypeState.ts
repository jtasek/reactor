import type { Condition, ConditionValue } from '../shared/conditions';
import { conditionOperands } from '../shared/conditions';
import { conditionProblems } from './expressions';
import { resolveComponentProp } from './componentProps';
import type { Document, InstanceShape, PrototypeValue, StateAction, StateValue } from './types';

export type StateType = 'boolean' | 'text' | 'number';

export const stateType = (value: PrototypeValue): StateType => value.type ?? 'boolean';

/** Whether `value` has the type a `set` of this state needs. */
export const fitsState = (state: PrototypeValue, value: unknown): value is StateValue => {
    switch (stateType(state)) {
        case 'number':
            return typeof value === 'number' && Number.isFinite(value);
        case 'text':
            return typeof value === 'string';
        default:
            return typeof value === 'boolean';
    }
};

export { formatStateValue } from '../shared/conditions';

/** The condition a yes/no binding stores: shown while the state equals `when`. */
export const stateEquals = (stateId: string, value: ConditionValue): Condition => ({
    kind: 'equals',
    left: { kind: 'state', stateId },
    right: { kind: 'value', value }
});

/**
 * The one state and value of a condition that compares a state with a literal for equality, the
 * shape the editors build. Other shapes come from AI or JSON and are shown, not edited.
 */
export function simpleCondition(
    condition: Condition | undefined
): { stateId: string; kind: Condition['kind']; value: ConditionValue } | undefined {
    if (condition?.kind === 'isSet' && condition.operand.kind === 'state') {
        return { stateId: condition.operand.stateId, kind: 'isSet', value: null };
    }
    if (!condition || !('left' in condition)) {
        return undefined;
    }
    const { left, right } = condition;
    if (left.kind === 'state' && right.kind === 'value') {
        return { stateId: left.stateId, kind: condition.kind, value: right.value };
    }

    return undefined;
}

/** A yes/no binding: the state it follows and the value that shows the instance. */
export function booleanVisibility(
    document: Pick<Document, 'prototypeBooleans'>,
    instance: Pick<InstanceShape, 'prototypeVisibleWhen'>
): { stateId: string; when: boolean } | undefined {
    const simple = simpleCondition(instance.prototypeVisibleWhen);
    const state = simple && document.prototypeBooleans[simple.stateId];

    return simple?.kind === 'equals' &&
        typeof simple.value === 'boolean' &&
        (!state || stateType(state) === 'boolean')
        ? { stateId: simple.stateId, when: simple.value }
        : undefined;
}

/** States an instance's visibility reads. */
export const visibilityStates = (instance: Pick<InstanceShape, 'prototypeVisibleWhen'>) =>
    instance.prototypeVisibleWhen
        ? [
              ...new Set(
                  conditionOperands(instance.prototypeVisibleWhen).flatMap((operand) =>
                      operand.kind === 'state' ? [operand.stateId] : []
                  )
              )
          ]
        : [];

/** Problems that keep a visibility condition from running; it then falls back to the default. */
export function visibilityProblems(
    document: Pick<Document, 'prototypeBooleans'>,
    condition: Condition
): string[] {
    return conditionProblems(condition, {
        state: (id) => {
            const state = document.prototypeBooleans[id];

            return state && { name: state.name, type: state.type };
        }
    });
}

/** Problems that keep a state action from running. */
export function stateActionProblem(
    document: Pick<Document, 'prototypeBooleans'>,
    action: StateAction
): string | undefined {
    const state = document.prototypeBooleans[action.stateId];
    if (!state) {
        return 'The state it changes was deleted.';
    }
    if (action.change === 'toggle' && stateType(state) !== 'boolean') {
        return `Only a yes/no state can be switched; ${state.name} holds ${stateType(state)}.`;
    }
    if (action.change === 'set' && !fitsState(state, action.value)) {
        return `${state.name} holds ${stateType(state) === 'boolean' ? 'yes/no values' : stateType(state)}; set it to one.`;
    }

    return undefined;
}

const COMPARISON_WORDS: Record<string, string> = {
    equals: 'is',
    notEquals: 'is not',
    less: 'is less than',
    greater: 'is more than',
    contains: 'contains'
};

/** A visibility condition in words, for Flow and the Inspector: “Tab is “Profile””. */
export function describeCondition(
    document: Pick<Document, 'prototypeBooleans'>,
    condition: Condition
): string {
    const operand = (item: { kind: string; stateId?: string; value?: ConditionValue }) =>
        item.kind === 'state'
            ? (document.prototypeBooleans[item.stateId!]?.name ?? 'a missing state')
            : typeof item.value === 'string'
              ? `“${item.value}”`
              : String(item.value);
    switch (condition.kind) {
        case 'and':
        case 'or':
            return condition.conditions
                .map((item) => describeCondition(document, item))
                .join(condition.kind === 'and' ? ' and ' : ' or ');
        case 'not':
            return `not (${describeCondition(document, condition.condition)})`;
        case 'isSet':
            return `${operand(condition.operand)} is set`;
    }
    if (
        (condition.kind === 'equals' || condition.kind === 'notEquals') &&
        condition.left.kind === 'state' &&
        condition.right.kind === 'value' &&
        typeof condition.right.value === 'boolean'
    ) {
        const on = condition.right.value === (condition.kind === 'equals');

        return `${operand(condition.left)} is ${on ? 'on' : 'off'}`;
    }

    return `${operand(condition.left)} ${COMPARISON_WORDS[condition.kind]} ${operand(condition.right)}`;
}

/** A copy of `condition` with each state operand renamed by `rename`. */
export function renameConditionStates(
    condition: Condition,
    rename: (stateId: string) => string
): Condition {
    const operand = <T extends { kind: string }>(item: T): T =>
        item.kind === 'state'
            ? { ...item, stateId: rename((item as unknown as { stateId: string }).stateId) }
            : item;
    if ('conditions' in condition) {
        return {
            ...condition,
            conditions: condition.conditions.map((item) => renameConditionStates(item, rename))
        };
    }
    if (condition.kind === 'not') {
        return { ...condition, condition: renameConditionStates(condition.condition, rename) };
    }
    if (condition.kind === 'isSet') {
        return { ...condition, operand: operand(condition.operand) };
    }

    return { ...condition, left: operand(condition.left), right: operand(condition.right) };
}

/** Every named state an instance refers to: its visibility, its action and its bindings. */
export const instanceStates = (
    instance: Pick<InstanceShape, 'prototypeVisibleWhen' | 'interactions' | 'stateBindings'>
): string[] => [
    ...new Set([
        ...visibilityStates(instance),
        ...(instance.interactions?.activate?.type === 'state'
            ? [instance.interactions.activate.stateId]
            : []),
        ...Object.values(instance.stateBindings ?? {})
    ])
];

/** Points an instance's state references through `rename`, in place. */
export function renameInstanceStates(
    instance: Pick<InstanceShape, 'prototypeVisibleWhen' | 'interactions' | 'stateBindings'>,
    rename: (stateId: string) => string
) {
    if (instance.prototypeVisibleWhen) {
        instance.prototypeVisibleWhen = renameConditionStates(
            instance.prototypeVisibleWhen,
            rename
        );
    }
    const activate = instance.interactions?.activate;
    if (activate?.type === 'state') {
        instance.interactions = {
            ...instance.interactions,
            activate: { ...activate, stateId: rename(activate.stateId) }
        };
    }
    if (instance.stateBindings) {
        instance.stateBindings = Object.fromEntries(
            Object.entries(instance.stateBindings).map(([prop, state]) => [prop, rename(state)])
        );
    }
}

/** Whether an exposed property is the text of a text shape, the one place a state can show. */
export function stateProperty(document: Document, componentId: string, propId: string) {
    const resolved = resolveComponentProp(document.components[componentId], propId, document);

    return resolved?.source.type === 'text' && resolved.prop.key === 'text';
}

/**
 * Whether a working condition other than one yes/no state decides an instance's visibility, so
 * a Toggle visibility action has nothing it can flip. Set a state the condition reads instead.
 */
export const conditionDecidesVisibility = (
    document: Pick<Document, 'prototypeBooleans'>,
    instance: Pick<InstanceShape, 'prototypeVisibleWhen'>
) =>
    Boolean(
        instance.prototypeVisibleWhen &&
        !booleanVisibility(document, instance) &&
        !visibilityProblems(document, instance.prototypeVisibleWhen).length
    );

import type { Document } from './types';
import { projectFlow, reachableScreens } from './flowProjection';
import { startScreen } from './screens';

type Control = ReturnType<typeof projectFlow>[number]['controls'][number];

/** What a control does when it acts. Only `go` leaves the screen. */
export type Effect =
    | { kind: 'go'; to: string; name: string }
    | { kind: 'variant'; instance: string; variant: string }
    | { kind: 'toggleVisibility'; target: string }
    | { kind: 'setState'; state: string; value: boolean }
    | { kind: 'toggleState'; state: string };

/** When the control is there to act: once something shows it, or while a named state holds. */
export type Guard = { kind: 'hiddenAtStart' } | { kind: 'state'; state: string; when: boolean };

export interface Transition {
    key: string;
    instanceId: string;
    control: string;
    event: 'tap' | 'enter';
    effect: Effect;
    guard?: Guard;
    inherited: boolean;
    editable: boolean;
    shared: boolean;
    /** Preview never draws it. */
    inactive?: 'hidden' | 'unusedVariant';
    /** Why it cannot work as authored. */
    broken?: string;
}

export interface IdleControl {
    key: string;
    instanceId: string;
    control: string;
    editable: boolean;
}

export interface FlowState {
    id: string;
    name: string;
    /** Whether the Screen can be shown: not hidden, not nested. */
    available: boolean;
    reachable: boolean;
    /** Controls that have an action. */
    transitions: Transition[];
    /** Controls with none, to offer when adding a link. */
    idle: IdleControl[];
}

export interface FlowRef {
    screenId: string;
    /** The transition's key, when the remark is about one. */
    key?: string;
    text: string;
}

/** A prototype as a state machine: Screens are states, acting controls are transitions. */
export interface Machine {
    initial?: string;
    states: FlowState[];
    /** Broken as authored: a missing Screen, state or target. */
    problems: FlowRef[];
    /** Worth knowing and often intended: nothing leads here, the flow ends here. */
    notes: FlowRef[];
}

function effectOf(control: Control, names: Map<string, string>): Effect | undefined {
    if (control.target) {
        return { kind: 'go', to: control.target, name: names.get(control.target) ?? '' };
    }
    if (control.sets) {
        return { kind: 'setState', state: control.sets.name, value: control.sets.value };
    }
    if (control.changes) {
        return { kind: 'variant', ...control.changes };
    }
    if (control.toggles !== undefined) {
        return control.toggleTarget
            ? { kind: 'toggleVisibility', target: control.toggles }
            : { kind: 'toggleState', state: control.toggles };
    }

    return undefined;
}

function brokenReason(control: Control, effect: Effect, names: Map<string, string>) {
    if (!control.missing) {
        return undefined;
    }
    switch (effect.kind) {
        case 'go':
            return names.has(effect.to)
                ? `${effect.name} is hidden or inside another screen`
                : 'The screen it goes to was deleted';
        case 'toggleVisibility':
            return 'What it shows or hides is no longer on this screen';
        default:
            return 'The state it uses was deleted';
    }
}

export function flowMachine(document: Document): Machine {
    const graph = projectFlow(document);
    const initial = startScreen(document)?.id;
    const reachable = reachableScreens(graph, initial);
    const names = new Map(graph.map((screen) => [screen.id, screen.name]));
    const problems: FlowRef[] = [];
    const notes: FlowRef[] = [];
    const states = graph.map((screen): FlowState => {
        const transitions: Transition[] = [];
        const idle: IdleControl[] = [];
        for (const control of screen.controls) {
            const effect = effectOf(control, names);
            if (!effect) {
                // A control inside another component can only gain an action at its source.
                if (!control.shared) {
                    idle.push({
                        key: control.key,
                        instanceId: control.instanceId,
                        control: control.name,
                        editable: control.editable
                    });
                }
                continue;
            }
            const boundState = control.follows
                ? document.prototypeBooleans[control.follows.id]
                : undefined;
            const broken = brokenReason(control, effect, names);
            transitions.push({
                key: control.key,
                instanceId: control.instanceId,
                control: control.name,
                event: control.enter ? 'enter' : 'tap',
                effect,
                ...(boundState && control.follows
                    ? {
                          guard: {
                              kind: 'state',
                              state: boundState.name,
                              when: control.follows.when
                          }
                      }
                    : control.startsHidden
                      ? { guard: { kind: 'hiddenAtStart' } }
                      : {}),
                inherited: control.inherited,
                editable: control.editable,
                shared: control.shared,
                ...(control.hidden
                    ? { inactive: 'hidden' }
                    : control.unusedVariant
                      ? { inactive: 'unusedVariant' }
                      : {}),
                ...(broken ? { broken } : {})
            });
            if (broken) {
                problems.push({
                    screenId: screen.id,
                    key: control.key,
                    text: `“${control.name}” on ${screen.name}: ${broken.toLowerCase()}.`
                });
            } else if (control.hidden || control.unusedVariant) {
                notes.push({
                    screenId: screen.id,
                    key: control.key,
                    text: `“${control.name}” on ${screen.name} is never drawn in Preview.`
                });
            }
        }

        return {
            id: screen.id,
            name: screen.name,
            available: screen.available,
            reachable: reachable.has(screen.id),
            transitions,
            idle
        };
    });
    for (const state of states) {
        if (!state.available) {
            continue;
        }
        if (!state.reachable) {
            notes.push({ screenId: state.id, text: `Nothing leads to ${state.name}.` });
        } else if (
            states.length > 1 &&
            !state.transitions.some(
                (transition) =>
                    transition.effect.kind === 'go' && !transition.broken && !transition.inactive
            )
        ) {
            notes.push({ screenId: state.id, text: `${state.name} ends the flow.` });
        }
    }

    return { initial, states, problems, notes };
}

/** What a transition does, without its control: “→ Details”, “shows or hides Help”. */
export function effectText(effect: Effect): string {
    switch (effect.kind) {
        case 'go':
            return `→ ${effect.name || 'Missing screen'}`;
        case 'variant':
            return `shows ${effect.variant}`;
        case 'toggleVisibility':
            return `shows or hides ${effect.target}`;
        case 'setState':
            return `turns ${effect.state} ${effect.value ? 'on' : 'off'}`;
        case 'toggleState':
            return `switches ${effect.state}`;
    }
}

export function guardText(guard?: Guard): string | undefined {
    if (!guard) {
        return undefined;
    }

    return guard.kind === 'state'
        ? `if ${guard.state} is ${guard.when ? 'on' : 'off'}`
        : 'once something shows it';
}

/** A transition in plain words, for screen readers and the list on narrow windows. */
export function sentence(transition: Transition): string {
    const { effect } = transition;
    const does =
        effect.kind === 'go'
            ? `goes to ${effect.name || 'a missing screen'}`
            : effect.kind === 'variant'
              ? `changes ${effect.instance} to ${effect.variant}`
              : effectText(effect);
    const guard = guardText(transition.guard);

    return [
        transition.event === 'enter' ? `Enter in ${transition.control}` : transition.control,
        ` ${does}`,
        guard ? `, ${guard}` : ''
    ].join('');
}

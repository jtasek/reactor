import type { Component, InstanceShape, NavigateAction, RoleSettings } from './types';

/** Old documents retain Button navigation and whole-role instance overrides. */
export function legacyActivation(settings?: RoleSettings): NavigateAction | null {
    return settings?.role === 'button' && settings.navigateTo
        ? { type: 'navigate', screenId: settings.navigateTo }
        : null;
}

export function sourceActivation(component: Component): NavigateAction | null {
    return component.interactions === undefined
        ? legacyActivation(component.interaction)
        : (component.interactions.activate ?? null);
}

export function inheritedActivation(instance: InstanceShape): boolean {
    return instance.interactions === undefined
        ? instance.interaction === undefined
        : instance.interactions.activate === undefined;
}

/** An instance's explicit action wins; its visual variant never supplies behavior. */
export function effectiveActivation(
    component: Component,
    instance?: InstanceShape
): NavigateAction | null {
    if (!instance || inheritedActivation(instance)) {
        return sourceActivation(component);
    }

    return instance.interactions === undefined
        ? legacyActivation(instance.interaction)
        : (instance.interactions.activate ?? null);
}

/** Capture only the old override boundary when a role edit first separates its behavior. */
export function separateInteractions(target: Component | InstanceShape): void {
    if (target.interactions !== undefined) {
        return;
    }
    if ('type' in target && target.interaction === undefined) {
        target.interactions = {};

        return;
    }

    target.interactions = { activate: legacyActivation(target.interaction) };
}

import type { Component, Document, InstanceShape } from './types';
import { shownShapesIds } from './membership';
import { screenOwners } from './screenViews';
import { screenFrames } from './screens';
import { isShapeLocked } from './utils';
import { effectiveActivation } from './screenInteractions';
import { prototypeTargetCheck } from './interactiveVariants';

/** Definitions and authored layout controls, independent of canvas placements and geometry. */
export function projectFlow(document: Document) {
    const owners = screenOwners(document.frames);
    const available = new Set(screenFrames(document).map((screen) => screen.id));
    const screens = Object.values(document.frames).filter((frame) => frame.kind === 'screen');
    const sourceIds = new Set(
        Object.values(document.components)
            .filter((component) => component.sourceOnly)
            .flatMap((component) => component.shapesIds)
    );
    const controls: {
        key: string;
        screenId: string;
        instanceId: string;
        name: string;
        target?: string;
        /** A change-variant action: the instance it changes and the variant it shows. */
        changes?: { instance: string; variant: string };
        /** A toggle-visibility action: the target's name and ID. */
        toggles?: string;
        toggleTarget?: string;
        toggleStateId?: string;
        sets?: { id: string; name: string; value: boolean };
        /** The screen instance holding it starts hidden in the prototype. */
        startsHidden?: string;
        editable: boolean;
        shared: boolean;
        /** Preview never draws it: hidden here or in a hidden container. */
        hidden: boolean;
        /** Only in a variant its instance never draws. */
        unusedVariant: boolean;
    }[] = [];
    const visit = (
        instance: InstanceShape,
        screenId: string,
        path: string,
        ancestors: Set<string>,
        state: { hidden: boolean; unusedVariant: boolean; startsHidden?: string }
    ) => {
        const component = document.components[instance.componentId];
        if (!component || ancestors.has(component.id)) {
            return;
        }
        const activation = effectiveActivation(component, instance);
        const visibilityTarget =
            activation?.type === 'toggleVisibility'
                ? document.shapes[activation.instanceId]
                : undefined;
        const visibilityState =
            visibilityTarget?.type === 'instance'
                ? document.prototypeBooleans[visibilityTarget.prototypeVisibilityStateId ?? '']
                : undefined;
        controls.push({
            key: path,
            screenId,
            instanceId: instance.id,
            name: instance.name,
            shared: path !== instance.id,
            ...state,
            target: activation?.screenId,
            ...(activation?.type === 'setState'
                ? {
                      sets: {
                          id: activation.stateId,
                          name:
                              document.prototypeBooleans[activation.stateId]?.name ??
                              'Missing state',
                          value: activation.value
                      }
                  }
                : {}),
            ...(activation?.type === 'toggleState'
                ? {
                      toggles:
                          document.prototypeBooleans[activation.stateId]?.name ?? 'Missing state',
                      toggleStateId: activation.stateId
                  }
                : {}),
            ...(activation?.type === 'toggleVisibility'
                ? {
                      toggles: document.shapes[activation.instanceId]?.name ?? 'Missing instance',
                      toggleTarget: activation.instanceId,
                      toggleStateId: visibilityState?.id
                  }
                : {}),
            ...(activation?.type === 'changeVariant'
                ? {
                      changes: {
                          instance:
                              document.shapes[activation.instanceId]?.name ?? 'Missing instance',
                          variant:
                              document.components[activation.variantId]?.name ?? 'Missing variant'
                      }
                  }
                : {}),
            editable:
                document.shapes[instance.id] === instance && !isShapeLocked(document, instance.id)
        });
        const next = new Set(ancestors).add(component.id);
        const drawn = drawnSources(document, component, instance);
        for (const sourceId of [component.id, ...(component.variantIds ?? [])]) {
            const source = document.components[sourceId];
            for (const id of source?.shapesIds ?? []) {
                const child = source.sourceShapes?.[id] ?? document.shapes[id];
                if (child?.type === 'instance') {
                    visit(child, screenId, `${path}/${sourceId}/${id}`, next, {
                        ...state,
                        hidden: state.hidden || !child.visible,
                        unusedVariant: state.unusedVariant || !drawn.has(sourceId)
                    });
                }
            }
        }
    };
    // Preview's own visibility rule, without the editor's one-layer focus.
    const shown = shownShapesIds({ ...document, shownLayerId: undefined }, null);
    const isTarget = prototypeTargetCheck(document);
    for (const shape of Object.values(document.shapes)) {
        const owner = owners.get(shape.parentFrameId ?? '');
        if (shape.type === 'instance' && owner && !sourceIds.has(shape.id)) {
            const boundState = document.prototypeBooleans[shape.prototypeVisibilityStateId ?? ''];
            const when = shape.prototypeVisibilityWhen ?? true;
            const startsHidden = boundState
                ? boundState.initial !== when
                : shape.prototypeVisible === false;
            visit(shape, owner, shape.id, new Set(), {
                hidden: !shown.has(shape.id),
                unusedVariant: false,
                ...(startsHidden && isTarget(shape.id, owner)
                    ? { startsHidden: boundState ? `state:${boundState.id}:${when}` : shape.id }
                    : {})
            });
        }
    }

    return screens.map((screen) => ({
        id: screen.id,
        name: screen.name,
        available: available.has(screen.id),
        controls: controls
            .filter((control) => control.screenId === screen.id)
            .map((control) => ({
                ...control,
                missing: Boolean(
                    (control.target && !available.has(control.target)) ||
                    (control.sets !== undefined && !document.prototypeBooleans[control.sets.id]) ||
                    (control.toggleStateId !== undefined &&
                        !document.prototypeBooleans[control.toggleStateId]) ||
                    (control.toggleTarget !== undefined &&
                        !isTarget(control.toggleTarget, control.screenId))
                )
            }))
    }));
}

/** Sources an instance can draw: its explicit choice, or every source its width rules pick. */
function drawnSources(document: Document, component: Component, instance: InstanceShape) {
    const variants = new Set(component.variantIds ?? []);
    const valid = (id?: string) => Boolean(id && variants.has(id) && document.components[id]);
    if (instance.variantMode !== 'auto' || instance.variantId) {
        return new Set([valid(instance.variantId) ? instance.variantId! : component.id]);
    }

    return new Set([
        component.id,
        ...(component.responsiveVariants?.rules ?? [])
            .map((rule) => rule.variantId)
            .filter((id) => valid(id))
    ]);
}

/** Possible navigation after visible controls reveal local instances or shared state. */
export function reachableScreens(graph: ReturnType<typeof projectFlow>, start?: string) {
    const reachable = new Set(start ? [start] : []);
    const revealed = new Set<string>();
    for (;;) {
        const size = reachable.size + revealed.size;
        for (const screen of graph) {
            if (!reachable.has(screen.id)) {
                continue;
            }
            for (const control of screen.controls) {
                if (
                    control.missing ||
                    control.hidden ||
                    control.unusedVariant ||
                    (control.startsHidden && !revealed.has(control.startsHidden))
                ) {
                    continue;
                }
                if (control.target) {
                    reachable.add(control.target);
                }
                if (control.toggleTarget) {
                    revealed.add(control.toggleTarget);
                }
                if (control.sets) {
                    revealed.add(`state:${control.sets.id}:${control.sets.value}`);
                }
                if (control.toggleStateId) {
                    revealed.add(`state:${control.toggleStateId}:true`);
                    revealed.add(`state:${control.toggleStateId}:false`);
                }
            }
        }
        if (reachable.size + revealed.size === size) {
            return reachable;
        }
    }
}

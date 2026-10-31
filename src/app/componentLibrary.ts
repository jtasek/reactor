import type { ActionWithParam } from './types';
import type { Component, Document, Shape, RoleSettings, InteractionSettings } from './types';
import { json } from 'overmind';
import { shapeGeometry, shapeStyle } from './utils';

const roleContent = (settings: RoleSettings | undefined) =>
    settings && {
        role: settings.role,
        ...(settings.controlId ? { controlId: settings.controlId } : {}),
        props: Object.fromEntries(
            Object.entries(settings.props).sort(([a], [b]) => (a < b ? -1 : Number(a > b)))
        )
    };

function fingerprint(
    component: Component,
    members: Shape[],
    records: ReadonlyMap<string, { hash: string }>
): string {
    const payload = JSON.stringify({
        name: component.name,
        variants: component.variantIds?.map((id) => [id, records.get(id)?.hash]),
        responsiveVariants: component.responsiveVariants,
        props: component.props,
        interaction: roleContent(component.interaction),
        shapes: members.map((shape) => {
            const geometry = shapeGeometry(shape);

            if (geometry.type === 'instance') {
                const modes = Object.entries(geometry.modeOverrides ?? {});
                geometry.modeOverrides =
                    modes.length > 0
                        ? Object.fromEntries(modes.sort(([a], [b]) => a.localeCompare(b)))
                        : undefined;
            }

            return {
                id: shape.id,
                order: shape.order,
                geometry,
                style: shapeStyle(shape),
                rotation: shape.rotation,
                visible: shape.visible,
                interaction: shape.type === 'instance' ? roleContent(shape.interaction) : undefined,
                nested: shape.type === 'instance' ? records.get(shape.componentId)?.hash : undefined
            };
        })
    });
    let first = 2166136261;
    let second = 2166136261 ^ 0x9e3779b9;

    for (let index = 0; index < payload.length; index++) {
        first = Math.imul(first ^ payload.charCodeAt(index), 16777619);
        second = Math.imul(second ^ payload.charCodeAt(index), 16777619);
    }

    return `${(first >>> 0).toString(16).padStart(8, '0')}${(second >>> 0).toString(16).padStart(8, '0')}`;
}

/**
 * Collect dependencies before their parents, visiting shared sources only once.
 * `unusable` hears of the source that stops the collection, when there is one.
 */
function libraryRecords(
    document: Document,
    componentId: string,
    unusable: (component: Component | undefined) => void = () => undefined
) {
    const records = new Map<string, { component: Component; members: Shape[]; hash: string }>();
    const visiting = new Set<string>();
    const collectComponentDependencies = (id: string): boolean => {
        if (records.has(id)) {
            return true;
        }
        const component = document.components[id];

        if (!component || component.shapesIds.length === 0 || visiting.has(id)) {
            unusable(component);

            return false;
        }
        visiting.add(id);
        const members: Shape[] = [];

        for (const variantId of component.variantIds ?? []) {
            if (!document.components[variantId]) {
                continue;
            }
            if (!collectComponentDependencies(variantId)) {
                return false;
            }
        }

        for (const memberId of component.shapesIds) {
            const shape = component.sourceShapes?.[memberId] ?? document.shapes[memberId];

            if (!shape) {
                unusable(component);

                return false;
            }
            if (
                shape.type === 'instance' &&
                (!collectComponentDependencies(shape.componentId) ||
                    (shape.variantId !== undefined &&
                        document.components[shape.variantId] !== undefined &&
                        !collectComponentDependencies(shape.variantId)))
            ) {
                return false;
            }
            members.push(shape);
        }
        const hash = fingerprint(component, members, records);
        records.set(id, { component, members, hash });
        visiting.delete(id);

        return true;
    };

    if (!collectComponentDependencies(componentId)) {
        return null;
    }

    return records;
}

/** A stable fingerprint of the source content, including nested sources. */
export function componentFingerprint(document: Document, componentId: string): string | null {
    return libraryRecords(document, componentId)?.get(componentId)?.hash ?? null;
}

/** Why the library's current version of a component cannot be copied, or null when it can. */
export function libraryVersionProblem(document: Document, componentId: string): string | null {
    let problem: string | null = null;

    libraryRecords(document, componentId, (component) => {
        problem ??= component
            ? `${component.name} has no usable artwork in the library.`
            : 'A component it needs is missing from the library.';
    });

    return problem;
}

/** Screen links point at the library document's frames, which the destination does not have. */
function withoutNavigation<
    T extends { interaction?: RoleSettings; interactions?: InteractionSettings } | Shape
>(record: T): T {
    if ('interaction' in record && record.interaction) {
        delete record.interaction.navigateTo;
    }

    if ('interactions' in record && record.interactions?.activate) {
        record.interactions.activate = null;
    }

    return record;
}

/** Copies a source and the nested sources it needs into portable records. */
export function librarySnapshot(
    document: Document,
    componentId: string,
    destination: Pick<Document, 'components'>
): Component[] | null {
    const records = libraryRecords(document, componentId);

    if (!records) {
        return null;
    }
    for (const id of records.keys()) {
        const existing = destination.components[id];

        if (existing && (!existing.library || existing.library.documentId !== document.id)) {
            return null;
        }
    }

    return [...records.values()].map(({ component, members, hash }) => ({
        ...withoutNavigation(structuredClone(json(component))),
        // A missing upstream alternate must not reconnect to an old destination snapshot.
        // Keep that snapshot for independent instances, but remove it from this published family.
        ...(component.variantIds
            ? { variantIds: component.variantIds.filter((id) => records.has(id)) }
            : {}),
        // Rules for a dropped alternate could never apply, and consumers can't repair them.
        ...(component.responsiveVariants
            ? {
                  responsiveVariants: {
                      ...component.responsiveVariants,
                      rules: component.responsiveVariants.rules.filter((rule) =>
                          records.has(rule.variantId)
                      )
                  }
              }
            : {}),
        sourceShapes: Object.fromEntries(
            members.map((shape) => [shape.id, withoutNavigation(structuredClone(json(shape)))])
        ),
        library: { documentId: document.id, hash },
        selected: false
    }));
}

export const importLibraryComponent: ActionWithParam<{
    documentId: string;
    componentId: string;
}> = ({ state, actions }, { documentId, componentId }) => {
    const source = state.documents[documentId];
    const target = state.currentDocument;

    if (
        !source ||
        source.deleted ||
        source === target ||
        target.locked ||
        target.components[componentId]
    ) {
        return;
    }
    const copies = librarySnapshot(source, componentId, target);

    if (!copies) {
        actions.displayWarning('This component cannot be copied into this document.');

        return;
    }
    copies.forEach((component) => {
        target.components[component.id] = component;
    });
    actions.ui.showControl('components');
};

export const updateLibraryComponent: ActionWithParam<string> = (
    { state, actions, effects },
    componentId
) => {
    const target = state.currentDocument;
    const existing = target.components[componentId];
    const source = existing?.library && state.documents[existing.library.documentId];

    if (!source || source.deleted || target.locked) {
        return;
    }
    const hash = componentFingerprint(source, componentId);

    if (!hash || hash === existing.library?.hash) {
        return;
    }
    const copies = librarySnapshot(source, componentId, target);

    if (!copies) {
        actions.displayWarning('This component update cannot be applied.');

        return;
    }
    effects.collaboration.startBatch(target.id, { kind: 'person' });
    copies.forEach((component) => {
        target.components[component.id] = component;
    });
    effects.collaboration.flush();
};

import { isScreenDefinition, screenOwners, screenViewName } from './screenViews';
import { isScreenLayout } from './screenLayouts';
import { sceneLayers } from './componentTree';
import { frameParents } from './frameState';
import { filterOutline, outline } from './membership';
import type { OutlineLayer } from './membership';
import type { Document } from './types';

export type ExplorerContents = Pick<OutlineLayer, 'groups' | 'shapesIds'>;

/** What the Explorer's filter menu narrows the outline to, besides the search text. */
export type ExplorerStatusFilter = 'all' | 'hiddenOrLocked';

/** Which shapes and frames stay in the outline; everything while both are absent. */
export interface ExplorerKeep {
    shape?: (id: string) => boolean;
    frame?: (id: string) => boolean;
}

const emptyContents = (): ExplorerContents => ({ groups: [], shapesIds: [] });

/**
 * What the filter menu keeps: the shapes on the shown layer, or the hidden and locked
 * items with what holds them. Nothing is narrowed when neither applies.
 */
export function explorerKeep(
    document: Document,
    layerId: string | undefined,
    status: ExplorerStatusFilter
): ExplorerKeep {
    // One set for the whole outline, rather than a search of every layer for each shape.
    const layerShapes = layerId ? new Set(document.layers[layerId]?.shapesIds) : undefined;
    const onLayer = layerShapes ? (id: string) => layerShapes.has(id) : () => true;

    if (status === 'all') {
        return layerId ? { shape: onLayer } : {};
    }

    const flagged = (item: { visible: boolean; locked: boolean } | undefined) =>
        item !== undefined && (!item.visible || item.locked);

    const inFlaggedGroup = new Set(
        Object.values(document.groups)
            .filter(flagged)
            .flatMap((group) => group.shapesIds)
    );

    return {
        shape: (id) => onLayer(id) && (flagged(document.shapes[id]) || inFlaggedGroup.has(id)),
        frame: (id) => !layerId && flagged(document.frames[id])
    };
}

function keptContents(contents: ExplorerContents, keep: ExplorerKeep['shape']) {
    if (!keep) {
        return contents;
    }

    return {
        groups: contents.groups
            .map((group) => ({ ...group, shapesIds: group.shapesIds.filter(keep) }))
            .filter((group) => group.shapesIds.length > 0),
        shapesIds: contents.shapesIds.filter(keep)
    };
}

/** Partition objects by actual containment, without global layer wrappers. */
function objectsByFrame(document: Document) {
    const contents = new Map<string | undefined, ExplorerContents>();
    const parentOf = (id: string) => {
        const parent = document.shapes[id]?.parentFrameId;

        return parent !== undefined && Object.hasOwn(document.frames, parent) ? parent : undefined;
    };
    const entry = (parent: string | undefined) => {
        const existing = contents.get(parent);

        if (existing) {
            return existing;
        }

        const items = emptyContents();

        contents.set(parent, items);

        return items;
    };

    for (const layer of sceneLayers(outline(document), document)) {
        for (const group of layer.groups) {
            const members = new Map<string | undefined, string[]>();

            for (const id of group.shapesIds) {
                const parent = parentOf(id);
                const ids = members.get(parent) ?? [];

                ids.push(id);
                members.set(parent, ids);
            }

            for (const [parent, shapesIds] of members) {
                entry(parent).groups.push({ groupId: group.groupId, shapesIds });
            }
        }

        layer.shapesIds.forEach((id) => entry(parentOf(id)).shapesIds.push(id));
    }

    return contents;
}

function matchingObjects(contents: ExplorerContents, document: Document, text: string) {
    const [matching] = filterOutline([{ layerId: null, ...contents }], document, text);

    return matching ? { groups: matching.groups, shapesIds: matching.shapesIds } : emptyContents();
}

/**
 * Search keeps frame ancestors; a named frame includes its complete subtree. `keep`
 * narrows that further, keeping a frame it names, or one holding what it keeps.
 */
export function explorerTree(document: Document, text: string, keep: ExplorerKeep = {}) {
    const wanted = text.trim().toLowerCase();
    const parents = frameParents(document.frames);
    const contents = objectsByFrame(document);
    const named = new Set(
        Object.values(document.frames)
            .filter((frame) => screenViewName(document, frame).toLowerCase().includes(wanted))
            .map((frame) => frame.id)
    );
    for (const frame of Object.values(document.frames)) {
        if (frame.kind === 'view' && frame.screenId && named.has(frame.id)) {
            named.add(frame.screenId);
        }
    }

    const includesAll = (id: string): boolean => {
        const parent = parents.get(id);

        return named.has(id) || (parent !== undefined && includesAll(parent));
    };
    const frames = new Map(
        [...parents].map(([id, parentFrameId]) => [
            id,
            {
                id,
                parentFrameId,
                contents: keptContents(
                    includesAll(id)
                        ? (contents.get(id) ?? emptyContents())
                        : matchingObjects(contents.get(id) ?? emptyContents(), document, wanted),
                    keep.shape
                )
            }
        ])
    );
    const shown = new Set(
        [...frames.values()]
            .filter(
                (frame) =>
                    (keep.shape || keep.frame
                        ? (keep.frame?.(frame.id) ?? false) && includesAll(frame.id)
                        : includesAll(frame.id)) ||
                    frame.contents.groups.length + frame.contents.shapesIds.length > 0
            )
            .map((frame) => frame.id)
    );

    for (const id of [...shown]) {
        let parent = parents.get(id);

        while (parent !== undefined) {
            shown.add(parent);
            parent = parents.get(parent);
        }
    }

    for (const frame of Object.values(document.frames)) {
        if (frame.kind === 'view' && frame.screenId && shown.has(frame.screenId)) {
            shown.add(frame.id);
        }
    }

    return {
        canvas: keptContents(
            matchingObjects(contents.get(undefined) ?? emptyContents(), document, wanted),
            keep.shape
        ),
        frames: [...frames.values()].filter((frame) => shown.has(frame.id))
    };
}

/** The key an Explorer row is opened and closed by; each item is listed once. */
export const explorerKey = (kind: 'screen' | 'frame' | 'group' | 'component', id: string) =>
    `${kind}:${id}`;

/** The rows to open so every selected item is listed: its screen, frames, group and component. */
export function explorerRevealKeys(document: Document): string[] {
    const keys = new Set<string>();
    const parents = frameParents(document.frames);
    const openFrames = (id: string | undefined) => {
        for (
            let current = id;
            current !== undefined && document.frames[current];
            current = parents.get(current)
        ) {
            const frame = document.frames[current];

            if (frame.kind === 'view' && frame.screenId) {
                keys.add(explorerKey('screen', frame.screenId));
            } else if (isScreenDefinition(document.frames, current, parents)) {
                keys.add(explorerKey('screen', current));
            } else if (!isScreenLayout(document.frames, current, parents)) {
                keys.add(explorerKey('frame', current));
            }
        }
    };
    const selected = new Set(document.selectedShapesIds);

    // Each group and component is read once, however many shapes are selected.
    if (selected.size > 0) {
        Object.values(document.groups)
            .filter((group) => group.shapesIds.some((id) => selected.has(id)))
            .forEach((group) => keys.add(explorerKey('group', group.id)));
        Object.values(document.components)
            .filter((component) => component.shapesIds.some((id) => selected.has(id)))
            .forEach((component) => keys.add(explorerKey('component', component.id)));
    }
    selected.forEach((id) => openFrames(document.shapes[id]?.parentFrameId));
    document.selectedGroupsIds.forEach((id) =>
        document.groups[id]?.shapesIds.forEach((shapeId) =>
            openFrames(document.shapes[shapeId]?.parentFrameId)
        )
    );
    if (document.selectedFrameId) {
        openFrames(parents.get(document.selectedFrameId));
    }

    return [...keys];
}

/** Where a component's instances are placed, as one "Used in" row of the focus view. */
export interface ComponentUse {
    kind: 'screen' | 'component' | 'canvas';
    /** The screen or component holding the instances; absent for the Canvas. */
    id?: string;
    name: string;
    instanceIds: string[];
}

/**
 * What the Explorer lists while a component is being edited: the variants of its
 * family, and where instances of that family are placed. Screens come first by name,
 * then other components' sources, then the Canvas.
 */
export function componentFocus(document: Document, componentId: string) {
    const component = document.components[componentId];

    if (!component) {
        return null;
    }

    const familyId = component.variantIds?.length
        ? componentId
        : (Object.values(document.components).find((item) => item.variantIds?.includes(componentId))
              ?.id ?? componentId);
    const family = [familyId, ...(document.components[familyId]?.variantIds ?? [])];
    const members = new Set(family);
    const owners = screenOwners(document.frames);
    const holders = new Map<string, string>();

    for (const other of Object.values(document.components)) {
        if (!members.has(other.id)) {
            other.shapesIds.forEach((id) => holders.set(id, other.id));
        }
    }

    const uses = new Map<string, ComponentUse>();
    const placeFor = (key: string, make: () => Omit<ComponentUse, 'instanceIds'>) => {
        const existing = uses.get(key) ?? { ...make(), instanceIds: [] };

        uses.set(key, existing);

        return existing;
    };

    for (const id of document.shapesIds) {
        const shape = document.shapes[id];

        if (shape?.type !== 'instance' || !members.has(shape.componentId)) {
            continue;
        }

        const holder = holders.get(id);
        const screenId = owners.get(shape.parentFrameId ?? '');
        const place = holder
            ? placeFor(`component:${holder}`, () => ({
                  kind: 'component',
                  id: holder,
                  name: document.components[holder].name
              }))
            : screenId
              ? placeFor(`screen:${screenId}`, () => ({
                    kind: 'screen',
                    id: screenId,
                    name: document.frames[screenId]?.name ?? screenId
                }))
              : placeFor('canvas', () => ({ kind: 'canvas', name: 'Canvas' }));

        place.instanceIds.push(id);
    }

    const rank = { screen: 0, component: 1, canvas: 2 };

    return {
        variants:
            family.length > 1
                ? family.flatMap((id) => {
                      const variant = document.components[id];

                      return variant
                          ? [{ id, name: variant.name, editable: !variant.library }]
                          : [];
                  })
                : [],
        usedIn: [...uses.values()].sort(
            (a, b) =>
                rank[a.kind] - rank[b.kind] ||
                a.name.localeCompare(b.name) ||
                (a.id ?? '').localeCompare(b.id ?? '')
        )
    };
}

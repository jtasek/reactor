import { screenViewName } from './screenViews';
import { sceneLayers } from './componentTree';
import { frameParents } from './frameState';
import { filterOutline, outline } from './membership';
import type { OutlineLayer } from './membership';
import type { Document } from './types';

export type ExplorerContents = Pick<OutlineLayer, 'groups' | 'shapesIds'>;

const emptyContents = (): ExplorerContents => ({ groups: [], shapesIds: [] });

/** Each global layer appears once, independent of frame containment. */
export function explorerLayers(document: Document, text: string) {
    return filterOutline(sceneLayers(outline(document), document), document, text);
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

/** Search keeps frame ancestors; a named frame includes its complete subtree. */
export function explorerTree(document: Document, text: string) {
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
                contents: includesAll(id)
                    ? (contents.get(id) ?? emptyContents())
                    : matchingObjects(contents.get(id) ?? emptyContents(), document, wanted)
            }
        ])
    );
    const shown = new Set(
        [...frames.values()]
            .filter(
                (frame) =>
                    includesAll(frame.id) ||
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
        canvas: matchingObjects(contents.get(undefined) ?? emptyContents(), document, wanted),
        frames: [...frames.values()].filter((frame) => shown.has(frame.id))
    };
}

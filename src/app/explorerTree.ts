import { sceneLayers } from './componentTree';
import { frameParents } from './frameState';
import { filterOutline, outline } from './membership';
import type { OutlineLayer } from './membership';
import type { Document } from './types';

/** Partition scene rows without changing either frame or layer membership. */
function layersByFrame(document: Document) {
    const contents = new Map<string | undefined, OutlineLayer[]>();
    const parentOf = (id: string) => {
        const parent = document.shapes[id]?.parentFrameId;

        return parent !== undefined && Object.hasOwn(document.frames, parent) ? parent : undefined;
    };

    for (const layer of sceneLayers(outline(document), document)) {
        const slices = new Map<string | undefined, OutlineLayer>();
        const entry = (parent: string | undefined) => {
            const existing = slices.get(parent);

            if (existing) {
                return existing;
            }

            const slice: OutlineLayer = { layerId: layer.layerId, groups: [], shapesIds: [] };

            slices.set(parent, slice);

            return slice;
        };

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

        // Empty layers remain reachable, including ones containing only source artwork.
        if (slices.size === 0 && layer.layerId !== null) {
            entry(undefined);
        }

        for (const [parent, slice] of slices) {
            const layers = contents.get(parent) ?? [];

            layers.push(slice);
            contents.set(parent, layers);
        }
    }

    return contents;
}

/** Search keeps frame ancestors; a named frame includes its complete subtree. */
export function explorerTree(document: Document, text: string) {
    const wanted = text.trim().toLowerCase();
    const parents = frameParents(document.frames);
    const contents = layersByFrame(document);
    const named = new Set(
        Object.values(document.frames)
            .filter((frame) => frame.name.toLowerCase().includes(wanted))
            .map((frame) => frame.id)
    );
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
                layers: includesAll(id)
                    ? (contents.get(id) ?? [])
                    : filterOutline(contents.get(id) ?? [], document, wanted)
            }
        ])
    );
    const shown = new Set(
        [...frames.values()]
            .filter((frame) => includesAll(frame.id) || frame.layers.length > 0)
            .map((frame) => frame.id)
    );

    for (const id of [...shown]) {
        let parent = parents.get(id);

        while (parent !== undefined) {
            shown.add(parent);
            parent = parents.get(parent);
        }
    }

    return {
        canvas: filterOutline(contents.get(undefined) ?? [], document, wanted),
        frames: [...frames.values()].filter((frame) => shown.has(frame.id))
    };
}

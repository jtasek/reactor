import { useEffect, useReducer } from 'react';
import { useReaction } from 'src/app/hooks';

/** How long edits must pause before the draft is built again. */
const PREVIEW_SETTLE_MS = 150;
/** The parts of a document a draft depends on; the camera and other view state are left out. */
const DRAFT_INPUTS = [
    'shapes',
    'shapesIds',
    'frames',
    'groups',
    'layers',
    'components',
    'links',
    'guides',
    'variables',
    'dimensions',
    'dataEntities',
    'dataFields',
    'dataRecords',
    'dataRules',
    'prototypeBooleans'
] as const;

/**
 * A number that changes once edits to what a draft depends on have paused, so a
 * gesture or a burst of typing builds the draft once rather than on every change.
 */
export function useProposalRevision(documentId: string) {
    const reaction = useReaction();
    const [revision, next] = useReducer((count: number) => count + 1, 0);

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const schedule = () => {
            clearTimeout(timer);
            timer = setTimeout(next, PREVIEW_SETTLE_MS);
        };
        const stops = DRAFT_INPUTS.map((key) =>
            reaction((state) => state.documents[documentId][key], schedule, { nested: true })
        );

        stops.push(reaction((state) => state.documents[documentId].locked, schedule));

        return () => {
            clearTimeout(timer);
            stops.forEach((stop) => stop());
        };
    }, [reaction, documentId]);

    return revision;
}

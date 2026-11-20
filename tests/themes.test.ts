import { json } from 'overmind';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    checkAccessibility,
    checkContexts,
    contextSession,
    defaultChoice,
    type CheckContext
} from 'src/app/accessibilityCheck';
import { prototypeModes } from 'src/app/modeEdits';
import { projectPreview } from 'src/preview/project';
import type { Document } from 'src/app/types';
import {
    canvasProjection,
    nodeMarks,
    openDocument,
    type ParityStore
} from './support/projectionParity';
import { openPackage, packagePage } from './support/packageProjection';
import { prototypeDocument } from './support/prototype';
import { responsiveDocument } from './support/responsiveModes';
import { accessibilityFixture } from './support/accessibility';

/**
 * Each user-defined mode at each viewport size, resolved three ways: the canvas drawing a
 * View set to it, Prototype in that context, and the downloaded page viewed in it. All three
 * must draw the same, and the page's Accessibility report must say what the check says.
 */
const FIXTURES: [string, () => Document][] = [
    ['theme and width modes', () => responsiveDocument()],
    ['automatic and explicit screen layouts', prototypeDocument],
    ['a page with accessibility problems', () => accessibilityFixture(true)]
];

afterEach(() => vi.unstubAllGlobals());

const copy = (document: Document): Document => JSON.parse(JSON.stringify(json(document)));

function contextsOf(store: ParityStore) {
    const { currentDocument: document, config } = store.state;
    const result = checkContexts(
        document,
        config.viewportPresets,
        defaultChoice(document, config.viewportPresets),
        config.accessibility
    );
    if (!('contexts' in result)) {
        throw new Error(result.problem);
    }

    return result.contexts;
}

/** The canvas drawing `viewId` once it is set to the context's modes and size, with Auto layout. */
async function canvasIn(document: Document, viewId: string, context: CheckContext) {
    const edited = copy(document);
    const view = edited.frames[viewId];
    view.size = { ...context.size.size };
    view.modeOverrides = { ...context.modes };
    delete view.layoutId;
    view.layoutMode = 'auto';

    return canvasProjection(await openDocument(edited)).get(viewId)!;
}

const viewsOf = (document: Document) =>
    Object.values(document.frames).filter((frame) => frame.kind === 'view');

describe.each(FIXTURES)('%s', (_, fixture) => {
    it('resolves each mode and size alike on the canvas, in Prototype and in the download', async () => {
        const store = await openDocument(fixture());
        const document = store.state.currentDocument;
        const contexts = contextsOf(store);
        expect(contexts.length).toBeGreaterThan(1);
        const view = viewsOf(document)[0];
        store.actions.editFrame({ kind: 'select', id: view.id });
        const session = prototypeModes(store.state);
        const page = await openPackage(await packagePage(store, view.id, contexts));
        expect(page.views).toEqual(contexts.map(({ name }) => name));
        for (const context of contexts) {
            const drawing = projectPreview(
                document,
                {},
                [],
                contextSession(document, session, context),
                {}
            );
            const screen = drawing.screens.find(({ id }) => id === view.screenId)!;
            const prototype = new Map(
                screen.nodes.map((node) => [
                    node.key.slice(screen.id.length + 1),
                    nodeMarks(node, screen, drawing.states)
                ])
            );
            const canvas = await canvasIn(document, view.id, context);
            expect([...prototype.keys()], context.name).toEqual([...canvas.keys()]);
            for (const [shapeId, marks] of canvas) {
                expect(prototype.get(shapeId), `${context.name} › ${shapeId}`).toEqual(marks);
            }
            page.view(context.name);
            expect(page.show(screen.id), context.name).toEqual(prototype);
        }
        page.close();
    });

    it('reports names, focus order and contrast in the download as the check does', async () => {
        const store = await openDocument(fixture());
        const document = store.state.currentDocument;
        const contexts = contextsOf(store);
        const view = viewsOf(document)[0];
        store.actions.editFrame({ kind: 'select', id: view.id });
        const session = prototypeModes(store.state);
        const checked = checkAccessibility(
            document,
            session,
            contexts,
            store.state.config.accessibility
        );
        const page = await openPackage(await packagePage(store, view.id, contexts));
        for (const { context, screens } of checked) {
            page.view(context.name);
            page.show(view.screenId!);
            const { report } = screens.find(({ id }) => id === view.screenId)!;
            const shown = page.report();
            expect(shown['Focus order'], context.name).toEqual(
                report.focusOrder.length ? report.focusOrder.map((name) => `“${name}”`) : ['None']
            );
            expect(shown.Names.length, context.name).toBe(report.names.length || 1);
            expect(shown.Contrast, context.name).toEqual(
                report.contrast.length
                    ? report.contrast.map(
                          ({ text, ratio, required }) =>
                              `“${text}”: ${ratio}:1, ${ratio >= required ? 'passes' : 'fails'} ${required}:1`
                      )
                    : ['None']
            );
            expect(shown.Problems.length, context.name).toBe(report.problems.length || 1);
        }
        page.close();
    });
});

it('finds the problems the fixture was made with, in the contexts they occur', async () => {
    const store = await openDocument(FIXTURES[2][1]());
    const document = store.state.currentDocument;
    store.actions.editFrame({ kind: 'select', id: 'view' });
    const checked = checkAccessibility(
        document,
        prototypeModes(store.state),
        contextsOf(store),
        store.state.config.accessibility
    );
    const kinds = Object.fromEntries(
        checked.map(({ context, screens }) => [
            context.name,
            screens[0].report.problems.map(({ kind }) => kind)
        ])
    );

    expect(kinds['Light · Mobile']).toEqual(['name', 'contrast', 'focusOrder']);
    expect(kinds['Dark · Desktop']).toEqual(['contrast', 'contrast', 'name', 'focusOrder']);
});

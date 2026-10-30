import { responsiveVariantsDocument } from './support/responsiveVariants';
import type { InstanceShape, Text } from 'src/app/types';
import { json } from 'overmind';
import { screenLayoutsDocument } from './support/screenLayouts';
import { projectScreen } from 'src/app/screenProjection';
import { projectPreview } from 'src/preview/project';
import { screenFrames } from 'src/app/screens';
import { screenLayoutMembers } from 'src/app/screenLayouts';
import { editableScreenView, canTransformScreenViewShape } from 'src/app/screenViewEditing';
import {
    serializePersistedState,
    migratePersistedState,
    restoreDocuments
} from 'src/app/services/documentStorage';
import { createTestStore } from './support/store';
import { createCopies, edit, settle, shownDocument, DOCUMENT_ID } from './support/collaboration';
import { registerTool } from 'src/app/actions/startup';
import { RectTool } from 'src/tools/components/Rect';

registerTool(RectTool);

it('projects separate layout trees without including an alternate in the default stack', () => {
    const document = screenLayoutsDocument();
    const before = json(document);
    const desktop = projectScreen(document, 'home', document.frames.desktop)!;
    const mobile = projectScreen(document, 'home', document.frames.mobile)!;
    expect(desktop.shapes).toMatchObject([
        { id: 'body', position: { x: 110, y: 90 }, size: { width: 280, height: 40 } }
    ]);
    expect(mobile.shapes).toMatchObject([
        { id: 'compact-body', position: { x: 520, y: 100 }, size: { width: 200, height: 30 } }
    ]);
    expect(desktop.frames).toEqual([]);
    expect(mobile.frames).toEqual([]);
    expect(screenFrames(document).map((frame) => frame.id)).toEqual(['home']);
    expect(json(document)).toEqual(before);
});

it('previews the chosen tree at one destination and defaults to the original artwork', () => {
    const document = screenLayoutsDocument();
    const original = projectPreview(document, {});
    expect(original.screens).toHaveLength(1);
    expect(original.screens[0].nodes.map((node) => node.key)).toEqual(['home/body']);
    const alternate = projectPreview(document, {}, [], {
        modes: {},
        screenId: 'home',
        layoutId: 'compact',
        viewport: { width: 360, height: 300 }
    });
    expect(alternate.screens[0]).toMatchObject({ id: 'home', width: 360, x: 1000, y: 800 });
    expect(alternate.screens[0].nodes.map((node) => node.key)).toEqual(['home/compact-body']);
    expect(JSON.stringify(alternate)).toContain('320');
});

it('retains a missing choice and shows the default with a diagnostic', () => {
    const document = screenLayoutsDocument();
    document.frames.mobile.layoutId = 'missing';
    const projection = projectScreen(document, 'home', document.frames.mobile)!;
    expect(projection.shapes.map((shape) => shape.id)).toEqual(['body']);
    expect(projection.problems.join()).toContain('chosen layout is unavailable');
    expect(document.frames.mobile.layoutId).toBe('missing');
});

it('persists alternate trees and view choices without migrating existing artwork', () => {
    const document = screenLayoutsDocument();
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    const restored = restoreDocuments(migratePersistedState(saved)!)[document.id];
    expect(restored.frames.compact.screenLayout).toBe(true);
    expect(restored.frames.mobile.layoutId).toBe('compact');
    expect(restored.shapes['compact-body'].parentFrameId).toBe('compact');
    expect(screenLayoutMembers(restored, 'home')).toEqual(new Set(['home']));
});

it('draws into the chosen layout and refuses transforms on artwork from another layout', () => {
    const { store } = createTestStore();
    store.actions.addDocument(screenLayoutsDocument(store.state.currentDocumentId));
    store.actions.tools.activateTool('rectangle');
    store.actions.events.beginGesture({
        pointerId: 1,
        position: { x: 540, y: 150 },
        screenViewId: 'mobile'
    });
    store.actions.events.endGesture({ pointerId: 1, position: { x: 580, y: 180 } });
    const document = store.state.currentDocument;
    const drawn = document.shapes[document.selectedShapesIds[0]];
    expect(drawn).toMatchObject({ parentFrameId: 'compact', position: { x: 1040, y: 870 } });
    expect(
        projectScreen(document, 'home', document.frames.desktop)!.shapes.map((shape) => shape.id)
    ).toEqual(['body']);
    expect(canTransformScreenViewShape(document, 'desktop', drawn.id)).toBe(false);
    expect(
        editableScreenView(store.state, { documentId: document.id, viewId: 'mobile' })?.screen.id
    ).toBe('compact');
});

it('creates and selects an empty layout in one shared undo step', async () => {
    const copies = await createCopies(2, (store) =>
        store.actions.addDocument(screenLayoutsDocument(DOCUMENT_ID))
    );
    const [a, b] = copies;
    edit(a, (actions) => actions.editFrame({ kind: 'addLayout', viewId: 'desktop', name: 'Wide' }));
    settle(copies);
    const id = shownDocument(a).frames.desktop.layoutId!;
    expect(shownDocument(b).frames[id]).toMatchObject({
        name: 'Wide',
        screenLayout: true,
        parentFrameId: 'home'
    });
    expect(
        projectScreen(shownDocument(a), 'home', shownDocument(a).frames.desktop)!.shapes
    ).toEqual([]);
    edit(b, (actions) =>
        actions.editFrame({ kind: 'update', id: 'home', changes: { name: 'Welcome' } })
    );
    settle(copies);
    a.collaboration.undo(DOCUMENT_ID);
    settle(copies);
    expect(shownDocument(a).frames[id]).toBeUndefined();
    expect(shownDocument(a).frames.desktop.layoutId).toBeUndefined();
    expect(shownDocument(a).frames.home.name).toBe('Welcome');
});

it('rejects choosing another screen’s layout or changing a locked view', () => {
    const { store } = createTestStore();
    store.actions.addDocument(screenLayoutsDocument(store.state.currentDocumentId));
    store.actions.editFrame({ kind: 'update', id: 'desktop', changes: { layoutId: 'home' } });
    expect(store.state.currentDocument.frames.desktop.layoutId).toBeUndefined();
    store.actions.editFrame({ kind: 'toggle', id: 'desktop', flag: 'locked' });
    expect(
        store.actions.editFrame({ kind: 'addLayout', viewId: 'desktop', name: 'Wide' })
    ).toBeUndefined();
    store.actions.editFrame({ kind: 'update', id: 'desktop', changes: { layoutId: 'compact' } });
    expect(store.state.currentDocument.frames.desktop.layoutId).toBeUndefined();
});

it('keeps the view selected when changing layouts, including after a stale choice', () => {
    const { store } = createTestStore();
    const source = screenLayoutsDocument(store.state.currentDocumentId);
    source.frames.mobile.layoutId = 'missing';
    store.actions.addDocument(source);
    store.actions.editFrame({ kind: 'select', id: 'mobile' });
    store.actions.editFrame({ kind: 'update', id: 'mobile', changes: { name: 'Phone' } });
    expect(store.state.currentDocument.frames.mobile.name).toBe('Phone');
    expect(store.state.currentDocument.frames.mobile.layoutId).toBe('missing');
    store.actions.editFrame({ kind: 'update', id: 'mobile', changes: { layoutId: null } });
    expect(store.state.currentDocument.selectedFrameId).toBe('mobile');
    expect(store.state.currentDocument.frames.mobile.layoutId).toBeUndefined();
});

it('shares component definitions across layouts while preserving instance values and responsive modes', () => {
    const document = responsiveVariantsDocument();
    document.frames.alternate = {
        id: 'alternate',
        kind: 'frame',
        screenLayout: true,
        parentFrameId: 'screen',
        name: 'Alternate',
        position: { x: 1000, y: 800 },
        size: { width: 300, height: 200 },
        visible: true,
        locked: false
    };
    document.frames.desktop.layoutId = 'alternate';
    document.shapes.other = {
        ...document.shapes.button,
        id: 'other',
        parentFrameId: 'alternate',
        position: { x: 1020, y: 820 },
        overrides: { label: 'Alternate content' }
    } as InstanceShape;
    document.shapesIds.push('other');
    const desktop = projectScreen(document, 'screen', document.frames.desktop)!;
    expect(desktop.shapes.map((shape) => shape.id)).toEqual(['other']);
    expect((desktop.shapes[0] as InstanceShape).projectedSource?.shapes[0]).toMatchObject({
        value: 'Alternate content',
        fontSize: 32
    });
    (document.shapes['wide-text'] as Text).fontSize = 40;
    expect(
        (projectScreen(document, 'screen', document.frames.desktop)!.shapes[0] as InstanceShape)
            .projectedSource?.shapes[0]
    ).toMatchObject({ value: 'Alternate content', fontSize: 40 });
    expect(
        (projectScreen(document, 'screen', document.frames.mobile)!.shapes[0] as InstanceShape)
            .projectedSource?.shapes[0]
    ).toMatchObject({ value: 'Continue', fontSize: 16 });
});

it('releases deleted layout artwork without losing the view or navigation destination', () => {
    const { store } = createTestStore();
    store.actions.addDocument(screenLayoutsDocument(store.state.currentDocumentId));
    store.actions.editFrame({ kind: 'delete', id: 'compact' });
    const document = store.state.currentDocument;
    expect(document.shapes['compact-body']).toBeDefined();
    expect(document.shapes['compact-body'].parentFrameId).toBeUndefined();
    expect(document.frames.mobile.layoutId).toBe('compact');
    expect(
        projectScreen(document, 'home', document.frames.mobile)!.shapes.map((shape) => shape.id)
    ).toEqual(['body']);
    expect(screenFrames(document).map((frame) => frame.id)).toEqual(['home']);
});

it.each(['default', 'alternate'] as const)(
    'ignores overflow from the inactive %s layout in canvas and Preview',
    (inactive) => {
        const document = screenLayoutsDocument();
        const shape = document.shapes[inactive === 'default' ? 'body' : 'compact-body'];

        if (shape.type !== 'rectangle') {
            throw new Error('Expected rectangle fixture');
        }

        shape.size.height = 500;
        const view = document.frames[inactive === 'default' ? 'mobile' : 'desktop'];
        const projection = projectScreen(document, 'home', view)!;
        expect(projection.problems).toEqual([]);
        expect(() =>
            projectPreview(document, {}, [], {
                modes: {},
                screenId: 'home',
                layoutId: view.layoutId,
                viewport: view.size
            })
        ).not.toThrow();
        const invalidView = document.frames[inactive === 'default' ? 'desktop' : 'mobile'];
        expect(projectScreen(document, 'home', invalidView)!.problems.join()).toContain('overflow');
        expect(() =>
            projectPreview(document, {}, [], {
                modes: {},
                screenId: 'home',
                layoutId: invalidView.layoutId,
                viewport: invalidView.size
            })
        ).toThrow('overflow');
    }
);

it('explains a missing layout when Preview falls back to default artwork', () => {
    const document = screenLayoutsDocument();
    const warnings: string[] = [];
    const preview = projectPreview(document, {}, warnings, {
        modes: {},
        screenId: 'home',
        layoutId: 'missing',
        viewport: document.frames.mobile.size
    });
    expect(preview.screens[0].nodes.map((node) => node.key)).toEqual(['home/body']);
    expect(warnings.join()).toContain('layout is unavailable');
});

it('converts a layout released by screen deletion into a new screen', () => {
    const { store } = createTestStore();
    store.actions.addDocument(screenLayoutsDocument(store.state.currentDocumentId));
    store.actions.editFrame({ kind: 'delete', id: 'home' });
    expect(store.state.currentDocument.frames.compact.parentFrameId).toBeUndefined();
    store.actions.editFrame({ kind: 'update', id: 'compact', changes: { kind: 'screen' } });
    const document = store.state.currentDocument;
    expect(document.frames.compact.kind).toBe('screen');
    expect(document.frames.compact.screenLayout).toBeUndefined();
    expect(Object.values(document.frames).some((frame) => frame.screenId === 'compact')).toBe(true);
    expect(document.shapes['compact-body'].parentFrameId).toBe('compact');
});

it('keeps a screen with alternate layouts on Canvas, so its layouts never merge', () => {
    const { store } = createTestStore();
    const source = screenLayoutsDocument(store.state.currentDocumentId);
    source.frames.box = {
        id: 'box',
        kind: 'frame',
        name: 'Box',
        position: { x: 0, y: 0 },
        size: { width: 3000, height: 3000 },
        visible: true,
        locked: false
    };
    store.actions.addDocument(source);
    store.actions.editFrame({ kind: 'update', id: 'home', changes: { parentFrameId: 'box' } });
    const document = store.state.currentDocument;
    expect(document.frames.home.parentFrameId).toBeUndefined();
    expect(
        projectScreen(document, 'home', document.frames.desktop)!.shapes.map((shape) => shape.id)
    ).toEqual(['body']);

    // Without layouts, a screen can still be nested as before.
    store.actions.editFrame({ kind: 'delete', id: 'compact' });
    store.actions.editFrame({ kind: 'update', id: 'home', changes: { parentFrameId: 'box' } });
    expect(store.state.currentDocument.frames.home.parentFrameId).toBe('box');
});

it('refuses a layout name another layout of the same screen already has', () => {
    const { store } = createTestStore();
    store.actions.addDocument(screenLayoutsDocument(store.state.currentDocumentId));
    const id = store.actions.editFrame({ kind: 'addLayout', viewId: 'desktop', name: 'Wide' })!;
    store.actions.editFrame({ kind: 'update', id, changes: { name: 'Compact' } });
    expect(store.state.currentDocument.frames[id].name).toBe('Wide');
    store.actions.editFrame({ kind: 'update', id, changes: { name: 'Tablet' } });
    expect(store.state.currentDocument.frames[id].name).toBe('Tablet');
});

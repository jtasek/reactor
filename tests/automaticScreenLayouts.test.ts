import { json } from 'overmind';
import { selectScreenLayout, viewLayoutRoot, screenLayoutProblems } from 'src/app/screenLayouts';
import { projectScreen } from 'src/app/screenProjection';
import { projectPreview } from 'src/preview/project';
import { readPreview } from 'src/preview/protocol';
import {
    readEntity,
    serializePersistedState,
    migratePersistedState,
    restoreDocuments
} from 'src/app/services/documentStorage';
import { createTestStore } from './support/store';
import { createCopies, edit, settle, shownDocument, DOCUMENT_ID } from './support/collaboration';
import { screenLayoutsDocument } from './support/screenLayouts';
import { automaticLayoutsPrototype } from './support/automaticScreenLayouts';
import { editableScreenView } from 'src/app/screenViewEditing';

it('uses inclusive minimum widths while explicit and legacy default choices win', () => {
    const document = screenLayoutsDocument();
    document.frames.home.responsiveLayouts = {
        compact: { minWidth: 400, layoutId: 'compact' },
        wide: { minWidth: 800, layoutId: 'home' }
    };
    const before = json(document);
    for (const [width, expected] of [
        [399, undefined],
        [400, 'compact'],
        [799, 'compact'],
        [800, 'home']
    ] as const) {
        const choice = { layoutMode: 'auto' as const, size: { width, height: 250 } };
        expect(selectScreenLayout(document, 'home', choice)).toBe(expected);
        expect(selectScreenLayout(document, 'home', { ...choice, layoutId: 'compact' })).toBe(
            'compact'
        );
        expect(selectScreenLayout(document, 'home', { size: choice.size })).toBeUndefined();
    }
    expect(json(document)).toEqual(before);
});

it('uses the automatic artwork for projection and editing without changing explicit views', () => {
    const document = screenLayoutsDocument();
    document.frames.home.responsiveLayouts = { compact: { minWidth: 200, layoutId: 'compact' } };
    document.frames.desktop.layoutMode = 'auto';
    const { store } = createTestStore();
    document.id = store.state.currentDocumentId;
    store.actions.addDocument(document);
    const current = store.state.currentDocument;
    const projected = projectScreen(current, 'home', current.frames.desktop)!;
    expect(projected.shapes.map((shape) => shape.id)).toEqual(['compact-body']);
    expect(viewLayoutRoot(current, current.frames.desktop).id).toBe('compact');
    expect(
        editableScreenView(store.state, { documentId: document.id, viewId: 'desktop' })?.screen.id
    ).toBe('compact');
    store.actions.editFrame({
        kind: 'update',
        id: 'desktop',
        changes: { size: { width: 199, height: 250 } }
    });
    expect(viewLayoutRoot(current, current.frames.desktop).id).toBe('home');
    expect(viewLayoutRoot(current, current.frames.mobile).id).toBe('compact');
});

it('keeps missing rules repairable and resolves duplicate widths deterministically with diagnostics', () => {
    const document = screenLayoutsDocument();
    document.frames.home.responsiveLayouts = {
        c: { minWidth: 100, layoutId: 'missing' },
        b: { minWidth: 200, layoutId: 'home' },
        a: { minWidth: 200, layoutId: 'compact' }
    };
    const choice = { layoutMode: 'auto' as const, size: { width: 200, height: 250 } };
    // Equal widths: the first by rule ID wins, as the Inspector lists it first.
    expect(selectScreenLayout(document, 'home', choice)).toBe('compact');
    document.frames.home.responsiveLayouts = {
        c: { minWidth: 100, layoutId: 'missing' },
        a: { minWidth: 200, layoutId: 'home' },
        b: { minWidth: 200, layoutId: 'compact' }
    };
    expect(selectScreenLayout(document, 'home', choice)).toBe('home');
    expect(screenLayoutProblems(document, 'home').join(' ')).toMatch(/missing layout.*unreachable/);
    const projected = projectScreen(document, 'home', {
        ...choice,
        position: { x: 0, y: 0 },
        size: { width: 150, height: 250 }
    })!;
    expect(projected.screen.id).toBe('home');
    // The rule's own problem explains the missing layout; no second, generic warning.
    expect(projected.problems.join()).toContain('references a missing layout');
    expect(projected.problems.join()).not.toContain('chosen layout is unavailable');
});

it('persists rules, Auto and explicit choices and rejects invalid durable settings', () => {
    const document = automaticLayoutsPrototype();
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    const restored = restoreDocuments(migratePersistedState(JSON.parse(JSON.stringify(saved)))!)[
        document.id
    ];
    expect(restored.frames.home.responsiveLayouts).toEqual(document.frames.home.responsiveLayouts);
    expect(restored.frames.view.layoutMode).toBe('auto');
    expect(restored.shapes.name).toMatchObject({ interaction: { controlId: 'person-name' } });
    expect(() =>
        readEntity('frames', {
            ...document.frames.home,
            responsiveLayouts: { rule: { minWidth: -1, layoutId: 'wide' } }
        })
    ).toThrow();
    // Lists from early saves of this version read with position IDs.
    expect(
        readEntity('frames', {
            ...document.frames.home,
            responsiveLayouts: [{ minWidth: 640, layoutId: 'wide' }]
        }).responsiveLayouts
    ).toEqual({ 'rule-0': { minWidth: 640, layoutId: 'wide' } });
    expect(() =>
        readEntity('frames', { ...document.frames.view, layoutMode: 'automatic' })
    ).toThrow();
    expect(() =>
        readEntity('frames', {
            ...document.frames.view,
            responsiveLayouts: { rule: { minWidth: 0, layoutId: 'wide' } }
        })
    ).toThrow();
});

it('retains explicit Preview choices through viewport changes and applies width across navigation destinations', () => {
    const document = automaticLayoutsPrototype();
    const session = {
        modes: {},
        screenId: 'home',
        viewport: { width: 320, height: 480 },
        layoutMode: 'auto' as const
    };
    const auto = projectPreview(document, {}, [], session, { width: 640 });
    expect(auto.screens[0].nodes.map((node) => node.key)).toEqual([
        'home/wide-name',
        'home/wide-next'
    ]);
    expect(auto.screens.every((screen) => screen.width === 640)).toBe(true);
    const inspected = projectPreview(document, {}, [], session, {
        width: 800,
        layouts: { home: 'home' }
    });
    expect(inspected.screens[0].nodes.map((node) => node.key)).toEqual(['home/next', 'home/name']);
    const manual = projectPreview(
        document,
        {},
        [],
        { ...session, layoutMode: undefined },
        { width: 800 }
    );
    expect(manual.screens[0].nodes.map((node) => node.key)).toEqual(['home/next', 'home/name']);
    expect(document.frames.view.size.width).toBe(320);
});

it('shares input state only through explicit control and compatible property identities, retaining button actions', () => {
    const document = automaticLayoutsPrototype();
    const input = (width: number) =>
        projectPreview(document, {}, [], null, { width }).screens[0].nodes.find(
            (node) => node.control?.role === 'input'
        )!;
    expect(input(320).control!.stateKey).toBe(input(800).control!.stateKey);
    const incompatible = automaticLayoutsPrototype(false);
    const alternate = projectPreview(incompatible, {}, [], null, { width: 800 });
    expect(
        alternate.screens[0].nodes.find((node) => node.control?.role === 'input')!.control!.stateKey
    ).not.toBe(input(320).control!.stateKey);
    const read = readPreview(projectPreview(document, {}, [], null, { width: 800 }));
    expect(
        read.screens[0].nodes.find((node) => node.control?.role === 'button')!.control!.navigateTo
    ).toBe('details');
    expect(
        read.screens[0].nodes.find((node) => node.control?.role === 'input')!.control!.stateKey
    ).toBe(input(320).control!.stateKey);
});

it('does not share state for duplicate input identities in one layout', () => {
    const document = automaticLayoutsPrototype();
    document.shapes['wide-name'].parentFrameId = 'home';
    const warnings: string[] = [];
    const preview = projectPreview(document, {}, warnings, null, { width: 320 });
    const inputs = preview.screens[0].nodes.filter((node) => node.control?.role === 'input');
    expect(inputs).toHaveLength(2);
    expect(inputs.every((node) => node.control?.stateKey === undefined)).toBe(true);
    expect(warnings.join()).toContain('Duplicate input identity');
});

it('converges concurrent rules and manual choices, and undo preserves the other author’s choice', async () => {
    const copies = await createCopies(2, (store) =>
        store.actions.addDocument(screenLayoutsDocument(DOCUMENT_ID))
    );
    const [a, b] = copies;
    edit(a, (actions) =>
        actions.editFrame({
            kind: 'update',
            id: 'home',
            changes: { responsiveLayouts: { compact: { minWidth: 200, layoutId: 'compact' } } }
        })
    );
    edit(b, (actions) =>
        actions.editFrame({
            kind: 'update',
            id: 'mobile',
            changes: { layoutId: null, layoutMode: 'auto' }
        })
    );
    settle(copies);
    expect(shownDocument(a).frames.home.responsiveLayouts).toEqual(
        shownDocument(b).frames.home.responsiveLayouts
    );
    expect(shownDocument(a).frames.mobile.layoutMode).toBe(
        shownDocument(b).frames.mobile.layoutMode
    );
    expect(viewLayoutRoot(shownDocument(a), shownDocument(a).frames.mobile).id).toBe('compact');
    a.collaboration.undo(DOCUMENT_ID);
    settle(copies);
    expect(shownDocument(a).frames.mobile.layoutMode).toBe('auto');
    expect(viewLayoutRoot(shownDocument(a), shownDocument(a).frames.mobile).id).toBe('home');
    copies.forEach(({ collaboration }) => collaboration.dispose());
});

it('clones screen rules onto the cloned artwork and keeps the Inspector on its view when rules change', () => {
    const { store } = createTestStore();
    const document = automaticLayoutsPrototype();
    document.id = store.state.currentDocumentId;
    store.actions.addDocument(document);
    store.actions.editFrame({ kind: 'select', id: 'view' });
    store.actions.editFrame({
        kind: 'update',
        id: 'home',
        changes: {
            responsiveLayouts: {
                wide: { minWidth: 700, layoutId: 'wide' },
                home: { minWidth: 900, layoutId: 'home' }
            }
        }
    });
    expect(store.state.currentDocument.selectedFrameId).toBe('view');
    const cloneId = store.actions.editFrame({ kind: 'clone', id: 'home' })!;
    const current = store.state.currentDocument;
    const clone = current.frames[cloneId];
    expect(clone).toBeDefined();
    expect(clone.responsiveLayouts!.home.layoutId).toBe(clone.id);
    expect(current.frames[clone.responsiveLayouts!.wide.layoutId].parentFrameId).toBe(clone.id);
});

it('keeps authored screen sizing constraints when no Preview viewport is specified', () => {
    const document = automaticLayoutsPrototype();
    document.frames.home.sizing = { width: { mode: 'fixed', min: 700 } };
    const preview = projectPreview(document, {});
    expect(preview.screens[0].width).toBe(700);
    expect(preview.screens[0].nodes.map((node) => node.key)).toEqual([
        'home/wide-name',
        'home/wide-next'
    ]);
    expect(document.frames.home.sizing).toEqual({ width: { mode: 'fixed', min: 700 } });
});

it('converges simultaneous edits to the shared rule set without rewriting view choices', async () => {
    const copies = await createCopies(2, (store) =>
        store.actions.addDocument(screenLayoutsDocument(DOCUMENT_ID))
    );
    const [a, b] = copies;
    edit(a, (actions) =>
        actions.editFrame({
            kind: 'update',
            id: 'home',
            changes: { responsiveLayouts: { rule: { minWidth: 200, layoutId: 'compact' } } }
        })
    );
    edit(b, (actions) =>
        actions.editFrame({
            kind: 'update',
            id: 'home',
            changes: { responsiveLayouts: { rule: { minWidth: 500, layoutId: 'compact' } } }
        })
    );
    settle(copies);
    expect(shownDocument(a).frames.home.responsiveLayouts).toEqual(
        shownDocument(b).frames.home.responsiveLayouts
    );
    expect(shownDocument(a).frames.mobile.layoutId).toBe('compact');
    expect(shownDocument(b).frames.mobile.layoutId).toBe('compact');
    copies.forEach(({ collaboration }) => collaboration.dispose());
});

it('refuses rule edits on locked screens and validates the extended Preview contract', () => {
    const { store } = createTestStore();
    const document = automaticLayoutsPrototype();
    document.id = store.state.currentDocumentId;
    document.frames.home.locked = true;
    store.actions.addDocument(document);
    store.actions.editFrame({ kind: 'update', id: 'home', changes: { responsiveLayouts: {} } });
    expect(store.state.currentDocument.frames.home.responsiveLayouts).toEqual(
        document.frames.home.responsiveLayouts
    );
    const drawing = projectPreview(document, {});
    const input = drawing.screens[0].nodes.find((node) => node.control?.role === 'input')!;
    expect(() =>
        readPreview({ ...drawing, screens: [{ ...drawing.screens[0], layoutChoice: 4 }] })
    ).toThrow('Invalid layout choice');
    expect(() =>
        readPreview({
            ...drawing,
            screens: [{ ...drawing.screens[0], layouts: [{ id: 'home', name: {} }] }]
        })
    ).toThrow('Invalid layout choices');
    expect(() =>
        readPreview({
            ...drawing,
            screens: [
                {
                    ...drawing.screens[0],
                    nodes: [{ ...input, control: { ...input.control, stateKey: {} } }]
                }
            ]
        })
    ).toThrow('Invalid preview control');
});

it.each(['launch', 'inspection'] as const)(
    'preserves destination height constraints when %s sets only its width',
    (kind) => {
        const document = automaticLayoutsPrototype();
        document.frames.details.sizing = { height: { mode: 'fixed', min: 700 } };
        const before = json(document.frames);
        const session =
            kind === 'launch'
                ? { modes: {}, screenId: 'home', viewport: { width: 320, height: 480 } }
                : undefined;
        const drawing = projectPreview(
            document,
            {},
            [],
            session,
            kind === 'inspection' ? { width: 800 } : {}
        );
        expect(drawing.screens.find((screen) => screen.id === 'details')).toMatchObject({
            width: kind === 'launch' ? 320 : 800,
            height: 700
        });
        expect(json(document.frames)).toEqual(before);
    }
);

it('keeps both rules when two people add rules at the same time', async () => {
    const copies = await createCopies(2, (store) =>
        store.actions.addDocument(screenLayoutsDocument(DOCUMENT_ID))
    );
    const [a, b] = copies;
    edit(a, (actions) =>
        actions.editFrame({
            kind: 'update',
            id: 'home',
            changes: { responsiveLayouts: { first: { minWidth: 200, layoutId: 'compact' } } }
        })
    );
    edit(b, (actions) =>
        actions.editFrame({
            kind: 'update',
            id: 'home',
            changes: { responsiveLayouts: { second: { minWidth: 800, layoutId: 'home' } } }
        })
    );
    settle(copies);
    expect(shownDocument(a).frames.home.responsiveLayouts).toEqual({
        first: { minWidth: 200, layoutId: 'compact' },
        second: { minWidth: 800, layoutId: 'home' }
    });
    expect(shownDocument(b).frames.home.responsiveLayouts).toEqual(
        shownDocument(a).frames.home.responsiveLayouts
    );
    copies.forEach(({ collaboration }) => collaboration.dispose());
});

it('drops a copied input identity beside its original but keeps it in another layout', () => {
    const { store } = createTestStore();
    const document = automaticLayoutsPrototype();
    document.id = store.state.currentDocumentId;
    delete (document.shapes['wide-name'] as { interaction?: unknown }).interaction;
    store.actions.addDocument(document);
    store.actions.cloneShapes(['name']);
    const current = store.state.currentDocument;
    const clone = Object.values(current.shapes).find(
        (shape) => shape.selected && shape.id !== 'name'
    );
    expect(clone?.type === 'instance' && clone.interaction).toMatchObject({ role: 'input' });
    expect(clone?.type === 'instance' && clone.interaction?.controlId).toBeUndefined();
    const warnings: string[] = [];
    projectPreview(json(current), {}, warnings);
    expect(warnings.filter((warning) => warning.startsWith('Duplicate input identity'))).toEqual(
        []
    );
});

it('keeps a pasted input identity in another layout and drops it beside its original', () => {
    const { store } = createTestStore();
    const document = automaticLayoutsPrototype();
    document.id = store.state.currentDocumentId;
    delete (document.shapes['wide-name'] as { interaction?: unknown }).interaction;
    store.actions.addDocument(document);
    store.actions.unselectShapes();
    store.actions.selectShape('name');
    const text = store.actions.copySelection()!;
    const pasted = (layoutId: string | null) => {
        store.actions.editFrame({ kind: 'update', id: 'view', changes: { layoutId } });
        store.actions.events.setScreenView('view');
        expect(store.actions.pasteShapes(text)).toBe('pasted');
        const current = store.state.currentDocument;
        const shape = current.shapes[current.selectedShapesIds[0]];
        expect(shape.parentFrameId).toBe(layoutId ?? 'home');

        return shape.type === 'instance' ? shape.interaction : undefined;
    };
    expect(pasted(null)?.controlId).toBeUndefined();
    expect(pasted('wide')?.controlId).toBe('person-name');
});

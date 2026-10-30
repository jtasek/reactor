import { json } from 'overmind';
import { responsiveDocument } from './support/responsiveModes';
import { createTestStore } from './support/store';
import { createCopies, DOCUMENT_ID, edit, settle, shownDocument } from './support/collaboration';
import { resolveModes } from 'src/app/inheritedModes';
import { readDimension } from 'src/app/variableModes';
import { projectScreen } from 'src/app/screenProjection';
import { projectPreview } from 'src/preview/project';
import {
    readEntity,
    serializePersistedState,
    migratePersistedState
} from 'src/app/services/documentStorage';
import {
    exportDesignSystemPackage,
    parseDesignSystemPackage,
    planDesignSystemImport
} from 'src/app/designSystemPackages';
import { writeClipboard, readClipboard } from 'src/app/clipboard';

it.each([
    [0, 'xs'],
    [399.9, 'xs'],
    [400, 'sm'],
    [599.9, 'sm'],
    [600, 'lg'],
    [10000, 'lg']
])('selects the inclusive minimum at width %s while keeping Theme independent', (width, mode) => {
    const document = responsiveDocument();
    document.frames.mobile.size.width = Number(width);
    const before = JSON.stringify(document);
    expect(resolveModes(document, { viewId: 'mobile', frameId: 'content' }).modes).toEqual({
        theme: 'dark',
        media: mode
    });
    expect(resolveModes(document, { viewId: 'desktop' }).modes).toEqual({
        theme: 'light',
        media: 'lg'
    });
    expect(JSON.stringify(document)).toBe(before);
});

it('falls back to the default, keeps loose canvas modes manual and honors explicit overrides', () => {
    const document = responsiveDocument();
    delete document.dimensions.media.modes.xs.minWidth;
    expect(resolveModes(document, { viewId: 'mobile' }).modes.media).toBe('sm');
    expect(resolveModes(document, { simulation: { media: 'xs', theme: 'dark' } }).modes).toEqual({
        media: 'xs',
        theme: 'dark'
    });
    document.frames.screen.modeOverrides = { media: 'xs' };
    expect(resolveModes(document, { viewId: 'desktop' }).modes.media).toBe('xs');
    document.frames.desktop.modeOverrides = { media: 'sm' };
    expect(resolveModes(document, { viewId: 'desktop' }).modes.media).toBe('sm');
    document.frames.content.modeOverrides = { media: 'lg' };
    expect(resolveModes(document, { viewId: 'desktop', frameId: 'content' }).modes.media).toBe(
        'lg'
    );
    delete document.frames.screen.modeOverrides;
    delete document.frames.desktop.modeOverrides;
    delete document.dimensions.media.selection;
    expect(resolveModes(document, { viewId: 'desktop' }).modes.media).toBe('sm');
});

it('projects button width and typography at each view width and retains source values', () => {
    const document = responsiveDocument();
    const before = JSON.stringify(document);
    for (const [id, width, font] of [
        ['mobile', 80, 14],
        ['desktop', 240, 20]
    ] as const) {
        const projected = projectScreen(document, 'screen', document.frames[id])!;
        expect(projected.shapes.find((shape) => shape.id === 'button')).toMatchObject({
            size: { width }
        });
        expect(projected.shapes.find((shape) => shape.id === 'label')).toMatchObject({
            fontSize: font
        });
    }
    const preview = projectPreview(document, {}, [], {
        modes: resolveModes(document, { viewId: 'mobile' }).modes,
        screenId: 'screen',
        viewport: document.frames.mobile.size
    });
    expect(JSON.stringify(preview.screens[0].nodes)).toContain('"width":80');
    expect(JSON.stringify(preview.screens[0].nodes)).toContain('"font-size":14');
    expect(JSON.stringify(preview.screens[0].nodes)).toContain('#ddeeff');
    expect(JSON.stringify(document)).toBe(before);
});

it.each([-1, Infinity, NaN, '600', null])('rejects invalid minimum width %s', (minWidth) => {
    const dimension = responsiveDocument().dimensions.media;
    expect(() =>
        readDimension({
            ...dimension,
            modes: {
                ...dimension.modes,
                lg: { ...dimension.modes.lg, minWidth }
            }
        })
    ).toThrow('Minimum widths');
});

it('inherits responsive geometry inside components and keeps explicit instance choices', () => {
    const { store } = createTestStore();
    store.actions.addDocument(responsiveDocument(store.state.currentDocumentId));
    store.actions.addComponent({
        id: 'button-component',
        name: 'Button',
        sourceOnly: true,
        shapesIds: ['button', 'label']
    });
    store.actions.addShape({
        type: 'instance',
        componentId: 'button-component',
        parentFrameId: 'content',
        position: { x: 120, y: 120 },
        overrides: {}
    });
    const document = store.state.currentDocument;
    const id = document.shapesIds.at(-1)!;
    const projected = (viewId: string) =>
        projectScreen(document, 'screen', document.frames[viewId])!.shapes.find(
            (shape) => shape.id === id
        );
    expect(projected('mobile')).toMatchObject({
        projectedSource: {
            shapes: expect.arrayContaining([
                expect.objectContaining({ type: 'rectangle', size: { width: 80, height: 32 } }),
                expect.objectContaining({ type: 'text', fontSize: 14 })
            ])
        }
    });
    expect(projected('desktop')).toMatchObject({
        projectedSource: {
            shapes: expect.arrayContaining([
                expect.objectContaining({ type: 'text', fontSize: 20 })
            ])
        }
    });
    store.actions.setModeOverride({
        target: { instanceId: id },
        dimensionId: 'media',
        modeId: 'sm'
    });
    expect(projected('desktop')).toMatchObject({
        projectedSource: {
            shapes: expect.arrayContaining([
                expect.objectContaining({ type: 'text', fontSize: 16 })
            ])
        }
    });
});

it('keeps thresholds independent from names, order and defaults and drops a deleted mode rule', () => {
    const { store } = createTestStore();
    store.actions.addDocument(responsiveDocument(store.state.currentDocumentId));
    const document = store.state.currentDocument;
    const media = json(document.dimensions.media);
    store.actions.updateDimension({
        ...media,
        defaultModeId: 'lg',
        modes: {
            ...media.modes,
            xs: { ...media.modes.xs, name: 'Phone', order: 10 }
        }
    });
    expect(resolveModes(document, { viewId: 'mobile' }).modes.media).toBe('xs');
    expect(projectScreen(document, 'screen', document.frames.mobile)!.shapes[0]).toMatchObject({
        size: { width: 80 }
    });
    store.actions.deleteDimensionMode({ dimensionId: 'media', modeId: 'xs' });
    expect(resolveModes(document, { viewId: 'mobile' }).modes.media).toBe('lg');
    expect(document.variables.width.values.default).toBe(240);
    expect(document.variables.width.values).toMatchObject({ sm: 120 });
});

it('rejects ambiguous thresholds and unknown selection methods', () => {
    const dimension = responsiveDocument().dimensions.media;
    dimension.modes.lg.minWidth = 400;
    expect(() => readDimension(dimension)).toThrow('different minimum width');
    expect(() => readDimension({ ...dimension, selection: 'viewport' })).toThrow(
        'Invalid mode selection'
    );
});

it('round trips thresholds through persistence, clipboard and native packages; old dimensions stay manual', () => {
    const { store } = createTestStore();
    store.actions.addDocument(responsiveDocument(store.state.currentDocumentId));
    const document = store.state.currentDocument;
    const saved = serializePersistedState(store.state);
    expect(migratePersistedState(saved)?.documents[document.id].dimensions).toEqual(
        json(document.dimensions)
    );
    const legacy = structuredClone(saved);
    legacy.version = 18;
    delete legacy.documents[document.id].dimensions.media.selection;
    Object.values(legacy.documents[document.id].dimensions.media.modes).forEach(
        (mode) => delete mode.minWidth
    );
    expect(
        migratePersistedState(legacy)?.documents[document.id].dimensions.media.selection
    ).toBeUndefined();
    expect(readEntity('dimensions', json(document.dimensions.media))).toEqual(
        json(document.dimensions.media)
    );
    const copied = readClipboard(
        writeClipboard([document.shapes.button], [], document.variables, document)
    );
    expect(copied.dimensions?.media).toEqual(json(document.dimensions.media));
    const packageData = parseDesignSystemPackage(exportDesignSystemPackage(json(document)));
    const { store: target } = createTestStore();
    let id = 0;
    const operations = planDesignSystemImport(
        target.state.currentDocument,
        packageData,
        'reuse',
        () => `import-${++id}`
    );
    expect(
        target.actions.applyOperations({
            documentId: target.state.currentDocumentId,
            by: { kind: 'person' },
            operations
        }).applied
    ).toBe(true);
    expect(
        Object.values(target.state.currentDocument.dimensions).find((d) => d.name === 'MediaSize')
    ).toMatchObject({ selection: 'width', modes: json(document.dimensions.media.modes) });
});

it('shares rule edits and undo without losing modes or variable values', async () => {
    const copies = await createCopies(2, (store) =>
        store.actions.addDocument(responsiveDocument(DOCUMENT_ID))
    );
    const [first, second] = copies;
    const before = json(shownDocument(first).variables);
    edit(first, (actions) =>
        actions.updateDimension({
            ...json(shownDocument(first).dimensions.media),
            modes: {
                ...json(shownDocument(first).dimensions.media.modes),
                lg: { id: 'lg', name: 'lg', order: 2, minWidth: 300 }
            }
        })
    );
    settle(copies);
    expect(resolveModes(shownDocument(second), { viewId: 'mobile' }).modes.media).toBe('lg');
    first.collaboration.undo(DOCUMENT_ID);
    settle(copies);
    expect(resolveModes(shownDocument(second), { viewId: 'mobile' }).modes.media).toBe('xs');
    expect(json(shownDocument(second).variables)).toEqual(before);
    copies.forEach((copy) => copy.collaboration.dispose());
});

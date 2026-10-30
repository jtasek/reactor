import { json } from 'overmind';
import { editableScreenView } from 'src/app/screenViewEditing';
import { createComponent, createShape } from 'src/app/factories';
import { instanceProperties } from 'src/app/computed/componentPanels';
import { responsiveVariantsDocument } from './support/responsiveVariants';
import { responsiveVariant, variantWidths } from 'src/app/responsiveVariants';
import { projectScreen } from 'src/app/screenProjection';
import { projectPreview } from 'src/preview/project';
import { instanceComponentId } from 'src/app/componentSource';
import { createTestStore } from './support/store';
import { createCopies, DOCUMENT_ID, edit, settle, shownDocument } from './support/collaboration';
import {
    readEntity,
    serializePersistedState,
    restoreDocuments,
    migratePersistedState
} from 'src/app/services/documentStorage';
import { librarySnapshot, componentFingerprint } from 'src/app/componentLibrary';
import { writeClipboard, readClipboard } from 'src/app/clipboard';
import type { InstanceShape, Text } from 'src/app/types';

it.each([
    [0, 'family'],
    [599.9, 'family'],
    [600, 'wide'],
    [1200, 'wide']
])('uses an inclusive minimum at %s and defaults below it', (width, expected) => {
    const document = responsiveVariantsDocument();
    const instance = document.shapes.button as InstanceShape;
    const before = JSON.stringify(document);
    const decision = responsiveVariant(document, instance, { screen: Number(width) });
    expect(decision.componentId).toBe(expected);
    expect(JSON.stringify(document)).toBe(before);
});

it('chooses the greatest matching rule independent of authored order', () => {
    const document = responsiveVariantsDocument();
    document.components.extra = { ...document.components.wide, id: 'extra' };
    document.components.family.variantIds!.push('extra');
    document.components.family.responsiveVariants!.rules = [
        { minWidth: 900, variantId: 'extra' },
        { minWidth: 600, variantId: 'wide' }
    ];
    expect(
        responsiveVariant(document, document.shapes.button as InstanceShape, { screen: 900 })
            .componentId
    ).toBe('extra');
});

it('resolves two Screen views and the local prototype viewport without changing saved choices, values or actions', () => {
    const document = responsiveVariantsDocument();
    const before = JSON.stringify(document);
    for (const [id, font, componentId] of [
        ['mobile', 16, 'family'],
        ['desktop', 32, 'wide']
    ] as const) {
        const projection = projectScreen(document, 'screen', document.frames[id])!;
        const button = projection.shapes.find((shape) => shape.id === 'button') as InstanceShape;
        expect(instanceComponentId(document, button)).toBe(componentId);
        expect(button.variantId).toBeUndefined();
        expect(button.variantMode).toBe('auto');
        expect(button.projectedSource?.shapes[0]).toMatchObject({
            value: 'Continue',
            fontSize: font
        });
        expect(button.interaction?.navigateTo).toBe('home');
        const preview = projectPreview(document, {}, [], {
            modes: {},
            screenId: 'screen',
            viewport: document.frames[id].size
        });
        expect(JSON.stringify(preview.screens[0].nodes)).toContain(`"font-size":${font}`);
        expect(JSON.stringify(preview.screens[0].nodes)).toContain('Continue');
    }
    expect(JSON.stringify(document)).toBe(before);
});

it('keeps both explicit alternates and explicit default authoritative', () => {
    const document = responsiveVariantsDocument();
    const button = document.shapes.button as InstanceShape;
    button.variantId = 'wide';
    expect(responsiveVariant(document, button, { screen: 300 }).componentId).toBe('wide');
    delete button.variantId;
    delete button.variantMode;
    expect(responsiveVariant(document, button, { screen: 1200 }).componentId).toBe('family');
});

it('resolves parent inner width independently for narrow and wide instances in one screen', () => {
    const document = responsiveVariantsDocument();
    document.components.family.responsiveVariants!.source = 'parent';
    document.frames.content.stack = { direction: 'column', gap: 0, padding: 20, align: 'start' };
    document.frames.content.size.width = 640;
    document.frames.narrow = {
        ...document.frames.content,
        id: 'narrow',
        size: { width: 639, height: 200 }
    };
    document.shapes.other = {
        ...document.shapes.button,
        id: 'other',
        parentFrameId: 'narrow',
        order: 'a3'
    };
    document.shapesIds.push('other');
    const projection = projectScreen(document, 'screen', document.frames.desktop)!;
    const choices = projection.shapes.map(
        (shape) => shape.type === 'instance' && instanceComponentId(document, shape)
    );
    expect(choices).toEqual(['wide', 'family']);
    expect((projection.shapes[0] as InstanceShape).projectedSource?.variant?.explanation).toContain(
        'Parent inner width 600px'
    );
});

it('uses resolved fill parent width and padding', () => {
    const document = responsiveVariantsDocument();
    document.components.family.responsiveVariants!.source = 'parent';
    document.frames.screen.stack = { direction: 'column', gap: 0, padding: 20, align: 'start' };
    document.frames.content.sizing = { width: { mode: 'fill' } };
    document.frames.content.stack = { direction: 'column', gap: 0, padding: 10, align: 'start' };
    const projection = projectScreen(document, 'screen', {
        ...document.frames.desktop,
        size: { width: 660, height: 300 }
    })!;
    expect((projection.shapes[0] as InstanceShape).projectedSource?.variant?.explanation).toContain(
        'Parent inner width 600px'
    );
});

it('uses stable default with a repairable diagnostic for hug dependencies, including fill descendants', () => {
    const document = responsiveVariantsDocument();
    document.components.family.responsiveVariants!.source = 'parent';
    document.frames.content.sizing = { width: { mode: 'hug' } };
    document.frames.content.stack = { direction: 'column', gap: 0, padding: 0, align: 'start' };
    for (let count = 0; count < 3; count++) {
        const projection = projectScreen(document, 'screen', document.frames.desktop)!;
        expect(instanceComponentId(document, projection.shapes[0] as InstanceShape)).toBe('family');
        expect(projection.problems.join()).toContain('Parent width depends on its contents');
    }
    document.frames.child = {
        ...document.frames.content,
        id: 'child',
        parentFrameId: 'content',
        sizing: { width: { mode: 'fill' } }
    };
    expect(variantWidths(document, 'child').parent).toBeUndefined();
    document.frames.child.sizing = { width: { mode: 'fixed' } };
    expect(variantWidths(document, 'child').parent).toBe(260);
});

it('reports missing rules, width, variants and conflicting thresholds without deleting authored data', () => {
    const document = responsiveVariantsDocument();
    const button = document.shapes.button as InstanceShape;
    expect(responsiveVariant(document, button, {}).problem).toContain('No Screen view width');
    document.components.family.responsiveVariants!.rules.push({ minWidth: 600, variantId: 'wide' });
    expect(responsiveVariant(document, button, { screen: 800 }).problem).toContain('Duplicate');
    document.components.family.responsiveVariants!.rules.pop();
    delete document.components.wide;
    expect(responsiveVariant(document, button, { screen: 800 }).problem).toContain('unavailable');
    expect(document.components.family.responsiveVariants!.rules[0].variantId).toBe('wide');
    delete document.components.family.responsiveVariants;
    expect(responsiveVariant(document, button, { screen: 800 }).problem).toContain(
        'No responsive rules'
    );
});

it('persists opt-in selection and rules through save, clipboard and library snapshots', () => {
    const document = responsiveVariantsDocument();
    const saved = serializePersistedState({
        documents: { [document.id]: document },
        currentDocumentId: document.id
    });
    const restored = restoreDocuments(saved)[document.id];
    expect(restored.components.family.responsiveVariants).toEqual(
        document.components.family.responsiveVariants
    );
    expect((restored.shapes.button as InstanceShape).variantMode).toBe('auto');
    expect(JSON.stringify(saved)).not.toContain('projectedSource');
    expect(migratePersistedState({ ...saved, version: 19 })).not.toBeNull();
    const snapshot = librarySnapshot(document, 'family', { components: {} })!;
    expect(snapshot.find((component) => component.id === 'family')?.responsiveVariants).toEqual(
        document.components.family.responsiveVariants
    );
    const before = componentFingerprint(document, 'family');
    document.components.family.responsiveVariants!.rules[0].minWidth = 700;
    expect(componentFingerprint(document, 'family')).not.toBe(before);
    const copied = readClipboard(
        writeClipboard([document.shapes.button], [], document.variables, document)
    );
    expect(copied).not.toBeNull();
    expect(copied!.shapes[0]).toMatchObject({
        variantMode: 'auto',
        overrides: { label: 'Continue' }
    });
    expect(
        copied!.components?.find((component) => component.id === 'family')?.responsiveVariants
            ?.rules[0].minWidth
    ).toBe(700);
});

it('rejects duplicate and invalid thresholds at the durable boundary', () => {
    const document = responsiveVariantsDocument();
    const family = document.components.family;
    for (const minWidth of [-1, NaN, Infinity]) {
        expect(() =>
            readEntity('components', {
                ...family,
                responsiveVariants: { source: 'screen', rules: [{ minWidth, variantId: 'wide' }] }
            })
        ).toThrow();
    }
    expect(() =>
        readEntity('components', {
            ...family,
            responsiveVariants: {
                source: 'screen',
                rules: [
                    { minWidth: 1, variantId: 'wide' },
                    { minWidth: 1, variantId: 'wide' }
                ]
            }
        })
    ).toThrow('Duplicate');
});

it('edits rules and instance selection with validation and locked access', () => {
    const { store } = createTestStore();
    store.actions.addDocument(responsiveVariantsDocument(store.state.currentDocumentId));
    const document = store.state.currentDocument;
    const settings = { source: 'parent' as const, rules: [{ minWidth: 400, variantId: 'wide' }] };
    store.actions.setResponsiveVariants({ componentId: 'family', settings });
    expect(document.components.family.responsiveVariants).toEqual(settings);
    store.actions.setResponsiveVariants({
        componentId: 'family',
        settings: { ...settings, rules: [...settings.rules, ...settings.rules] }
    });
    expect(document.components.family.responsiveVariants).toEqual(settings);
    store.actions.setInstanceVariant({ instanceIds: ['button'], variantId: 'wide' });
    expect(document.shapes.button).toMatchObject({
        variantId: 'wide',
        overrides: { label: 'Continue' }
    });
    expect((document.shapes.button as InstanceShape).variantMode).toBeUndefined();
    store.actions.setInstanceVariant({ instanceIds: ['button'], automatic: true });
    expect((document.shapes.button as InstanceShape).variantId).toBeUndefined();
    expect((document.shapes.button as InstanceShape).variantMode).toBe('auto');
    store.actions.lockComponent('family');
    store.actions.setResponsiveVariants({ componentId: 'family' });
    expect(document.components.family.responsiveVariants).toEqual(settings);
});

it('shares rules and selection and undoes a rule edit without reverting remote instance values', async () => {
    const seed = responsiveVariantsDocument(DOCUMENT_ID);
    const [a, b] = await createCopies(2, (store) => store.actions.addDocument(seed));
    await edit(a, () =>
        a.store.actions.setResponsiveVariants({
            componentId: 'family',
            settings: { source: 'parent', rules: [{ minWidth: 400, variantId: 'wide' }] }
        })
    );
    settle([a, b]);
    expect(shownDocument(b).components.family.responsiveVariants?.source).toBe('parent');
    await edit(b, () =>
        b.store.actions.setInstanceOverride({
            instanceIds: ['button'],
            propId: 'label',
            value: 'Remote'
        })
    );
    settle([a, b]);
    a.collaboration.undo(DOCUMENT_ID);
    settle([a, b]);
    expect(shownDocument(a).components.family.responsiveVariants?.source).toBe('screen');
    expect(json(shownDocument(a).shapes.button)).toMatchObject({
        variantMode: 'auto',
        overrides: { label: 'Remote' }
    });
});

it('inherits Screen view width through nested instances, and diagnoses an intrinsic component parent', () => {
    const document = responsiveVariantsDocument();
    const nested = createShape({
        name: 'Nested button',
        type: 'instance',
        componentId: 'family',
        variantMode: 'auto',
        overrides: { label: 'Nested' },
        position: { x: 0, y: 0 },
        order: 'a4'
    });
    document.shapes[nested.id] = nested;
    document.shapesIds.push(nested.id);
    document.components.outer = createComponent({
        id: 'outer',
        name: 'Outer',
        sourceOnly: true,
        shapesIds: [nested.id]
    });
    const button = document.shapes.button as InstanceShape;
    button.componentId = 'outer';
    delete button.variantMode;
    const projection = projectScreen(document, 'screen', document.frames.desktop)!;
    const inner = (projection.shapes[0] as InstanceShape).projectedSource!
        .shapes[0] as InstanceShape;
    expect(instanceComponentId(document, inner)).toBe('wide');
    expect(inner.projectedSource!.shapes[0]).toMatchObject({ value: 'Nested', fontSize: 32 });
    document.components.family.responsiveVariants!.source = 'parent';
    const fallback = projectScreen(document, 'screen', document.frames.desktop)!;
    expect(fallback.problems.join()).toContain('Component width depends on its artwork');
    expect(
        instanceComponentId(
            document,
            (fallback.shapes[0] as InstanceShape).projectedSource!.shapes[0] as InstanceShape
        )
    ).toBe('family');
});

it('falls back with a diagnostic when the winning source has no usable artwork', () => {
    const document = responsiveVariantsDocument();
    document.components.wide.shapesIds = [];
    const projection = projectScreen(document, 'screen', document.frames.desktop)!;
    expect(instanceComponentId(document, projection.shapes[0] as InstanceShape)).toBe('family');
    expect(projection.problems.join()).toContain('missing or cyclic artwork');
    expect((document.shapes.button as InstanceShape).variantMode).toBe('auto');
});

it('inspects a local projection without saving its winning variant', () => {
    const document = responsiveVariantsDocument();
    document.shapes.button.selected = true;
    document.selectedShapes = [document.shapes.button];
    const projection = projectScreen(document, 'screen', document.frames.desktop)!;
    const before = JSON.stringify(document);
    const data = instanceProperties(
        document,
        Object.fromEntries(projection.shapes.map((shape) => [shape.id, shape]))
    )!;
    expect(data.selectedVariantId).toBe('__auto');
    expect(data.responsiveDescriptions.join()).toContain('800px');
    expect(data.rows[0].value).toBe('Continue');
    expect(JSON.stringify(document)).toBe(before);
});

it('keeps bound instance values and Theme independent of the responsive source', () => {
    const document = responsiveVariantsDocument();
    document.variables.caption = {
        id: 'caption',
        name: 'Caption',
        type: 'text',
        dimensionId: 'theme',
        values: { default: 'Day', dark: 'Night' }
    };
    (document.shapes.button as InstanceShape).overrides.label = { variableId: 'caption' };
    const before = JSON.stringify(document);
    for (const [id, value, fontSize] of [
        ['mobile', 'Night', 16],
        ['desktop', 'Day', 32]
    ] as const) {
        const projection = projectScreen(document, 'screen', document.frames[id])!;
        expect((projection.shapes[0] as InstanceShape).projectedSource!.shapes[0]).toMatchObject({
            value,
            fontSize
        });
    }
    expect(JSON.stringify(document)).toBe(before);
    const { store } = createTestStore();
    const clipboard = writeClipboard([document.shapes.button], [], document.variables, document);
    expect(store.actions.pasteShapes(clipboard)).toBe('pasted');
    const pasted = store.state.currentDocument;
    const instance = pasted.shapes[pasted.shapesIds[0]] as InstanceShape;
    expect(instance.variantMode).toBe('auto');
    expect(instance.overrides.label).toEqual({ variableId: pasted.variablesIds[0] });
    expect(pasted.components[instance.componentId].responsiveVariants).toEqual(
        document.components.family.responsiveVariants
    );
});

it('uses the owning Screen view width through nested screen-designated frames', () => {
    const document = responsiveVariantsDocument();
    document.frames.content.kind = 'screen';
    const projection = projectScreen(document, 'screen', document.frames.desktop)!;
    const button = projection.shapes[0] as InstanceShape;
    expect(instanceComponentId(document, button)).toBe('wide');
    expect(button.projectedSource?.variant?.explanation).toContain('800px');
});

it('keeps focused editing on the requested definition when Auto chooses an alternate', () => {
    const { store } = createTestStore();
    const source = responsiveVariantsDocument(store.state.currentDocumentId);
    (source.shapes['wide-text'] as Text).position = { x: 500, y: 300 };
    store.actions.addDocument(source);
    store.actions.selectShape('button');
    store.actions.events.setScreenView('desktop');
    store.actions.selectComponentSource('family');
    const placed = editableScreenView(store.state, store.state.events.pointer.screenView)!;
    expect(store.state.enteredComponentId).toBe('family');
    expect(placed.projection.shapes.map((shape) => shape.id)).toEqual(['base-text']);
    expect(placed.projection.shapes[0]).toMatchObject({ position: { x: 520 } });
    expect(placed.projection.shapes[0]).toMatchObject({ value: 'Default', fontSize: 16 });
    expect(store.state.currentDocument.shapes.button).toMatchObject({
        variantMode: 'auto',
        overrides: { label: 'Continue' }
    });
    store.actions.leaveComponentSource();
    const restored = editableScreenView(store.state, store.state.events.pointer.screenView)!;
    expect(
        instanceComponentId(
            store.state.currentDocument,
            restored.projection.shapes[0] as InstanceShape
        )
    ).toBe('wide');
});

it('uses the supplied viewport when projecting a resized view with an existing ID', () => {
    const document = responsiveVariantsDocument();
    const projection = projectScreen(document, 'screen', {
        ...document.frames.mobile,
        size: { width: 800, height: 300 }
    })!;
    expect(instanceComponentId(document, projection.shapes[0] as InstanceShape)).toBe('wide');
    expect(document.frames.mobile.size.width).toBe(360);
});

it('publishes only rules whose alternate is in the library snapshot', () => {
    const document = responsiveVariantsDocument();
    document.components.family.variantIds!.push('gone');
    document.components.family.responsiveVariants!.rules.push({ minWidth: 900, variantId: 'gone' });
    const family = librarySnapshot(document, 'family', { components: {} })!.find(
        (component) => component.id === 'family'
    )!;
    expect(family.variantIds).toEqual(['wide']);
    expect(family.responsiveVariants).toEqual({
        source: 'screen',
        rules: [{ minWidth: 600, variantId: 'wide' }]
    });
    expect(document.components.family.responsiveVariants!.rules).toHaveLength(2);
});

it('detaches the variant that Auto draws, with the instance values', () => {
    const detached = (auto: boolean) => {
        const { store } = createTestStore();
        const seed = responsiveVariantsDocument(store.state.currentDocumentId);
        // Show the 800px screen on the canvas, where the rule picks Button Wide.
        delete seed.frames.screen.definitionOnly;
        if (!auto) {
            (seed.shapes.button as InstanceShape).variantMode = undefined;
        }
        store.actions.addDocument(seed);
        const document = store.state.currentDocument;
        const before = new Set(Object.keys(document.shapes));
        store.actions.detachInstances(['button']);

        return Object.values(json(document.shapes))
            .filter((shape) => !before.has(shape.id))
            .map((shape) => [(shape as Text).value, (shape as Text).fontSize]);
    };

    expect(detached(true)).toEqual([['Continue', 32]]);
    expect(detached(false)).toEqual([['Continue', 16]]);
});

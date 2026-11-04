import { createCopies, edit, settle, shownDocument, DOCUMENT_ID } from './support/collaboration';
import { v4 as newId } from 'uuid';
import { buildInspectorTypography } from 'src/templates/inspectorTypography';
import { createDocument } from 'src/app/factories';
import {
    readInteractions,
    serializePersistedState,
    restoreDocuments,
    migratePersistedState
} from 'src/app/services/documentStorage';
import { projectPreview } from 'src/preview/project';
import { readPreview } from 'src/preview/protocol';

it('projects an editable typography example with validated local variants and preserves authored values', () => {
    const document = createDocument(buildInspectorTypography(newId));
    const before = JSON.stringify(document);
    const warnings: string[] = [];
    const drawing = readPreview(projectPreview(document, {}, warnings));
    expect(warnings).toEqual([]);
    expect(drawing.screens).toHaveLength(1);
    const target = drawing.screens[0].nodes.find((node) => node.variants)!;
    expect(Object.keys(target.variants!)).toHaveLength(4);
    const actions = drawing.screens[0].nodes.filter((node) => node.control?.changeVariant);
    expect(actions).toHaveLength(4);
    expect(actions.every((node) => node.control!.changeVariant!.key === target.variantKey)).toBe(
        true
    );
    expect(JSON.stringify(target.variants)).toContain('font-weight');
    expect(JSON.stringify(document)).toBe(before);
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    const restored = restoreDocuments(migratePersistedState(saved)!)[document.id];
    expect(readPreview(projectPreview(restored, {}))).toEqual(drawing);
});

it('rejects malformed authored actions and untrusted prototype targets', () => {
    expect(() =>
        readInteractions({ activate: { type: 'changeVariant', instanceId: 3, variantId: 'x' } })
    ).toThrow();
    const document = createDocument(buildInspectorTypography(newId));
    const drawing = projectPreview(document, {});
    const action = drawing.screens[0].nodes.find((node) => node.control?.changeVariant)!.control!
        .changeVariant!;
    action.variantId = 'missing';
    expect(() => readPreview(drawing)).toThrow('Unavailable variant action target');
});

it('keeps missing variant references durable and diagnoses them instead of breaking preview', () => {
    const document = createDocument(buildInspectorTypography(newId));
    const family = Object.values(document.components).find((component) => component.variantIds)!;
    delete document.components[family.variantIds![0]];
    const warnings: string[] = [];
    expect(() => readPreview(projectPreview(document, {}, warnings))).not.toThrow();
    expect(warnings.join(' ')).toContain('variant target is unavailable');
});

it('preserves explicit initial variants and compatible instance values in every alternative', () => {
    const document = createDocument(buildInspectorTypography(newId));
    const target = Object.values(document.shapes).find(
        (shape) => shape.name === 'Inspector comparison'
    );
    if (target?.type !== 'instance') {
        throw new Error('Missing target');
    }
    target.variantId = document.components[target.componentId].variantIds![1];
    target.overrides.placeholder = 'Keep my value';
    const drawing = readPreview(projectPreview(document, {}));
    const node = drawing.screens[0].nodes.find((item) => item.variantKey)!;
    expect(node.initialVariant).toBe(target.variantId);
    expect(
        Object.values(node.variants!).every((variant) =>
            JSON.stringify(variant).includes('Keep my value')
        )
    ).toBe(true);
    expect(target.variantId).toBe(node.initialVariant);
});

it('guards authored action edits and keeps them undoable', async () => {
    const copies = await createCopies(2, (store) => {
        const document = createDocument(buildInspectorTypography(newId));
        document.id = DOCUMENT_ID;
        store.actions.addDocument(document);
    });
    const [a, b] = copies;
    const store = a.store;
    const document = shownDocument(a);
    const button = Object.values(document.shapes).find(
        (shape) => shape.type === 'instance' && shape.name === 'Sentence · Regular'
    );
    const target = Object.values(document.shapes).find(
        (shape) => shape.name === 'Inspector comparison'
    );
    if (button?.type !== 'instance' || target?.type !== 'instance') {
        throw new Error('Invalid fixture');
    }
    const original = JSON.stringify(button.interactions);
    store.actions.editInteractions({
        target: 'instance',
        id: button.id,
        settings: {
            activate: { type: 'changeVariant', instanceId: target.id, variantId: 'missing' }
        }
    });
    expect(JSON.stringify(button.interactions)).toBe(original);
    store.actions.editInteractions({
        target: 'instance',
        id: button.id,
        settings: { activate: null }
    });
    expect(button.interactions?.activate).toBeNull();
    edit(a, () => {});
    settle(copies);
    expect(JSON.stringify(shownDocument(b).shapes[button.id])).toContain('"activate":null');
    a.collaboration.undo(document.id);
    settle(copies);
    expect(JSON.stringify(shownDocument(a).shapes[button.id])).toContain('changeVariant');
    expect(JSON.stringify(shownDocument(b).shapes[button.id])).toContain('changeVariant');
    copies.forEach((copy) => copy.collaboration.dispose());
});

it('keeps compatible input identities stable when switching a target variant', () => {
    const document = createDocument(buildInspectorTypography(newId));
    const family = Object.values(document.components).find((component) => component.variantIds)!;
    family.interaction = { role: 'input', props: { label: 'placeholder', value: 'placeholder' } };
    const drawing = readPreview(projectPreview(document, {}));
    const target = drawing.screens[0].nodes.find((node) => node.variantKey)!;
    expect(target.control?.stateKey).toBeTruthy();
    expect(Object.values(target.variants!).map((node) => node.control?.stateKey)).toEqual(
        Array(4).fill(target.control?.stateKey)
    );
});

it('does not project unused broken family variants', () => {
    const document = createDocument(buildInspectorTypography(newId));
    const family = Object.values(document.components).find((component) => component.variantIds)!;
    document.components.unused = {
        ...family,
        id: 'unused',
        name: 'Unfinished variant',
        variantIds: undefined,
        shapesIds: ['missing']
    };
    family.variantIds!.push('unused');
    expect(() => readPreview(projectPreview(document, {}))).not.toThrow();
});

it('does not restore duplicate input identities through variant alternatives', () => {
    const document = createDocument(buildInspectorTypography(newId));
    const target = Object.values(document.shapes).find(
        (shape) => shape.name === 'Inspector comparison'
    );
    if (target?.type !== 'instance') {
        throw new Error('Missing target');
    }
    target.interaction = {
        role: 'input',
        controlId: 'shared-input',
        props: { label: 'placeholder', value: 'placeholder' }
    };
    document.shapes.duplicate = { ...target, id: 'duplicate', name: 'Duplicate input' };
    document.shapesIds.push('duplicate');
    const warnings: string[] = [];
    const drawing = readPreview(projectPreview(document, {}, warnings));
    const node = drawing.screens[0].nodes.find((item) => item.variantKey)!;
    expect(warnings.join(' ')).toContain('Duplicate input identity');
    expect(node.control?.stateKey).toBeUndefined();
    expect(
        Object.values(node.variants!).every((variant) => variant.control?.stateKey === undefined)
    ).toBe(true);
});

it('excludes targets in another layout from authoring and rejects those action edits', async () => {
    const { variantTargets } = await import('src/app/interactiveVariants');
    const { createTestStore } = await import('./support/store');
    const { store } = createTestStore();
    const document = createDocument(buildInspectorTypography(newId));
    document.id = store.state.currentDocumentId;
    const target = Object.values(document.shapes).find(
        (shape) => shape.type === 'instance' && shape.name === 'Inspector comparison'
    );
    const button = Object.values(document.shapes).find(
        (shape) => shape.type === 'instance' && shape.name === 'Sentence · Regular'
    );
    if (target?.type !== 'instance' || button?.type !== 'instance' || !target.parentFrameId) {
        throw new Error('Invalid fixture');
    }
    const screenId = target.parentFrameId;
    document.frames.alternate = {
        ...document.frames[screenId],
        id: 'alternate',
        kind: 'frame',
        definitionOnly: undefined,
        parentFrameId: screenId,
        screenLayout: true
    };
    target.parentFrameId = 'alternate';
    expect(variantTargets(document, screenId, screenId)).toEqual([]);
    expect(variantTargets(document, screenId, 'alternate').map((shape) => shape.id)).toEqual([
        target.id
    ]);
    store.actions.addDocument(document);
    const before = JSON.stringify(store.state.currentDocument.shapes[button.id]);
    store.actions.editInteractions({
        target: 'instance',
        id: button.id,
        settings: {
            activate: {
                type: 'changeVariant',
                instanceId: target.id,
                variantId: target.componentId
            }
        }
    });
    expect(JSON.stringify(store.state.currentDocument.shapes[button.id])).toBe(before);
});

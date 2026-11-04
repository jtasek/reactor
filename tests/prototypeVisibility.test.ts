import { v4 as newId } from 'uuid';
import { createDocument } from 'src/app/factories';
import { buildInspectorTypography } from 'src/templates/inspectorTypography';
import {
    readEntity,
    readInteractions,
    serializePersistedState,
    restoreDocuments,
    migratePersistedState
} from 'src/app/services/documentStorage';
import { projectPreview, createArtworkProjector } from 'src/preview/project';
import { readPreview } from 'src/preview/protocol';
import { createCopies, edit, settle, shownDocument, DOCUMENT_ID } from './support/collaboration';
import { createTestStore } from './support/store';
import type { Document, InstanceShape } from 'src/app/types';

function help(document: Document) {
    return Object.values(document.shapes).find(
        (shape): shape is InstanceShape =>
            shape.type === 'instance' && shape.name === 'Inspector help'
    )!;
}

it('persists the boolean default without hiding canvas/export artwork or mutating the document', () => {
    const document = createDocument(buildInspectorTypography(newId));
    const target = help(document);
    const before = JSON.stringify(document);
    const drawing = readPreview(projectPreview(document, {}));
    const node = drawing.screens[0].nodes.find((node) => node.visibility?.initial === false)!;
    expect(node.visibility).toBeDefined();
    expect(
        drawing.screens[0].nodes.find((node) => node.control?.toggleVisibility)?.control
            ?.toggleVisibility
    ).toBe(node.visibility!.key);
    expect(target.visible).toBe(true);
    const exported = createArtworkProjector(document).draw(
        target,
        'export',
        new Set(),
        {},
        target.parentFrameId!
    );
    expect(exported.visibility).toBeUndefined();
    expect(exported.children!.length).toBeGreaterThan(0);
    expect(JSON.stringify(document)).toBe(before);
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    const restored = restoreDocuments(migratePersistedState(saved)!)[document.id];
    expect(help(restored).prototypeVisible).toBe(false);
    expect(readPreview(projectPreview(restored, {}))).toEqual(drawing);
});

it('rejects malformed state and untrusted action targets while retaining stale document references', () => {
    const document = createDocument(buildInspectorTypography(newId));
    const target = help(document);
    expect(() => readEntity('shapes', { ...target, prototypeVisible: 'false' })).toThrow();
    expect(() =>
        readInteractions({ activate: { type: 'toggleVisibility', instanceId: 123 } })
    ).toThrow();
    const drawing = projectPreview(document, {});
    const action = drawing.screens[0].nodes.find((node) => node.control?.toggleVisibility)!;
    action.control!.toggleVisibility = 'missing';
    expect(() => readPreview(drawing)).toThrow('Unavailable visibility target');
    delete document.shapes[target.id];
    document.shapesIds = document.shapesIds.filter((id) => id !== target.id);
    const warnings: string[] = [];
    expect(() => readPreview(projectPreview(document, {}, warnings))).not.toThrow();
    expect(warnings.join(' ')).toContain('visibility target is unavailable');
    expect(
        Object.values(document.shapes).some(
            (shape) =>
                shape.type === 'instance' &&
                shape.interactions?.activate?.type === 'toggleVisibility'
        )
    ).toBe(true);
});

it('shares authored defaults, undoes them, and rejects changes to locked or missing targets', async () => {
    const copies = await createCopies(2, (store) => {
        const document = createDocument(buildInspectorTypography(newId));
        document.id = DOCUMENT_ID;
        store.actions.addDocument(document);
    });
    const [a, b] = copies;
    const target = help(shownDocument(a));
    edit(a, (actions) =>
        actions.editInteractions({ target: 'visibility', instanceId: target.id, visible: true })
    );
    settle(copies);
    expect(help(shownDocument(b)).prototypeVisible).toBeUndefined();
    a.collaboration.undo(DOCUMENT_ID);
    settle(copies);
    expect(help(shownDocument(b)).prototypeVisible).toBe(false);
    copies.forEach((copy) => copy.collaboration.dispose());
    const { store } = createTestStore();
    const document = createDocument(buildInspectorTypography(newId));
    document.id = store.state.currentDocumentId;
    help(document).locked = true;
    store.actions.addDocument(document);
    store.actions.editInteractions({
        target: 'visibility',
        instanceId: help(document).id,
        visible: true
    });
    expect(help(store.state.currentDocument).prototypeVisible).toBe(false);
    expect(() =>
        store.actions.editInteractions({
            target: 'visibility',
            instanceId: 'missing',
            visible: false
        })
    ).not.toThrow();
});

it('pairs cloned and pasted toggle actions with their own targets and retains the hidden default', () => {
    const { store } = createTestStore();
    const document = createDocument(buildInspectorTypography(newId));
    document.id = store.state.currentDocumentId;
    store.actions.addDocument(document);
    const doc = store.state.currentDocument;
    const target = help(doc);
    const button = Object.values(doc.shapes).find(
        (shape): shape is InstanceShape =>
            shape.type === 'instance' && shape.interactions?.activate?.type === 'toggleVisibility'
    )!;
    const before = new Set(doc.shapesIds);
    store.actions.cloneShapes([target.id, button.id]);
    const clones = doc.shapesIds
        .filter((id) => !before.has(id))
        .map((id) => doc.shapes[id] as InstanceShape);
    const clonedButton = clones.find(
        (shape) => shape.interactions?.activate?.type === 'toggleVisibility'
    )!;
    const clonedTarget = clones.find((shape) => shape !== clonedButton)!;
    expect(clonedButton.interactions!.activate).toEqual({
        type: 'toggleVisibility',
        instanceId: clonedTarget.id
    });
    expect(clonedTarget.prototypeVisible).toBe(false);
    const screenId = target.parentFrameId!;
    store.actions.editFrame({ kind: 'select', id: screenId });
    expect(store.actions.pasteShapes(store.actions.copySelection()!)).toBe('pasted');
    const warnings: string[] = [];
    expect(() => readPreview(projectPreview(doc, {}, warnings))).not.toThrow();
    expect(warnings).toEqual([]);
});

import { v4 as newId } from 'uuid';
import { buildStarterTemplate } from 'src/templates/build';
import { STARTER_TEMPLATES } from 'src/templates/catalog';
import { createDocument } from 'src/app/factories';
import {
    serializePersistedState,
    restoreDocuments,
    migratePersistedState
} from 'src/app/services/documentStorage';
import { projectPreview } from 'src/preview/project';
import { createTestStore } from './support/store';

const EMPTY_STATES = {
    'list-detail': 'No projects yet',
    forms: 'No requests yet',
    'sign-in': 'No projects yet',
    settings: 'No connected accounts'
} as const;

it.each(STARTER_TEMPLATES)('keeps $name screens and native controls after saving', ({ id }) => {
    const document = createDocument(buildStarterTemplate(id, newId));
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    const restored = restoreDocuments(migratePersistedState(saved)!)[document.id];
    expect(Object.keys(restored.shapes)).toHaveLength(Object.keys(document.shapes).length);
    expect(Object.values(restored.frames).filter((frame) => frame.kind === 'view')).toHaveLength(3);
    expect(Object.values(restored.frames).filter((frame) => frame.definitionOnly)).toHaveLength(3);
    const warnings: string[] = [];
    const preview = projectPreview(restored, {}, warnings);
    expect(preview.screens).toHaveLength(3);
    expect(warnings).toEqual([]);
    const destinations = Object.values(restored.shapes).flatMap((shape) =>
        shape.type === 'instance' && shape.interactions?.activate
            ? [shape.interactions.activate.screenId]
            : []
    );
    expect(destinations.length).toBeGreaterThan(2);
    expect(
        destinations.every((destination) => restored.frames[destination]?.kind === 'screen')
    ).toBe(true);
    expect(JSON.stringify(preview)).toContain('button');
    expect(
        Object.values(restored.shapes).some(
            (shape) => shape.type === 'text' && shape.value === EMPTY_STATES[id]
        )
    ).toBe(true);
    const controls = JSON.stringify(preview);
    const fields = Object.values(restored.shapes).filter(
        (shape) =>
            shape.type === 'instance' &&
            restored.components[shape.componentId]?.name === 'Text field'
    );
    // Fields show a hint, not their label a second time.
    fields.forEach((field) => {
        const { label, placeholder } = field.type === 'instance' ? field.overrides : {};
        expect(placeholder).toBeTruthy();
        expect(placeholder).not.toBe(label);
        expect(controls).toContain(`"placeholder":"${placeholder}"`);
    });
    expect(restored.camera.scale).toBeLessThan(1);
    expect(restored.dimensions).toEqual({});
});

it('creates independent documents with access and leaves existing artwork alone', async () => {
    const { store } = createTestStore();
    await store.onInitialize();
    const originalId = store.state.currentDocumentId;
    const first = buildStarterTemplate('forms', newId);
    const second = buildStarterTemplate('forms', newId);
    store.actions.newDocumentFromTemplate(first);
    const firstId = store.state.currentDocumentId;
    store.actions.newDocumentFromTemplate(second);
    expect(store.state.currentDocumentId).not.toBe(firstId);
    expect(store.state.documents[originalId]).toBeDefined();
    expect(store.state.documentAccess[firstId]).toEqual({ role: 'admin' });
    expect(Object.keys(first.shapes).some((id) => id in second.shapes)).toBe(false);
    expect(Object.keys(first.frames).some((id) => id in second.frames)).toBe(false);
});

it('numbers repeated starters like new documents', async () => {
    const { store } = createTestStore();
    await store.onInitialize();
    store.actions.newDocumentFromTemplate(buildStarterTemplate('forms', newId));
    store.actions.newDocumentFromTemplate(buildStarterTemplate('forms', newId));
    store.actions.newDocumentFromTemplate(buildStarterTemplate('forms', newId));
    const names = Object.values(store.state.documents).map(({ name }) => name);
    expect(names).toEqual(
        expect.arrayContaining(['Forms starter', 'Forms starter 2', 'Forms starter 3'])
    );
});

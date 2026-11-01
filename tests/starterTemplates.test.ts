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
    expect(JSON.stringify(preview)).toContain('No ');
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

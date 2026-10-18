import { isReadOnly, canDeleteDocument } from 'src/app/documentAccess';
import { initialDocumentAccess } from 'src/app/services/serverSync';
import { takesEditorInput } from 'src/events/input';
import { createTestStore } from './support/store';

it('keeps cached viewers and unconfirmed server documents read-only, but allows offline local work', () => {
    const record = { unsent: ['local'], deleting: [] };
    const access = initialDocumentAccess(['viewer', 'unknown', 'local'], record, {
        viewer: { workspaceId: 'shared', role: 'viewer' },
        unknown: { role: 'invalid' }
    });
    expect(access).toEqual({
        viewer: { workspaceId: 'shared', role: 'viewer' },
        unknown: { role: 'unknown' },
        local: { role: 'admin' }
    });
    expect(initialDocumentAccess(['viewer'], undefined, access).viewer.role).toBe('viewer');
    expect(initialDocumentAccess(['local'], undefined, null)).toEqual({ local: { role: 'admin' } });
});

it.each(['viewer', 'unknown'] as const)(
    'blocks %s shortcuts, metadata edits and document deletion without locking shared data',
    (role) => {
        const { store } = createTestStore();
        const id = store.state.currentDocumentId;
        const name = store.state.currentDocument.name;
        store.actions.setDocumentAccess({ [id]: { workspaceId: 'shared', role } });
        expect(isReadOnly(store.state)).toBe(true);
        expect(takesEditorInput(store.state)).toBe(false);
        store.actions.updateDocument({ id, name: 'Changed' });
        store.actions.trashDocument(id);
        store.actions.purgeDeletedDocuments();
        expect(store.state.documents[id].name).toBe(name);
        expect(store.state.documents[id].deleted).toBeUndefined();
        expect(store.state.documents[id].locked).toBe(false);
        store.actions.newDocument();
        expect(isReadOnly(store.state)).toBe(false);
    }
);

it('allows invited editors to edit but reserves document deletion for admins', () => {
    const { store } = createTestStore();
    const id = store.state.currentDocumentId;
    store.actions.setDocumentAccess({ [id]: { workspaceId: 'shared', role: 'editor' } });
    expect(isReadOnly(store.state)).toBe(false);
    expect(canDeleteDocument(store.state, id)).toBe(false);
    store.actions.updateDocument({ id, name: 'Edited' });
    expect(store.state.currentDocument.name).toBe('Edited');
    store.actions.trashDocument(id);
    expect(store.state.documents[id].deleted).toBeUndefined();
});

it('keeps newly arrived account documents read-only until permissions arrive, while local new documents and copies remain editable', async () => {
    const { store } = createTestStore(
        {},
        {
            accounts: {
                session: async () => ({ id: 'account', name: 'Ada', email: 'ada@example.com' }),
                signIn: async () => ({ ok: true }),
                signUp: async () => ({ ok: true }),
                sendSignInLink: async () => ({ ok: true }),
                signOut: async () => ({ ok: true })
            }
        }
    );
    await store.onInitialize();
    store.actions.addDocument({ id: 'arrived', name: 'Shared drawing' });
    expect(isReadOnly(store.state, 'arrived')).toBe(true);
    expect(canDeleteDocument(store.state, 'arrived')).toBe(false);
    store.actions.updateDocument({ id: 'arrived', name: 'Changed' });
    store.actions.trashDocument('arrived');
    expect(store.state.documents.arrived.name).toBe('Shared drawing');
    expect(store.state.documents.arrived.deleted).toBeUndefined();
    store.actions.openDocument('arrived');
    expect(takesEditorInput(store.state)).toBe(false);
    store.actions.cloneDocument('arrived');
    const copy = Object.values(store.state.documents).find(
        ({ name }) => name === 'Shared drawing copy'
    )!;
    expect(isReadOnly(store.state, copy.id)).toBe(false);
    expect(canDeleteDocument(store.state, copy.id)).toBe(true);
    store.actions.newDocument();
    expect(isReadOnly(store.state)).toBe(false);
});

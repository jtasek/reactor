import {
    createDocument,
    createShape,
    createGroup,
    createComponent,
    createLink
} from '../factories';
import {
    SCHEMA_VERSION,
    migratePersistedState,
    serializePersistedState,
    restoreDocuments
} from '../services/documentStorage';

const fixture = () => {
    const document = createDocument({ id: 'd' });
    const shape = createShape({ type: 'rectangle', size: { width: 10, height: 20 } });

    document.shapes[shape.id] = shape;

    return serializePersistedState({ currentDocumentId: 'd', documents: { d: document } });
};

describe('document storage', () => {
    it('round-trips durable fields through JSON and rebuilds runtime dates', () => {
        const saved = fixture();
        const migrated = migratePersistedState(JSON.parse(JSON.stringify(saved)));
        const document = restoreDocuments(saved).d;

        expect(migrated).toEqual(saved);
        expect(document.created).toBeInstanceOf(Date);
        expect(document.shapes[Object.keys(document.shapes)[0]].created).toBeInstanceOf(Date);
        expect(saved.documents.d).not.toHaveProperty('shapesIds');
        expect(saved.documents.d).not.toHaveProperty('selectedShapes');
        expect(Object.values(saved.documents.d.shapes)[0]).not.toHaveProperty('selected');
    });

    it('migrates version 1 keys and discards serialized derived indexes', () => {
        const saved = fixture();
        const raw = {
            version: 1,
            currentDocumentId: 'document-1',
            documents: { 'document-1': { ...saved.documents.d, shapesIds: ['stale'] } }
        };

        const migrated = migratePersistedState(raw);

        expect(migrated?.version).toBe(SCHEMA_VERSION);
        expect(migrated?.currentDocumentId).toBe('d');
        expect(migrated?.documents.d).not.toHaveProperty('shapesIds');
    });

    it.each([
        null,
        undefined,
        'reactor',
        [],
        {},
        { version: 1, currentDocumentId: 'd', documents: { d: { id: 'd' } } }
    ])('rejects malformed data: %j', (value) => {
        expect(migratePersistedState(value)).toBeNull();
    });

    it.each([-1, 0, 1.5, SCHEMA_VERSION + 1])(
        'rejects unsupported schema version %s',
        (version) => {
            expect(migratePersistedState({ ...fixture(), version })).toBeNull();
        }
    );

    it.each([0, -1, NaN, Infinity])('rejects invalid camera scale %s', (scale) => {
        const saved = fixture();

        saved.documents.d.camera.scale = scale;

        expect(migratePersistedState(saved)).toBeNull();
    });

    it('rejects invalid dates, geometry, and table identity', () => {
        const saved = fixture();

        saved.documents.d.created = 'invalid';

        expect(migratePersistedState(saved)).toBeNull();

        const geometry = fixture();

        Object.values(geometry.documents.d.shapes)[0].size = { width: -1, height: 10 };

        expect(migratePersistedState(geometry)).toBeNull();

        const identity = fixture();

        identity.documents.d.id = 'different';

        expect(migratePersistedState(identity)).toBeNull();
    });

    it('chooses a valid document when the current document is missing', () => {
        expect(
            migratePersistedState({ ...fixture(), currentDocumentId: 'missing' })?.currentDocumentId
        ).toBe('d');
        expect(
            migratePersistedState({
                version: SCHEMA_VERSION,
                currentDocumentId: 'd',
                documents: {}
            })
        ).toBeNull();
    });

    it('rejects dangling memberships and links', () => {
        const membership = fixture();

        membership.documents.d.groups.g = createGroup({ id: 'g', shapesIds: ['missing'] });

        expect(migratePersistedState(membership)).toBeNull();

        const links = fixture();

        links.documents.d.links.l = createLink({ id: 'l', source: 'missing' });

        expect(migratePersistedState(links)).toBeNull();
    });

    it('rejects dangling shape and component parents', () => {
        const shapeParent = fixture();

        Object.values(shapeParent.documents.d.shapes)[0].parentShapeId = 'missing';

        expect(migratePersistedState(shapeParent)).toBeNull();

        const componentParent = fixture();

        componentParent.documents.d.components.c = createComponent({
            id: 'c',
            parentId: 'missing'
        });

        expect(migratePersistedState(componentParent)).toBeNull();
    });

    it('rejects duplicate migrated document IDs and unsafe entity IDs', () => {
        const saved = fixture();

        expect(
            migratePersistedState({
                ...saved,
                version: 1,
                documents: { one: saved.documents.d, two: saved.documents.d }
            })
        ).toBeNull();

        saved.documents.d.id = '__proto__';

        expect(migratePersistedState(saved)).toBeNull();
    });
});

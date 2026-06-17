import {
    createApplication,
    createDocument,
    createGroup,
    createLayer,
    createLink,
    createRuler,
    createShape,
    getAnonymousUser,
    getCurrentUserName,
    getDefaultType,
    newApplicationName,
    newDocumentName,
    newGroupName,
    newLayerName,
    newLinkName,
    newRulerName,
    newShapeName
} from '../factories';

describe('factories', () => {
    describe('newApplicationName()', () => {
        it('returns new application instance name', () => {
            const actual = newApplicationName();

            expect(actual).toContain('reactor-');
        });
    });

    describe('newDocumentName()', () => {
        it('returns new document name', () => {
            const actual = newDocumentName();

            expect(actual).toBe('document-1');
        });
    });

    describe('newGroupName()', () => {
        it('returns new group name', () => {
            const actual = newGroupName();

            expect(actual).toBe('group-1');
        });
    });

    describe('newLayerName()', () => {
        it('returns new layer name', () => {
            const actual = newLayerName();

            expect(actual).toBe('layer-1');
        });
    });

    describe('newLinkName()', () => {
        it('returns new link name', () => {
            const actual = newLinkName();

            expect(actual).toBe('link-1');
        });
    });

    describe('newRulerName()', () => {
        it('returns new ruler name', () => {
            const actual = newRulerName();

            expect(actual).toBe('ruler-1');
        });
    });

    describe('newShapeName()', () => {
        it('returns new shape name', () => {
            const actual = newShapeName();

            expect(actual).toBe('shape-1');
        });
    });

    describe('getAnonymousUser()', () => {
        it('returns user object with default values', () => {
            const actual = getAnonymousUser();

            expect(actual).toEqual(
                expect.objectContaining({
                    id: '1',
                    isAuthenticated: true,
                    name: 'Anonymous'
                })
            );
        });
    });

    describe('getCurrentUserName()', () => {
        it('returns current user name', () => {
            const actual = getCurrentUserName();

            expect(actual).toBe('anonymous');
        });
    });

    describe('getDefaultType()', () => {
        it('returns default type', () => {
            const actual = getDefaultType();

            expect(actual).toBe('rectangle');
        });
    });

    describe('createShape()', () => {
        it('creates new shape object with default values', () => {
            const actual = createShape({ name: 'SHAPE_NAME' });

            expect(actual).toHaveProperty('name', 'SHAPE_NAME');
        });
    });

    describe('createLink()', () => {
        it('creates new link object with default values', () => {
            const actual = createLink({ name: 'LINK_NAME' });

            expect(actual).toHaveProperty('name', 'LINK_NAME');
        });
    });

    describe('createRuler()', () => {
        it('creates new ruler object with default values', () => {
            const actual = createRuler({ name: 'RULER_NAME' });

            expect(actual).toHaveProperty('name', 'RULER_NAME');
        });
    });

    describe('createGroup()', () => {
        it('creates new group object with default values', () => {
            const actual = createGroup({ name: 'GROUP_NAME' });

            expect(actual).toHaveProperty('name', 'GROUP_NAME');
        });
    });

    describe('createLayer()', () => {
        it('creates new layer object with default values', () => {
            const actual = createLayer({ name: 'LAYER_NAME' });

            expect(actual).toHaveProperty('name', 'LAYER_NAME');
        });
    });

    describe('createDocument()', () => {
        it('creates new document object with default values', () => {
            const actual = createDocument({ name: 'DOCUMENT_NAME' });

            expect(actual).toHaveProperty('name', 'DOCUMENT_NAME');
        });
    });

    describe('createApplication()', () => {
        it('creates new application object with default values', () => {
            const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1);
            const actual = createApplication();

            expect(actual).toHaveProperty('id', 'reactor-1');

            nowSpy.mockRestore();
        });
    });
});

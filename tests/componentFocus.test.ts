import { componentFocus } from 'src/app/explorerTree';
import { createTestStore } from './support/store';

function scene() {
    const { store } = createTestStore();
    const document = store.state.currentDocument;
    const shape = (name: string) => {
        store.actions.addShape({
            type: 'rectangle',
            name,
            position: { x: 0, y: 0 },
            size: { width: 40, height: 20 }
        });

        return document.shapesIds.at(-1)!;
    };
    const screen = (name: string) => {
        const id = store.actions.editFrame({
            kind: 'add',
            position: { x: 0, y: 0 },
            size: { width: 400, height: 300 }
        })!;

        store.actions.editFrame({ kind: 'update', id, changes: { name, kind: 'screen' } });

        return id;
    };
    const instance = (componentId: string, parentFrameId?: string) => {
        store.actions.addShape({
            type: 'instance',
            componentId,
            parentFrameId,
            position: { x: 0, y: 0 },
            overrides: {}
        });

        return document.shapesIds.at(-1)!;
    };

    store.actions.addComponent({ id: 'button', name: 'Button', shapesIds: [shape('Label')] });
    store.actions.addComponent({ id: 'pressed', name: 'Pressed', shapesIds: [shape('Label')] });

    return { store, document, screen, instance };
}

describe('component focus in the Explorer', () => {
    it('lists where instances of the component are placed, screens first', () => {
        const { store, document, screen, instance } = scene();
        const projects = screen('Projects');
        const details = screen('Details');
        const first = instance('button', projects);
        const second = instance('button', projects);
        const third = instance('button', details);
        const loose = instance('button');
        const nested = instance('button');

        store.actions.addComponent({ id: 'card', name: 'Card', shapesIds: [nested] });
        instance('card', projects);

        expect(componentFocus(document, 'button')).toEqual({
            variants: [],
            usedIn: [
                { kind: 'screen', id: details, name: 'Details', instanceIds: [third] },
                { kind: 'screen', id: projects, name: 'Projects', instanceIds: [first, second] },
                { kind: 'component', id: 'card', name: 'Card', instanceIds: [nested] },
                { kind: 'canvas', name: 'Canvas', instanceIds: [loose] }
            ]
        });
    });

    it('shows the whole variant family and counts instances of any of its variants', () => {
        const { store, document, screen, instance } = scene();
        const projects = screen('Projects');

        store.actions.addComponentVariant({ componentId: 'button', variantId: 'pressed' });
        const placed = instance('button', projects);
        const alternate = instance('pressed', projects);
        const family = {
            variants: [
                { id: 'button', name: 'Button', editable: true },
                { id: 'pressed', name: 'Pressed', editable: true }
            ],
            usedIn: [
                {
                    kind: 'screen',
                    id: projects,
                    name: 'Projects',
                    instanceIds: [placed, alternate]
                }
            ]
        };

        expect(componentFocus(document, 'button')).toEqual(family);
        expect(componentFocus(document, 'pressed')).toEqual(family);
    });

    it('is empty for an unused component and absent for a missing one', () => {
        const { document } = scene();

        expect(componentFocus(document, 'pressed')).toEqual({ variants: [], usedIn: [] });
        expect(componentFocus(document, 'missing')).toBeNull();
    });
});

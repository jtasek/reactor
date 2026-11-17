import { projectPreview } from 'src/preview/project';
import { readPreview, type PreviewNode } from 'src/shared/previewProtocol';
import { evaluateCondition, type Condition } from 'src/shared/conditions';
import { readEntity } from 'src/app/services/documentStorage';
import { projectFlow, reachableScreens } from 'src/app/flowProjection';
import { effectText, flowMachine, guardText } from 'src/app/flowMachine';
import { pasteStates } from 'src/app/clipboard';
import { createDocument } from 'src/app/factories';
import { stateEquals } from 'src/app/prototypeState';
import type { Document, InstanceShape } from 'src/app/types';
import { previewFixture } from './support/preview';
import { createTestStore } from './support/store';

/** The preview fixture with a Value property on the input, a tab state and a count. */
function fixture() {
    const document = previewFixture();
    document.components.input.props!.push({
        id: 'value',
        shapeId: 'field',
        key: 'text',
        label: 'Value'
    });
    document.components.input.interaction!.props.value = 'value';
    document.prototypeBooleans = {
        tab: { id: 'tab', name: 'Tab', type: 'text', initial: 'Profile' },
        count: { id: 'count', name: 'Count', type: 'number', initial: 1 },
        open: { id: 'open', name: 'Open', initial: false }
    };

    return document;
}

function storeWith(document: Document) {
    const { store } = createTestStore();
    document.id = store.state.currentDocumentId;
    store.actions.addDocument(document);
    const shape = (id: string) => store.state.currentDocument.shapes[id] as InstanceShape;

    return { store, actions: store.actions, shape };
}

const allNodes = (nodes: PreviewNode[]): PreviewNode[] =>
    nodes.flatMap((node) => [node, ...allNodes(node.children ?? [])]);

/** The store's document with its arrays and records, free to change outside actions. */
const plain = (document: Document): Document => JSON.parse(JSON.stringify(document));

const tabIs = (value: string): Condition => stateEquals('tab', value);

describe('named text and number states', () => {
    it('adds typed states, keeps a state’s type and refuses values of another type', () => {
        const { store, actions } = storeWith(fixture());
        expect(
            actions.editInteractions({
                target: 'state',
                kind: 'add',
                name: 'Query',
                type: 'text',
                initial: ''
            })
        ).toBeUndefined();
        const query = Object.values(store.state.currentDocument.prototypeBooleans).find(
            (value) => value.name === 'Query'
        )!;
        expect(query).toMatchObject({ type: 'text', initial: '' });
        expect(
            actions.editInteractions({
                target: 'state',
                kind: 'update',
                id: 'count',
                name: 'Count',
                initial: 'three'
            })
        ).toBe('Invalid number');
        expect(
            actions.editInteractions({
                target: 'state',
                kind: 'update',
                id: 'count',
                name: 'Count',
                initial: 3
            })
        ).toBeUndefined();
        expect(store.state.currentDocument.prototypeBooleans.count).toEqual({
            id: 'count',
            name: 'Count',
            type: 'number',
            initial: 3
        });
        expect(() =>
            readEntity('prototypeBooleans', { id: 'x', name: 'X', type: 'text', initial: 1 })
        ).toThrow();
        expect(() =>
            readEntity('prototypeBooleans', { id: 'x', name: 'X', type: 'date', initial: '' })
        ).toThrow();
    });

    it('sets, toggles and resets only what fits each state', () => {
        const { store, actions, shape } = storeWith(fixture());
        const act = (activate: object) =>
            actions.editInteractions({
                target: 'instance',
                id: 'next',
                settings: { activate: activate as never }
            });
        act({ type: 'state', change: 'set', stateId: 'tab', value: 'Billing' });
        expect(shape('next').interactions?.activate).toEqual({
            type: 'state',
            change: 'set',
            stateId: 'tab',
            value: 'Billing'
        });
        // A text state can't be switched, and a number state takes only numbers.
        act({ type: 'state', change: 'toggle', stateId: 'tab' });
        act({ type: 'state', change: 'set', stateId: 'count', value: '2' });
        expect(shape('next').interactions?.activate).toMatchObject({ value: 'Billing' });
        act({ type: 'state', change: 'reset', stateId: 'count' });
        expect(shape('next').interactions?.activate).toEqual({
            type: 'state',
            change: 'reset',
            stateId: 'count'
        });
        act({ type: 'state', change: 'set', stateId: 'count', value: 7 });
        const drawing = readPreview(projectPreview(store.state.currentDocument, {}));
        expect(drawing.states).toEqual({
            'state:tab': 'Profile',
            'state:count': 1,
            'state:open': false
        });
        expect(
            allNodes(drawing.screens[0].nodes).find((node) => node.control?.changeState)!.control!
                .changeState
        ).toEqual({ key: 'state:count', change: 'set', value: 7 });
    });

    it('shows an instance while a condition on a text or number state holds', () => {
        const { store, actions, shape } = storeWith(fixture());
        expect(
            actions.editInteractions({
                target: 'state',
                kind: 'show',
                instanceId: 'name',
                condition: tabIs('Billing')
            })
        ).toBeUndefined();
        expect(shape('name').prototypeVisibleWhen).toEqual(tabIs('Billing'));
        // A text state can't be less than a number, and form fields don't exist here.
        expect(
            actions.editInteractions({
                target: 'state',
                kind: 'show',
                instanceId: 'name',
                condition: {
                    kind: 'less',
                    left: { kind: 'state', stateId: 'tab' },
                    right: { kind: 'value', value: 3 }
                }
            })
        ).toBe('Only numbers can be less or greater.');
        expect(
            actions.editInteractions({
                target: 'state',
                kind: 'show',
                instanceId: 'name',
                condition: { kind: 'isSet', operand: { kind: 'field', fieldId: 'x' } }
            })
        ).toBe('This condition cannot be read.');
        expect(shape('name').prototypeVisibleWhen).toEqual(tabIs('Billing'));
        const drawing = readPreview(projectPreview(store.state.currentDocument, {}));
        const node = drawing.screens[0].nodes.find((item) => item.visibility?.condition)!;
        const condition = node.visibility!.condition!;
        expect(condition).toEqual(stateEquals('state:tab', 'Billing'));
        const shown = (tab: string) =>
            evaluateCondition(condition, (operand) =>
                operand.kind === 'state' && operand.stateId === 'state:tab' ? tab : undefined
            );
        expect([shown('Profile'), shown(' Billing ')]).toEqual([false, true]);
        // A yes/no binding is the same condition with true or false.
        actions.editInteractions({
            target: 'state',
            kind: 'bind',
            instanceId: 'name',
            stateId: 'tab'
        });
        expect(shape('name').prototypeVisibleWhen).toEqual(tabIs('Billing'));
        actions.editInteractions({
            target: 'state',
            kind: 'bind',
            instanceId: 'name',
            stateId: 'open',
            when: false
        });
        expect(shape('name').prototypeVisibleWhen).toEqual(stateEquals('open', false));
    });

    it('shows a state in a text property and lets a field write it', () => {
        const { store, actions, shape } = storeWith(fixture());
        const bind = (instanceId: string, propId: string, stateId: string | null) =>
            actions.editInteractions({
                target: 'state',
                kind: 'bindProperty',
                instanceId,
                propId,
                stateId
            });
        expect(bind('next', 'label', 'count')).toBeUndefined();
        expect(bind('name', 'value', 'open')).toContain('text or number state');
        expect(bind('name', 'value', 'tab')).toBeUndefined();
        expect(bind('name', 'missing', 'tab')).toBe('This property is no longer exposed.');
        expect(shape('name').stateBindings).toEqual({ value: 'tab' });
        const drawing = readPreview(projectPreview(store.state.currentDocument, {}));
        const nodes = allNodes(drawing.screens[0].nodes);
        expect(nodes.filter((node) => node.textState).map((node) => node.textState)).toEqual(
            expect.arrayContaining(['state:count', 'state:tab'])
        );
        expect(nodes.find((node) => node.control?.role === 'input')!.control!.valueState).toBe(
            'state:tab'
        );
        // The canvas keeps the authored text.
        expect(store.state.currentDocument.shapes.caption).toMatchObject({ value: 'Continue' });
        expect(bind('next', 'label', null)).toBeUndefined();
        expect(shape('next')).not.toHaveProperty('stateBindings');
        // A deleted state leaves the binding, and Preview shows the authored text.
        actions.editInteractions({ target: 'state', kind: 'delete', id: 'tab' });
        const warnings: string[] = [];
        const fallback = readPreview(projectPreview(store.state.currentDocument, {}, warnings));
        expect(allNodes(fallback.screens[0].nodes).some((node) => node.textState)).toBe(false);
        expect(warnings.join(' ')).toContain('shows a state that no longer exists');
    });

    it('refuses player state that does not fit its type', () => {
        const { store, actions } = storeWith(fixture());
        actions.editInteractions({
            target: 'state',
            kind: 'bindProperty',
            instanceId: 'name',
            propId: 'value',
            stateId: 'count'
        });
        const drawing = projectPreview(store.state.currentDocument, {});
        const input = allNodes(drawing.screens[0].nodes).find((node) => node.control?.valueState)!;
        expect(() => readPreview(drawing)).not.toThrow();
        input.control!.valueState = 'state:open';
        expect(() => readPreview(drawing)).toThrow('Unavailable prototype state');
        input.control!.valueState = 'state:count';
        input.control!.changeState = { key: 'state:tab', change: 'toggle' };
        expect(() => readPreview(drawing)).toThrow('Unavailable prototype state');
        delete input.control!.changeState;
        drawing.states!['state:tab'] = 'x'.repeat(1001);
        expect(() => readPreview(drawing)).toThrow('Invalid prototype state');
    });
});

describe('Flow with typed state', () => {
    it('describes text sets and resets, and reaches a control a set reveals', () => {
        const document = plain(storeWith(fixture()).store.state.currentDocument);
        document.shapes.next = {
            ...document.shapes.next,
            interactions: {
                activate: { type: 'state', change: 'set', stateId: 'tab', value: 'Billing' }
            }
        } as InstanceShape;
        // The field navigates on Enter, but only shows once Tab is Billing.
        const field = document.shapes.name as InstanceShape;
        field.interactions = { activate: { type: 'navigate', screenId: 'details' } };
        field.prototypeVisibleWhen = tabIs('Billing');
        const machine = flowMachine(document);
        const [setter, guarded] = machine.states[0].transitions.sort((a) =>
            a.instanceId === 'next' ? -1 : 1
        );
        expect(effectText(setter.effect)).toBe('sets Tab to “Billing”');
        expect(guardText(guarded.guard)).toBe('if Tab is “Billing”');
        expect(machine.states.find((state) => state.id === 'details')!.reachable).toBe(true);
        // Setting another value never shows it, so Details can't be reached.
        (document.shapes.next as InstanceShape).interactions = {
            activate: { type: 'state', change: 'set', stateId: 'tab', value: 'Profile' }
        };
        expect([...reachableScreens(projectFlow(document), 'home')]).toEqual(['home']);
        (document.shapes.next as InstanceShape).interactions = {
            activate: { type: 'state', change: 'reset', stateId: 'tab' }
        };
        expect(effectText(flowMachine(document).states[0].transitions[0].effect)).toMatch(
            /resets Tab|→ Details/
        );
    });

    it('treats a condition over several states as revealed once any of them changes', () => {
        const document = plain(storeWith(fixture()).store.state.currentDocument);
        const field = document.shapes.name as InstanceShape;
        field.interactions = { activate: { type: 'navigate', screenId: 'details' } };
        field.prototypeVisibleWhen = {
            kind: 'and',
            conditions: [tabIs('Billing'), stateEquals('open', true)]
        };
        // The button would go to Details itself; here it does nothing at first.
        (document.shapes.next as InstanceShape).interactions = { activate: null };
        expect([...reachableScreens(projectFlow(document), 'home')]).toEqual(['home']);
        (document.shapes.next as InstanceShape).interactions = {
            activate: { type: 'state', change: 'toggle', stateId: 'open' }
        };
        expect([...reachableScreens(projectFlow(document), 'home')]).toEqual(['home', 'details']);
    });
});

it('pastes a state whose name is taken by another type under a name of its own', () => {
    const target = createDocument({ id: 'target' });
    target.prototypeBooleans.other = { id: 'other', name: 'Tab', initial: false };
    const instance = { ...previewFixture().shapes.next } as InstanceShape;
    instance.prototypeVisibleWhen = tabIs('Billing');
    const added = pasteStates(
        {
            shapes: [instance],
            groups: [],
            variables: [],
            prototypeBooleans: [{ id: 'tab', name: 'Tab', type: 'text', initial: 'Profile' }]
        },
        target
    );
    expect(added).toEqual([{ id: 'tab', name: 'Tab 2', type: 'text', initial: 'Profile' }]);
    expect(instance.prototypeVisibleWhen).toEqual(tabIs('Billing'));
});

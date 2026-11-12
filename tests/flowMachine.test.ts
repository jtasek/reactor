import { v4 as newId } from 'uuid';
import { buildStarterTemplate } from 'src/templates/build';
import { STARTER_TEMPLATES } from 'src/templates/catalog';
import { createDocument } from 'src/app/factories';
import { effectText, flowMachine, guardText, sentence } from 'src/app/flowMachine';
import {
    FLOW,
    layoutFlow,
    offsetLayout,
    routeLinks,
    type FlowCard,
    type FlowLink
} from 'src/app/flowLayout';
import type { Document, InstanceShape } from 'src/app/types';
import { automaticLayoutsPrototype } from './support/automaticScreenLayouts';

/** The store derives these lists; a bare document needs them filled in. */
function live(document: Document) {
    document.groupsIds = Object.keys(document.groups);
    document.layersIds = Object.keys(document.layers);
    document.componentsIds = Object.keys(document.components);

    return document;
}

const template = (id: (typeof STARTER_TEMPLATES)[number]['id']) =>
    live(createDocument(buildStarterTemplate(id, newId)));
const fixture = () => live(automaticLayoutsPrototype());
const instance = (document: Document, id: string) => document.shapes[id] as InstanceShape;
const sentences = (document: Document) =>
    flowMachine(document).states.flatMap((state) => state.transitions.map(sentence));

/** Whether a straight piece of a link passes through the inside of a card. */
function crosses(link: FlowLink, card: FlowCard) {
    return link.points.slice(1).some((to, index) => {
        const from = link.points[index];

        return (
            Math.max(from.x, to.x) > card.x + 0.5 &&
            Math.min(from.x, to.x) < card.x + card.width - 0.5 &&
            Math.max(from.y, to.y) > card.y + 0.5 &&
            Math.min(from.y, to.y) < card.y + card.height - 0.5
        );
    });
}

describe('flowMachine', () => {
    it.each(STARTER_TEMPLATES)('reads the $name template with nothing to fix', ({ id }) => {
        const machine = flowMachine(template(id));
        expect(machine.initial).toBe(machine.states[0].id);
        expect(machine.states.every((state) => state.available && state.reachable)).toBe(true);
        expect(machine.problems).toEqual([]);
        expect(machine.notes).toEqual([]);
        for (const state of machine.states) {
            const keys = [...state.transitions, ...state.idle].map((control) => control.key);
            expect(new Set(keys).size).toBe(keys.length);
        }
    });

    it('says in plain words what each control does', () => {
        expect(sentences(template('list-detail'))).toEqual([
            'Website redesign → goes to Project details',
            'See empty state goes to Empty projects',
            'Back to projects goes to Projects',
            'Explore an example project goes to Project details'
        ]);
        expect(sentences(template('inspector-typography'))).toEqual([
            'Sentence · Medium changes Inspector comparison to Sentence · Medium',
            'Sentence · Regular changes Inspector comparison to Sentence · Regular',
            'Title · Semibold changes Inspector comparison to Title · Semibold',
            'Uppercase · Semibold changes Inspector comparison to Uppercase · Semibold',
            'About these styles shows or hides Inspector help'
        ]);
    });

    it('keeps controls without an action apart, to offer when adding a link', () => {
        const [, form] = flowMachine(template('forms')).states;
        expect(form.transitions.map((transition) => transition.control)).toEqual([
            'Preview confirmation'
        ]);
        expect(form.idle.map((control) => control.control)).toEqual([
            'Your name',
            'Email',
            'Request summary'
        ]);
    });

    it('marks an action that comes from the component, and one set on the control', () => {
        const document = fixture();
        expect(flowMachine(document).states[0].transitions[0]).toMatchObject({
            control: 'Continue button',
            inherited: true,
            effect: { kind: 'go', to: 'details', name: 'Details' }
        });
        instance(document, 'next').interactions = {
            activate: { type: 'navigate', screenId: 'home' }
        };
        expect(flowMachine(document).states[0].transitions[0]).toMatchObject({
            inherited: false,
            effect: { kind: 'go', to: 'home' }
        });
    });

    it('reads a named state as the effect and as the condition', () => {
        const document = fixture();
        document.prototypeBooleans = {
            help: { id: 'help', name: 'Help is open', initial: false }
        };
        instance(document, 'next').interactions = {
            activate: { type: 'setState', stateId: 'help', value: true }
        };
        const wide = instance(document, 'wide-next');
        wide.prototypeVisibilityStateId = 'help';
        wide.prototypeVisibilityWhen = true;
        const [setter, guarded] = flowMachine(document).states[0].transitions;
        expect(setter.effect).toEqual({ kind: 'setState', state: 'Help is open', value: true });
        expect(effectText(setter.effect)).toBe('turns Help is open on');
        expect(guarded.guard).toEqual({ kind: 'state', state: 'Help is open', when: true });
        expect(guardText(guarded.guard)).toBe('if Help is open is on');
        expect(sentence(guarded)).toBe('Wide continue goes to Details, if Help is open is on');
    });

    it('counts a link to a deleted screen as a problem', () => {
        const document = fixture();
        document.components.button.interactions = {
            activate: { type: 'navigate', screenId: 'deleted-screen' }
        };
        const machine = flowMachine(document);
        expect(machine.states[0].transitions[0].broken).toBe('The screen it goes to was deleted');
        expect(machine.problems.map((problem) => problem.key)).toEqual(['next', 'wide-next']);
        expect(machine.notes.map((note) => note.text)).toContain('Nothing leads to Details.');
    });

    it('leaves hidden controls out of what can be reached, as a note', () => {
        const document = fixture();
        document.shapes.next.visible = false;
        document.shapes['wide-next'].visible = false;
        const machine = flowMachine(document);
        expect(machine.states[0].transitions.map((transition) => transition.inactive)).toEqual([
            'hidden',
            'hidden'
        ]);
        expect(machine.states[1].reachable).toBe(false);
        expect(machine.problems).toEqual([]);
        expect(machine.notes.map((note) => note.text)).toEqual([
            '“Continue button” on Home is never drawn in Preview.',
            '“Wide continue” on Home is never drawn in Preview.',
            'Home ends the flow.',
            'Nothing leads to Details.'
        ]);
    });

    it('treats a control that starts hidden as waiting for something to show it', () => {
        const document = fixture();
        for (const id of ['next', 'wide-next']) {
            instance(document, id).prototypeVisible = false;
        }
        const machine = flowMachine(document);
        expect(machine.states[0].transitions[0].guard).toEqual({ kind: 'hiddenAtStart' });
        expect(sentence(machine.states[0].transitions[0])).toBe(
            'Continue button goes to Details, once something shows it'
        );
        expect(machine.states[1].reachable).toBe(false);
    });

    it('notes where the flow ends without counting it as a problem', () => {
        const machine = flowMachine(fixture());
        expect(machine.problems).toEqual([]);
        expect(machine.notes).toEqual([{ screenId: 'details', text: 'Details ends the flow.' }]);
    });
});

describe('layoutFlow', () => {
    it('puts screens in columns by how far they are from the start', () => {
        const machine = flowMachine(template('forms'));
        expect(layoutFlow(machine).cards.map((card) => card.column)).toEqual([0, 1, 2]);
        const branching = layoutFlow(flowMachine(template('list-detail')));
        expect(branching.cards.map((card) => card.column)).toEqual([0, 1, 1]);
        expect(branching.cards[2].y).toBeGreaterThan(
            branching.cards[1].y + branching.cards[1].height
        );
    });

    it('puts screens nothing leads to in a last column, counting only links Preview draws', () => {
        const document = template('list-detail');
        expect(layoutFlow(flowMachine(document)).cards.map((card) => card.column)).toEqual([
            0, 1, 1
        ]);
        // Only a hidden control leads to Empty projects now, so it joins the last column.
        Object.values(document.shapes).find((shape) => shape.name === 'See empty state')!.visible =
            false;
        const machine = flowMachine(document);
        expect(machine.states.map((state) => state.reachable)).toEqual([true, true, false]);
        expect(layoutFlow(machine).cards.map((card) => card.column)).toEqual([0, 1, 2]);
    });

    it('moves no screen that did not need to move when a link is added', () => {
        const document = template('list-detail');
        const before = layoutFlow(flowMachine(document));
        const back = Object.values(document.shapes).find(
            (shape) => shape.name === 'Back to projects'
        ) as InstanceShape;
        const [projects, details, empty] = flowMachine(document).states;
        // Project details now also leads to Empty projects: every distance stays the same.
        back.interactions = { activate: { type: 'navigate', screenId: empty.id } };
        const after = layoutFlow(flowMachine(document), before);
        expect(after.cards.map(({ id, x, y }) => ({ id, x, y }))).toEqual(
            before.cards.map(({ id, x, y }) => ({ id, x, y }))
        );
        // Removing the only link to Project details moves that screen alone.
        for (const shape of Object.values(document.shapes)) {
            if (shape.type === 'instance' && shape.name !== 'See empty state') {
                shape.interactions = { activate: null };
            }
        }
        const pruned = layoutFlow(flowMachine(document), after);
        const place = (layout: typeof pruned, id: string) => {
            const card = layout.cards.find((item) => item.id === id)!;

            return { x: card.x, y: card.y };
        };
        expect(place(pruned, projects.id)).toEqual(place(after, projects.id));
        expect(place(pruned, empty.id)).toEqual(place(after, empty.id));
        expect(place(pruned, details.id).x).toBeGreaterThan(place(after, details.id).x);
    });

    it('keeps a screen in the place it had when others join its column', () => {
        const document = template('list-detail');
        const machine = flowMachine(document);
        const first = layoutFlow(machine);
        // Swap the two second-column screens, as an earlier arrangement might have left them.
        const [, upper, lower] = first.cards;
        const swapped = {
            ...first,
            cards: first.cards.map((card) =>
                card.id === upper.id
                    ? { ...card, y: lower.y + 400 }
                    : card.id === lower.id
                      ? { ...card, y: upper.y }
                      : card
            )
        };
        const next = layoutFlow(machine, swapped);
        const y = (id: string) => next.cards.find((card) => card.id === id)!.y;
        expect(y(lower.id)).toBeLessThan(y(upper.id));
    });
});

describe('routeLinks', () => {
    it.each(STARTER_TEMPLATES)('draws no link across a card in $name', ({ id }) => {
        const machine = flowMachine(template(id));
        const layout = layoutFlow(machine);
        const links = routeLinks(machine, layout);
        const going = machine.states.flatMap((state) =>
            state.transitions.filter((transition) => transition.effect.kind === 'go')
        );
        expect(links.map((link) => link.key)).toEqual(going.map((transition) => transition.key));
        for (const link of links) {
            for (const card of layout.cards) {
                expect(crosses(link, card)).toBe(false);
            }
            expect(link.path.startsWith('M ')).toBe(true);
        }
    });

    it('starts at the row and ends on an edge of the target', () => {
        const machine = flowMachine(template('list-detail'));
        const layout = layoutFlow(machine);
        const [first] = routeLinks(machine, layout);
        const [source, target] = layout.cards;
        expect(first.points[0]).toEqual({
            x: source.x + FLOW.cardWidth,
            y: source.y + FLOW.thumbHeight + FLOW.nameHeight + FLOW.rowHeight / 2
        });
        expect(first.points.at(-1)!.x).toBe(target.x);
    });

    it('spreads arrowheads that arrive at the same screen', () => {
        const machine = flowMachine(template('settings'));
        const layout = layoutFlow(machine);
        const ends = routeLinks(machine, layout)
            .filter((link) => link.to === machine.initial)
            .map((link) => link.points.at(-1)!.y);
        expect(ends).toHaveLength(2);
        expect(new Set(ends).size).toBe(2);
    });

    it('draws a link to its own screen as a small loop beside the row', () => {
        const document = fixture();
        instance(document, 'next').interactions = {
            activate: { type: 'navigate', screenId: 'home' }
        };
        const machine = flowMachine(document);
        const layout = layoutFlow(machine);
        const loop = routeLinks(machine, layout).find((link) => link.key === 'next')!;
        const home = layout.cards[0];
        expect(loop.to).toBe('home');
        expect(loop.points.every((point) => point.x >= home.x + home.width)).toBe(true);
    });

    it('follows a screen that was dragged somewhere else', () => {
        const machine = flowMachine(template('forms'));
        const moved = offsetLayout(layoutFlow(machine), {
            [machine.states[1].id]: { x: 40, y: 120 }
        });
        const [first] = routeLinks(machine, moved);
        expect(first.points.at(-1)!.x).toBe(moved.cards[1].x);
    });
});

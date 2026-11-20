import { describe, expect, it } from 'vitest';
import { propose } from 'src/ai/client';
import { LOCAL_MODEL_TIMING, localSend } from 'src/ai/localModel';
import {
    accessibilityContext,
    accessibilityIssues,
    checkAccessibility,
    checkContexts,
    defaultChoice,
    fixOperations
} from 'src/app/accessibilityCheck';
import { auditScreen, contrastRatio, readHex } from 'src/preview/accessibilityAudit';
import { DEFAULT_ACCESSIBILITY_RULES as RULES } from 'src/preview/accessibilityRules';
import { DEFAULT_VIEWPORT_PRESETS as PRESETS } from 'src/app/services/viewportPresets';
import type { PreviewSession } from 'src/preview/project';
import type { PreviewNode } from 'src/shared/previewProtocol';
import { accessibilityFixture } from './support/accessibility';
import { createTestStore } from './support/store';
import { serializePersistedState } from 'src/app/services/documentStorage';

const session: PreviewSession = {
    modes: {},
    screenId: 'home',
    viewport: { width: 390, height: 844 },
    scope: 'all-screens'
};

function check(document = accessibilityFixture()) {
    const result = checkContexts(document, PRESETS, defaultChoice(document, PRESETS), RULES);
    if (!('contexts' in result)) {
        throw new Error(result.problem);
    }

    return checkAccessibility(document, session, result.contexts, RULES);
}

describe('contrast', () => {
    it('measures as WCAG does', () => {
        expect(contrastRatio(readHex('#ffffff')!, readHex('#000000')!)).toBeCloseTo(21);
        expect(contrastRatio(readHex('#767676')!, readHex('#ffffff')!)).toBeCloseTo(4.54, 2);
    });

    it('reads text against what is drawn below it, with opacity', () => {
        const text = (key: string, y: number, attrs: PreviewNode['attrs'] = {}): PreviewNode => ({
            key,
            tag: 'text',
            attrs: { x: 10, y, 'font-size': 16, fill: '#777777', ...attrs },
            text: 'Hello'
        });
        const report = auditScreen({
            nodes: [
                {
                    key: 'panel',
                    tag: 'g',
                    attrs: { transform: 'translate(0 100)' },
                    children: [
                        {
                            key: 'panel/art',
                            tag: 'rect',
                            attrs: { x: 0, y: 0, width: 200, height: 50, fill: '#000000' }
                        },
                        text('on-dark', 30, { fill: '#ffffff' })
                    ]
                },
                text('on-page', 30),
                {
                    key: 'faded',
                    tag: 'g',
                    attrs: { opacity: 0.5 },
                    children: [text('faded/line', 60, { fill: '#000000' })]
                },
                text('large', 90, { 'font-size': 24 })
            ]
        });
        const ratios = Object.fromEntries(report.contrast.map(({ key, ratio }) => [key, ratio]));

        expect(ratios['on-dark']).toBe(21);
        expect(ratios['on-page']).toBeCloseTo(4.48, 2);
        expect(ratios['faded/line']).toBeLessThan(4.5);
        expect(report.problems.map((problem) => problem.key)).toEqual(['on-page', 'faded/line']);
    });
});

describe('the check across modes and sizes', () => {
    it('covers each mode at each size, within the limit', () => {
        const document = accessibilityFixture();
        const choice = defaultChoice(document, PRESETS);

        expect(choice.modes).toEqual({ theme: ['light', 'dark'] });
        const result = checkContexts(document, PRESETS, choice, RULES);
        expect('contexts' in result && result.contexts.map(({ name }) => name)).toEqual([
            'Light · Mobile',
            'Light · Tablet',
            'Light · Desktop',
            'Dark · Mobile',
            'Dark · Tablet',
            'Dark · Desktop'
        ]);
        expect(checkContexts(document, PRESETS, choice, { ...RULES, maxContexts: 5 })).toEqual({
            problem: 'That is 6 combinations of modes and sizes; choose at most 5.'
        });
        expect(checkContexts(document, PRESETS, { ...choice, sizes: [] }, RULES)).toEqual({
            problem: 'Choose at least one size.'
        });
    });

    it('reports names, focus order and contrast with fixes', () => {
        const checked = check();
        const light = checked[0].screens[0].report;

        expect(light.focusOrder).toEqual(['Sign in', 'Email', 'Rectangle 7']);
        expect(light.names.map(({ role, name }) => `${role} ${name}`)).toEqual([
            'button Sign in',
            'input Email',
            'button Rectangle 7'
        ]);
        const issues = accessibilityIssues(accessibilityFixture(), checked);
        const summary = issues.map(({ problem, contexts, fix, advice }) => ({
            kind: problem.kind,
            key: problem.key,
            contexts: contexts.length,
            fix: fix?.text ?? advice
        }));

        const darkMuted = expect.stringMatching(/^Change Muted text in Dark to #[0-9a-f]{6}\.$/);
        expect(summary).toEqual([
            { kind: 'name', key: 'home/help', contexts: 6, fix: 'Rename Rectangle 7 to “Help”.' },
            {
                kind: 'contrast',
                key: 'home/hint/line-0',
                contexts: 3,
                fix: 'No one color reads on every background it is drawn on here. Bind it to a color variable with a value for each mode.'
            },
            {
                kind: 'focusOrder',
                key: 'home/email',
                contexts: 6,
                fix: 'Tab follows the layer order: move the later control below the earlier one in Layers.'
            },
            { kind: 'contrast', key: 'home/title/line-0', contexts: 3, fix: darkMuted },
            { kind: 'contrast', key: 'home/help/help-text/line-0', contexts: 3, fix: darkMuted }
        ]);
    });

    it('fixes what it can so the check passes for those problems', async () => {
        const document = accessibilityFixture();
        const saved = serializePersistedState({
            currentDocumentId: document.id,
            documents: { [document.id]: document }
        });
        const { store } = createTestStore({ reactor: JSON.stringify(saved) });
        await store.onInitialize();
        const operations = fixOperations(accessibilityIssues(document, check(document)));

        expect(operations.map(({ op }) => op)).toEqual(['updateVariable', 'updateShape']);
        const result = store.actions.applyOperations({
            documentId: document.id,
            by: { kind: 'person' },
            operations
        });
        expect(result).toEqual({ applied: true, ids: {} });
        const after = accessibilityIssues(
            store.state.currentDocument,
            check(store.state.currentDocument)
        ).map(({ problem }) => `${problem.kind} ${problem.key}`);

        expect(after).toEqual(['contrast home/hint/line-0', 'focusOrder home/email']);
    });
});

describe('what the check reads', () => {
    const button = (
        key: string,
        label: string,
        y: number,
        children: PreviewNode[] = []
    ): PreviewNode => ({
        key,
        tag: 'g',
        attrs: {},
        control: { role: 'button', label, x: 0, y, width: 80, height: 20 },
        children
    });
    const caption = (key: string, text: string, y: number): PreviewNode => ({
        key,
        tag: 'text',
        attrs: { x: 0, y: y + 15, 'font-size': 14, fill: '#000000' },
        text
    });

    it('checks variants and hidden instances, but Tab only reads the start', () => {
        const report = auditScreen({
            nodes: [
                {
                    ...button('menu', 'Open', 0, [caption('menu/text', 'Open', 0)]),
                    variantKey: 'menu',
                    initialVariant: 'closed',
                    variants: {
                        closed: button('menu', 'Open', 0, [caption('menu/text', 'Open', 0)]),
                        open: button('menu', 'Menu', 0, [caption('menu/text', 'Close', 0)])
                    }
                },
                {
                    ...button('later', '', 40),
                    visibility: { key: 'later', initial: false }
                },
                {
                    ...button('off', 'Off', 80),
                    control: { ...button('off', 'Off', 80).control!, disabled: true }
                }
            ]
        });

        expect(report.focusOrder).toEqual(['Open']);
        expect(report.problems).toEqual([
            {
                kind: 'name',
                key: 'menu',
                role: 'button',
                name: 'Menu',
                visible: 'Close',
                when: { variant: 'open' }
            },
            {
                kind: 'name',
                key: 'later',
                role: 'button',
                name: '',
                visible: '',
                when: { shown: true }
            }
        ]);
    });

    it('reads the player state when given one', () => {
        const nodes = [
            { ...button('later', 'Later', 0), visibility: { key: 'later', initial: false } },
            button('first', 'First', 40)
        ];

        expect(auditScreen({ nodes }, RULES, (node) => node).focusOrder).toEqual([
            'Later',
            'First'
        ]);
        expect(
            auditScreen({ nodes }, RULES, (node) => (node.visibility ? undefined : node)).focusOrder
        ).toEqual(['First']);
    });

    it('sets a linked Label to the words a control shows', () => {
        const document = accessibilityFixture();
        document.shapes.spoken = {
            ...document.shapes.caption,
            id: 'spoken',
            name: 'Spoken',
            order: 'a9',
            visible: false
        } as typeof document.shapes.caption;
        if (document.shapes.spoken.type === 'text') {
            document.shapes.spoken.value = 'Submit form';
        }
        document.components.button.shapesIds.push('spoken');
        document.components.button.props!.push({
            id: 'spoken',
            shapeId: 'spoken',
            key: 'text',
            label: 'Spoken label'
        });
        document.components.button.interaction = {
            role: 'button',
            props: { label: 'spoken' },
            navigateTo: 'home'
        };
        const issue = accessibilityIssues(document, check(document)).find(
            ({ problem }) => problem.key === 'home/submit'
        );

        expect(issue?.message).toBe(
            "The button “Sign in” is named “Submit form”, which doesn't include the text it shows."
        );
        expect(issue?.fix).toEqual({
            text: "Set Sign in button's Label to “Sign in”.",
            operations: [
                {
                    op: 'updateShape',
                    shape: 'submit',
                    changes: { overrides: { spoken: 'Sign in' } }
                }
            ]
        });
    });
});

it('lets the local test model propose the check’s fixes', async () => {
    const document = accessibilityFixture();
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    const { store } = createTestStore({ reactor: JSON.stringify(saved) });
    await store.onInitialize();
    Object.assign(LOCAL_MODEL_TIMING, { eventMs: 0 });
    const issues = accessibilityIssues(document, check(document));
    const result = await propose({
        send: localSend,
        documentId: document.id,
        request: {
            task: 'edit',
            prompt: 'Fix the accessibility problems the check found.',
            context: { accessibility: accessibilityContext(issues) }
        },
        check: (operations) =>
            store.actions.checkOperations({ documentId: document.id, operations }),
        signal: new AbortController().signal
    });

    expect(result).toMatchObject({ kind: 'proposed', operations: fixOperations(issues) });
});

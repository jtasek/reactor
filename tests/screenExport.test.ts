import { json } from 'overmind';
import { createTestStore } from './support/store';
import { serializePersistedState } from 'src/app/services/documentStorage';
import { createDocument, createShape } from 'src/app/factories';
import { prototypeDocument } from './support/prototype';
import { responsiveVariantsDocument } from './support/responsiveVariants';
import { projectSvg, serializeSvg } from 'src/export/svg';
import type { Document } from 'src/app/types';

async function open(document: Document) {
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    const { store } = createTestStore({ reactor: JSON.stringify(saved) });
    await store.onInitialize();

    return store;
}

it('exports a Screen view with its resolved theme, width-selected layout and text size, without mutating it', async () => {
    const store = await open(prototypeDocument());
    store.actions.editFrame({ kind: 'select', id: 'view' });
    const before = JSON.stringify(json(store.state.currentDocument));
    const drawing = projectSvg(store.state);
    const svg = serializeSvg({ ...drawing, images: {} });
    expect(drawing.screens[0]).toMatchObject({ x: 400, y: 200, width: 320, height: 480 });
    expect(svg).toContain('#ddeeff');
    expect(svg).toContain('font-size="14"');
    expect(svg).toContain('<title>Home · Mobile</title>');
    expect(svg).not.toMatch(/foreignObject|data-shape|var\(|navigateTo/);
    expect(serializeSvg({ ...projectSvg(store.state), images: {} })).toBe(svg);
    expect(JSON.stringify(json(store.state.currentDocument))).toBe(before);
});

it.each([false, true])(
    'exports responsive variants while respecting explicit choice (%s)',
    async (explicit) => {
        const document = responsiveVariantsDocument();
        const view = Object.values(document.frames).find((frame) => frame.kind === 'view')!;
        view.size.width = 800;
        const button = document.shapes.button;
        if (button.type !== 'instance') {
            throw new Error('Expected instance');
        }
        button.overrides = {};
        if (explicit) {
            button.variantMode = undefined;
            button.variantId = 'family';
        }
        const store = await open(document);
        store.actions.editFrame({ kind: 'select', id: view.id });
        const svg = serializeSvg({ ...projectSvg(store.state), images: {} });
        expect(svg).toContain(explicit ? 'Default' : 'Wide');
    }
);

it('exports selected rotated artwork with escaping and stroke bounds, excluding unselected shapes', async () => {
    const shape = createShape({
        id: 'rect',
        name: 'Rectangle',
        order: 'a0',
        type: 'rectangle',
        position: { x: 10, y: 20 },
        size: { width: 40, height: 20 },
        rotation: 90
    });
    const other = createShape({
        id: 'other',
        name: 'Other',
        order: 'a1',
        type: 'rectangle',
        position: { x: 1000, y: 2000 },
        size: { width: 20, height: 20 }
    });
    const store = await open(
        createDocument({ name: 'A < B & "C"', shapes: { [shape.id]: shape, [other.id]: other } })
    );
    store.actions.selectShape(shape.id);
    const drawing = projectSvg(store.state);
    expect(drawing.screens[0]).toMatchObject({ x: 16, y: 6, width: 28, height: 48 });
    const svg = serializeSvg({ ...drawing, images: {} });
    expect(svg).toContain('rotate(90 30 30)');
    expect(svg).toContain('A &lt; B &amp; &quot;C&quot;');
    expect(svg).toContain('stroke="#474a51"');
    expect(svg).not.toContain('1000');
});

it('rejects empty selections and unsafe attributes rather than creating partial files', async () => {
    const store = await open(createDocument());
    expect(() => projectSvg(store.state)).toThrow('Select a Screen view');
    expect(() =>
        serializeSvg({
            documentId: 'test',
            images: {},
            screens: [
                {
                    id: 'x',
                    name: 'x',
                    x: 0,
                    y: 0,
                    width: 10,
                    height: 10,
                    nodes: [{ key: 'x', tag: 'rect', attrs: { onclick: 'alert(1)' } }]
                }
            ]
        })
    ).toThrow();
});

it.each([undefined, 'home'])(
    'resolves automatic and explicit screen layouts (%s)',
    async (layoutId) => {
        const document = prototypeDocument();
        document.frames.view.size.width = 800;
        document.frames.view.layoutId = layoutId;
        document.frames.view.layoutMode = layoutId ? undefined : 'auto';
        const store = await open(document);
        store.actions.editFrame({ kind: 'select', id: 'view' });
        const svg = serializeSvg({ ...projectSvg(store.state), images: {} });
        expect(svg).toContain('width="800"');
        expect(svg).toContain(`translate(${layoutId ? 424 : 448} 232)`);
        expect(svg).toContain('font-size="20"');
    }
);

it('rejects characters that cannot be represented in XML', async () => {
    const document = prototypeDocument();
    document.frames.view.name = `Invalid${String.fromCharCode(0)}name`;
    const store = await open(document);
    store.actions.editFrame({ kind: 'select', id: 'view' });
    expect(() => serializeSvg({ ...projectSvg(store.state), images: {} })).toThrow(
        'SVG cannot represent'
    );
});

it('exports a selection inside a Screen view in that view’s coordinate and mode context', async () => {
    const store = await open(prototypeDocument());
    store.actions.selectShape('name');
    store.actions.events.setScreenView('view');
    const drawing = projectSvg(store.state);
    expect(drawing.screens[0].x).toBeGreaterThan(400);
    const svg = serializeSvg({ ...drawing, images: {} });
    expect(svg).toContain('#ddeeff');
    expect(svg).toContain('Your name');
    expect(svg).not.toContain('Continue');
});

it('bounds expanded SVG when many shapes reuse a large embedded image', () => {
    const hash = 'a'.repeat(64);
    const image = `data:image/png;base64,iVBORw0KGgoA${'A'.repeat(4 * 1024 * 1024 - 12)}`;
    expect(() =>
        serializeSvg({
            documentId: 'large',
            images: { [hash]: image },
            screens: [
                {
                    id: 'screen',
                    name: 'Large',
                    x: 0,
                    y: 0,
                    width: 100,
                    height: 100,
                    nodes: Array.from({ length: 10 }, (_, index) => ({
                        key: String(index),
                        tag: 'image' as const,
                        image: hash,
                        attrs: { x: 0, y: 0, width: 100, height: 100 }
                    }))
                }
            ]
        })
    ).toThrow('SVG exceeds 32 MiB');
});

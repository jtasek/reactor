import { documentContext, MAX_CONTEXT_BYTES } from 'src/ai/context';
import { createComponent, createDocument, createShape } from 'src/app/factories';
import { fixtureDocument } from './harness';
import { prototypeDocument } from '../support/prototype';
import { describeComponentProp } from 'src/app/componentProps';
import { responsiveDocument } from '../support/responsiveModes';

const label = (value: string) => ({ type: 'text', position: { x: 0, y: 0 }, value });

describe('AI document context', () => {
    it('resolves width-selected modes independently of Theme for each selected Screen view', () => {
        const document = responsiveDocument();
        const mobile = documentContext({
            ...document,
            selectedShapesIds: [],
            selectedFrameId: 'mobile'
        });
        const desktop = documentContext({
            ...document,
            selectedShapesIds: [],
            selectedFrameId: 'desktop'
        });

        expect(mobile.variables.font.resolved).toMatchObject({
            value: 14,
            modeId: 'xs',
            usesBaseValue: false
        });
        expect(mobile.variables.ink.resolved.value).toBe('#ddeeff');
        expect(mobile.resolution.sources.media).toBe('Screen width · 360px');
        expect(desktop.variables.font.resolved.value).toBe(20);
        expect(desktop.variables.ink.resolved).toMatchObject({
            value: '#112233',
            modeId: 'light',
            usesBaseValue: true
        });
    });

    it('describes component property types, source defaults, role links and alternate dependencies', () => {
        const document = fixtureDocument({ shapes: { title: label('Continue') } });
        document.components.button = createComponent({
            id: 'button',
            name: 'Button',
            shapesIds: ['title'],
            props: [{ id: 'caption', label: 'Title: Text', shapeId: 'title', key: 'text' }],
            interaction: { role: 'button', props: { label: 'caption' } },
            variantIds: ['compact']
        });
        document.components.compact = createComponent({ id: 'compact', name: 'Compact' });
        document.shapes.instance = createShape({
            id: 'instance',
            name: 'Button',
            order: 'a1',
            type: 'instance',
            componentId: 'button',
            position: { x: 0, y: 0 },
            overrides: {}
        });
        document.shapesIds.push('instance');
        document.selectedShapesIds = ['instance'];
        const before = JSON.stringify(document);
        const { components } = documentContext(document);

        expect(components.button.props).toEqual([
            describeComponentProp(document.components.button, 'caption', document)
        ]);
        expect(components.button.props[0]).toMatchObject({
            id: 'caption',
            type: 'text',
            defaultValue: 'Continue',
            key: 'text'
        });
        expect(components.button.interaction).toEqual({
            role: 'button',
            props: { label: 'caption' }
        });
        expect(components.button.role).toEqual({
            role: 'button',
            props: { label: 'Continue' },
            problems: []
        });
        expect(components.compact.name).toBe('Compact');
        expect(JSON.stringify(document)).toBe(before);
    });

    it('keeps authored alias values and describes resolution in the selected view', () => {
        const document = prototypeDocument();
        document.variables.palette = {
            id: 'palette',
            name: 'Palette',
            type: 'color',
            dimensionId: 'theme',
            values: { default: '#ffffff', dark: '#111111' }
        };
        document.variables.surface = {
            id: 'surface',
            name: 'Surface',
            type: 'color',
            alias: 'palette',
            values: { default: '#ff0000' }
        };
        const context = documentContext({
            ...document,
            selectedShapesIds: [],
            selectedFrameId: 'view'
        });

        expect(context.resolution).toMatchObject({
            scope: 'frame',
            frameId: 'view',
            modes: { theme: 'dark' }
        });
        expect(context.variables.surface).toMatchObject({
            value: '#ff0000',
            alias: 'palette',
            resolved: {
                value: '#111111',
                definitionId: 'palette',
                dimensionId: 'theme',
                modeId: 'dark',
                usesBaseValue: false,
                problems: []
            }
        });
        delete document.variables.palette.values.dark;
        const fallback = documentContext({
            ...document,
            selectedShapesIds: [],
            selectedFrameId: 'view'
        });
        expect(fallback.variables.surface.resolved).toMatchObject({
            value: '#ffffff',
            usesBaseValue: true
        });
        expect(document.variables.surface.values.default).toBe('#ff0000');
    });

    it('sends the selection and its group, without unrelated shapes or variables', () => {
        const document = fixtureDocument({
            shapes: {
                title: label('Title'),
                caption: label('Caption'),
                private: label('Unrelated private text')
            },
            groups: { card: { name: 'Card', shapes: ['title', 'caption'] } },
            variables: { secret: { name: 'Secret', type: 'text', value: 'Private variable' } }
        });

        document.selectedShapesIds = ['title'];
        const before = JSON.stringify(document);
        const context = documentContext(document);

        expect(Object.keys(context.shapes)).toEqual(['title', 'caption']);
        expect(context.groups).toEqual({ card: { name: 'Card', shapes: ['title', 'caption'] } });
        expect(context.variables).toEqual({});
        expect(context.components).toEqual({});
        expect(context.selection).toEqual(['title']);
        expect(JSON.stringify(context)).not.toMatch(/private|Secret|Private variable/);
        expect(JSON.stringify(document)).toBe(before);
    });

    it('follows bindings and nested text templates, including cycles and escaped text', () => {
        const document = fixtureDocument({
            shapes: {
                title: {
                    ...label('Welcome Ada'),
                    template: '${greeting$Greeting}',
                    bindings: { fontColor: 'brand' }
                }
            },
            variables: {
                brand: { name: 'Brand', type: 'color', value: '#3366ff' },
                greeting: { name: 'Greeting', type: 'text', value: '${name$Name} \\${Secret}' },
                name: { name: 'Name', type: 'text', value: '${Greeting}' },
                secret: { name: 'Secret', type: 'text', value: 'Not referenced' }
            }
        });

        document.selectedShapesIds = ['title'];
        const { variables } = documentContext(document);

        expect(Object.keys(variables).sort()).toEqual(['brand', 'greeting', 'name']);
        expect(variables.greeting.value).toBe('${name$Name} \\${Secret}');
    });

    it('includes nested component sources and their variable and override dependencies', () => {
        const document = fixtureDocument({
            shapes: {
                card: {
                    type: 'instance',
                    componentId: 'outer',
                    position: { x: 10, y: 10 },
                    overrides: { heading: '${title$Title}', color: { variableId: 'accent' } }
                },
                unrelated: label('Private canvas content')
            },
            variables: {
                title: { name: 'Title', type: 'text', value: 'Hello' },
                accent: { name: 'Accent', type: 'color', value: '#ff6600' },
                sourceColor: { name: 'Source color', type: 'color', value: '#000000' },
                unused: { name: 'Unused', type: 'text', value: 'Private' }
            }
        });
        const nested = createShape({
            name: 'Nested',
            order: 'a0',
            type: 'instance',
            componentId: 'inner',
            position: { x: 0, y: 0 },
            overrides: {}
        });
        const source = createShape({
            name: 'Source',
            order: 'a0',
            type: 'text',
            position: { x: 0, y: 0 },
            value: 'Source text',
            bindings: { fontColor: 'sourceColor' }
        });

        document.components = {
            outer: createComponent({
                id: 'outer',
                name: 'Card',
                shapesIds: [nested.id],
                sourceShapes: { [nested.id]: nested }
            }),
            inner: createComponent({
                id: 'inner',
                name: 'Label',
                shapesIds: [source.id],
                sourceShapes: { [source.id]: source }
            }),
            unused: createComponent({ id: 'unused', name: 'Private component' })
        };
        document.selectedShapesIds = ['card'];
        const context = documentContext(document);

        expect(Object.keys(context.shapes)).toEqual(['card']);
        expect(Object.keys(context.components).sort()).toEqual(['inner', 'outer']);
        expect(context.components.inner.shapes[source.id]).toMatchObject({ value: 'Source text' });
        expect(Object.keys(context.variables).sort()).toEqual(['accent', 'sourceColor', 'title']);
        expect(JSON.stringify(context)).not.toMatch(/Private|createdBy|modifiedBy|selected/);
    });

    it('keeps small documents and their design system available with no selection', () => {
        const document = fixtureDocument({
            shapes: { title: label('Welcome') },
            variables: { brand: { name: 'Brand', type: 'color', value: '#3366ff' } }
        });

        document.selectedShapesIds = [];
        const context = documentContext(document);

        expect(context.selection).toEqual([]);
        expect(Object.keys(context.shapes)).toEqual(['title']);
        expect(context.variables.brand.value).toBe('#3366ff');
    });

    it('rejects oversized UTF-8 context instead of silently truncating it', () => {
        const document = fixtureDocument({
            shapes: { title: label('🎨'.repeat(MAX_CONTEXT_BYTES / 4)) }
        });

        document.selectedShapesIds = ['title'];
        expect(() => documentContext(document)).toThrow(/select fewer items/i);
    });

    it('allows a small selection from a document that is too large to send whole', () => {
        const document = fixtureDocument({
            shapes: {
                title: label('Welcome'),
                private: label('x'.repeat(MAX_CONTEXT_BYTES))
            }
        });

        document.selectedShapesIds = [];
        expect(() => documentContext(document)).toThrow(/select fewer items/i);
        document.selectedShapesIds = ['title'];
        expect(Object.keys(documentContext(document).shapes)).toEqual(['title']);
    });

    it('bounds the number of records even when their JSON would fit', () => {
        const document = fixtureDocument({
            variables: Object.fromEntries(
                Array.from({ length: 301 }, (_, index) => [
                    String(index),
                    {
                        name: String(index),
                        type: 'boolean',
                        value: false
                    }
                ])
            )
        });

        document.selectedShapesIds = [];
        expect(() => documentContext(document)).toThrow(/select fewer items/i);
    });

    it('keeps component source drawing order and ends cyclic component references', () => {
        const document = fixtureDocument({
            shapes: {
                card: {
                    type: 'instance',
                    componentId: 'card',
                    position: { x: 0, y: 0 },
                    overrides: {}
                }
            }
        });
        const lower = createShape({
            type: 'text',
            name: 'Lower',
            order: 'a0',
            position: { x: 0, y: 0 },
            value: 'Lower'
        });
        const upper = createShape({
            type: 'instance',
            name: 'Upper',
            order: 'a1',
            position: { x: 0, y: 0 },
            componentId: 'card',
            overrides: {}
        });

        document.components.card = createComponent({
            id: 'card',
            shapesIds: [upper.id, lower.id],
            sourceShapes: { [upper.id]: upper, [lower.id]: lower }
        });
        document.selectedShapesIds = ['card'];
        const context = documentContext(document);

        expect(Object.keys(context.components)).toEqual(['card']);
        expect(Object.keys(context.components.card.shapes)).toEqual([lower.id, upper.id]);
    });

    it('sends text mode values and the variables they show', () => {
        const document = createDocument({
            dimensions: {
                density: {
                    id: 'density',
                    name: 'Density',
                    order: 0,
                    defaultModeId: 'small',
                    modes: {
                        small: { id: 'small', name: 'Small', order: 0 },
                        large: { id: 'large', name: 'Large', order: 1 }
                    }
                }
            },
            variables: {
                name: { id: 'name', name: 'Name', type: 'text', values: { default: 'Ada' } },
                copy: {
                    id: 'copy',
                    name: 'Copy',
                    type: 'text',
                    dimensionId: 'density',
                    values: { default: 'Hi', large: 'Hello ${name$Name}' }
                }
            }
        });
        const context = documentContext({ ...document, selectedShapesIds: [] });

        expect(context.variables.copy).toMatchObject({
            dimensionId: 'density',
            modeValues: { large: 'Hello ${name$Name}' }
        });
        expect(context.variables.name).toMatchObject({ value: 'Ada' });
    });
    it('lists component source members in drawing order without unrelated shapes', () => {
        const shape = (id: string, order: string) => ({
            ...createShape({ type: 'text', position: { x: 0, y: 0 }, value: id, name: id, order }),
            id
        });
        const shapes = {
            top: shape('top', 'a2'),
            bottom: shape('bottom', 'a0'),
            other: shape('other', 'a1')
        };
        const document = createDocument({ shapes });
        document.components.card = createComponent({
            id: 'card',
            name: 'Card',
            shapesIds: ['top', 'missing', 'bottom', 'top']
        });
        document.shapes.instance = {
            ...createShape({
                type: 'instance',
                position: { x: 0, y: 0 },
                componentId: 'card',
                overrides: {},
                name: 'Card',
                order: 'a3'
            }),
            id: 'instance'
        } as typeof document.shapes.instance;
        document.shapesIds.push('instance');

        const { components } = documentContext({ ...document, selectedShapesIds: [] });

        expect(Object.keys(components.card.shapes)).toEqual(['bottom', 'top']);
    });
});

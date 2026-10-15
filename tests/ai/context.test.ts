import { documentContext, MAX_CONTEXT_BYTES } from 'src/ai/context';
import { createComponent, createShape } from 'src/app/factories';
import { fixtureDocument } from './harness';

const label = (value: string) => ({ type: 'text', position: { x: 0, y: 0 }, value });

describe('AI document context', () => {
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
});

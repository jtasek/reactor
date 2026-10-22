import { projectPreview } from 'src/preview/project';
import { readPreview } from 'src/preview/protocol';
import { previewFixture } from './support/preview';
import { createShape } from 'src/app/factories';
import {
    readRoleSettings,
    serializePersistedState,
    migratePersistedState,
    restoreDocuments
} from 'src/app/services/documentStorage';
import { componentFingerprint } from 'src/app/componentLibrary';
import { buildVariable, writeText } from 'src/app/variables';
import { componentPropValue } from 'src/app/componentProps';

it.each([
    { name: 'source template', source: 'Hello ${Person}', expected: 'Hello Ada' },
    {
        name: 'literal override template',
        source: 'Original',
        override: 'Hi ${person$Person}',
        expected: 'Hi Ada'
    },
    {
        name: 'escaped source text',
        source: 'Hello \\${Person}',
        expected: 'Hello ${Person}'
    },
    {
        name: 'escaped literal override',
        source: 'Original',
        override: 'Hi \\${Person}',
        expected: 'Hi ${Person}'
    },
    {
        name: 'variable override template',
        source: 'Original',
        override: { variableId: 'greeting' },
        variable: 'Welcome ${Person}',
        expected: 'Welcome Ada'
    },
    {
        name: 'already rendered variable override',
        source: 'Original',
        override: { variableId: 'greeting' },
        variable: 'Welcome \\${Person}',
        expected: 'Welcome ${Person}'
    }
])(
    'renders $name in input values, labels and placeholders without changing authoring data',
    ({ source, override, variable, expected }) => {
        const document = previewFixture();
        document.variables.person = buildVariable('person', 'Person', 'text', 'Ada')!;
        document.variables.greeting = buildVariable(
            'greeting',
            'Greeting',
            'text',
            variable ?? ''
        )!;
        const field = document.shapes.field;
        const instance = document.shapes.name;
        if (field.type !== 'text' || instance.type !== 'instance') {
            throw new Error('Invalid preview fixture');
        }
        writeText(field, source, document.variables);
        if (override !== undefined) {
            instance.overrides.label = override;
        }
        document.components.input.interaction!.props = {
            label: 'label',
            value: 'label',
            placeholder: 'label'
        };
        const authoringValue = componentPropValue(
            instance,
            document.components.input,
            'label',
            document
        );
        const before = JSON.stringify(document);
        const output = projectPreview(document, {});
        const input = output.screens[0].nodes.find((node) => node.key === 'home/name')!;

        expect(input.control).toMatchObject({
            label: expected,
            value: expected,
            placeholder: expected
        });
        expect(input.children![0].children![0].text).toBe(expected);
        expect(JSON.stringify(document)).toBe(before);
        expect(componentPropValue(instance, document.components.input, 'label', document)).toBe(
            authoringValue
        );
    }
);

it('projects only shown frame members, resolved props and drawing data, without source records or account state', () => {
    const document = previewFixture();
    const output = projectPreview(document, {});
    expect(output.screens.map((screen) => screen.name)).toEqual(['Home', 'Details']);
    const button = output.screens[0].nodes.find((node) => node.key === 'home/next')!;
    expect(button.control).toMatchObject({
        role: 'button',
        label: 'Continue',
        navigateTo: 'details'
    });
    expect(output.screens[0].nodes.map((node) => node.key)).toEqual(['home/next', 'home/name']);
    expect(JSON.stringify(output)).not.toContain('sourceOnly');
    expect(JSON.stringify(output)).not.toContain('overrides');
    document.frames.home.visible = false;
    expect(projectPreview(document, {}).screens.map((screen) => screen.id)).toEqual(['details']);
});

it('reports stale semantic links, navigation targets and cyclic components instead of producing a partial prototype', () => {
    const document = previewFixture();
    document.components.button.interaction!.props.label = 'gone';
    expect(() => projectPreview(document, {})).toThrow('missing or incompatible');
    document.components.button.interaction!.props.label = 'label';
    document.frames.details.visible = false;
    expect(() => projectPreview(document, {})).toThrow('missing or hidden screen');
    document.frames.details.visible = true;
    document.components.button.sourceShapes = {
        caption: document.shapes.caption,
        self: { ...document.shapes.next, id: 'self' }
    };
    document.components.button.shapesIds = ['caption', 'self'];
    expect(() => projectPreview(document, {})).toThrow('missing or cyclic');
});

it('refuses raw markup, executable attributes, external resources and unbounded drawing trees', () => {
    const output = projectPreview(previewFixture(), {});
    const node = output.screens[0].nodes[0];
    node.attrs.onclick = 'alert(1)';
    expect(() => readPreview(output)).toThrow('attributes');
    delete node.attrs.onclick;
    node.tag = 'script' as typeof node.tag;
    expect(() => readPreview(output)).toThrow('content');
    node.tag = 'image';
    node.attrs.href = 'https://editor.test/api/documents';
    expect(() => readPreview(output)).toThrow('attributes');
    delete node.attrs.href;
    node.children = [node];
    expect(() => readPreview(output)).toThrow();
});

it('preserves navigation through durable readers and library fingerprints, and opens schema v10 files', () => {
    const document = previewFixture();
    expect(readRoleSettings(document.components.button.interaction).navigateTo).toBe('details');
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    const restored = restoreDocuments(migratePersistedState({ ...saved, version: 10 })!);
    expect(restored['preview-document'].components.button.interaction?.navigateTo).toBe('details');
    const before = componentFingerprint(document, 'button');
    document.components.button.interaction!.navigateTo = 'home';
    expect(componentFingerprint(document, 'button')).not.toBe(before);
});

it('diagnoses unsupported resources explicitly', () => {
    const document = previewFixture();
    document.shapes.photo = {
        ...createShape({
            id: 'photo',
            type: 'image',
            name: 'Photo',
            source: 'asset:abc',
            size: { width: 30, height: 30 },
            position: { x: 10, y: 10 },
            parentFrameId: 'home',
            order: 'a5'
        }),
        id: 'photo'
    };
    document.shapesIds.push('photo');
    expect(() => projectPreview(document, {})).toThrow('image resources');
});

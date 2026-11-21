import { buildStarterTemplate } from 'src/templates/build';
import { STARTER_TEMPLATES } from 'src/templates/catalog';
import { createDocument, createShape } from 'src/app/factories';
import type { Document } from 'src/app/types';
import { parityArtworkDocument } from './parityArtwork';
import { prototypeDocument } from './prototype';
import { responsiveDocument } from './responsiveModes';
import { responsiveVariantsDocument } from './responsiveVariants';
import { screenLayoutsDocument } from './screenLayouts';
import { dataListFixture, recordDetailFixture } from './dataList';

/**
 * Documents that between them use every kind of record and drawing. The projection parity
 * suite draws each one everywhere a person sees it; the compatibility suite saves each one
 * in every published format.
 */
export const DOCUMENT_FIXTURES: [string, () => Document][] = [
    ['primitives, nested instances, frame themes and state', parityArtworkDocument],
    ['theme and width modes', () => responsiveDocument()],
    ['automatic and explicit screen layouts', prototypeDocument],
    ['stacks with fill in two layouts', () => screenLayoutsDocument()],
    ['responsive component variants', () => responsiveVariantsDocument()],
    ['records repeated in a list', () => dataListFixture().document],
    ['a selected record', () => recordDetailFixture().document],
    ...STARTER_TEMPLATES.map(({ id, name }): [string, () => Document] => [
        `${name} starter`,
        () => {
            let next = 0;

            return createDocument({ id, ...buildStarterTemplate(id, () => `${id}-${next++}`) });
        }
    ])
];

/** Every field type, a rule, groups, a layer, a link, a guide and the variable types left. */
function organizedRecords(): Document {
    const { document } = recordDetailFixture();
    document.id = 'organized-records';
    document.name = 'Organized records';
    document.dataEntities.teams = { id: 'teams', name: 'Teams', labelFieldId: 'team-name' };
    document.dataEntities.customers.mapPosition = { x: 40, y: 60 };
    Object.assign(document.dataFields, {
        'team-name': {
            id: 'team-name',
            entityId: 'teams',
            name: 'Name',
            type: 'text',
            required: true
        },
        age: { id: 'age', entityId: 'customers', name: 'Age', type: 'number', required: false },
        active: {
            id: 'active',
            entityId: 'customers',
            name: 'Active',
            type: 'boolean',
            required: false
        },
        plan: {
            id: 'plan',
            entityId: 'customers',
            name: 'Plan',
            type: 'choice',
            required: false,
            options: ['Free', 'Team']
        },
        team: {
            id: 'team',
            entityId: 'customers',
            name: 'Team',
            type: 'reference',
            required: false,
            targetEntityId: 'teams'
        }
    });
    document.dataRecords.core = {
        id: 'core',
        entityId: 'teams',
        order: 0,
        values: { 'team-name': 'Core' }
    };
    Object.assign(document.dataRecords.ada.values, {
        age: 36,
        active: true,
        plan: 'Team',
        team: 'core'
    });
    document.dataRules.adult = {
        id: 'adult',
        entityId: 'customers',
        order: 0,
        when: { kind: 'isSet', operand: { kind: 'field', fieldId: 'age' } },
        check: {
            kind: 'and',
            conditions: [
                {
                    kind: 'greater',
                    left: { kind: 'field', fieldId: 'age' },
                    right: { kind: 'value', value: 17 }
                },
                {
                    kind: 'not',
                    condition: {
                        kind: 'contains',
                        left: { kind: 'field', fieldId: 'name' },
                        right: { kind: 'value', value: 'test' }
                    }
                }
            ]
        },
        message: 'Customers are adults.',
        fieldId: 'age'
    };
    document.prototypeBooleans.query = { id: 'query', name: 'Query', type: 'text', initial: '' };
    document.prototypeBooleans.count = { id: 'count', name: 'Count', type: 'number', initial: 2 };
    document.variables.greeting = {
        id: 'greeting',
        name: 'Greeting',
        type: 'text',
        values: { default: 'Hello' }
    };
    document.variables.compact = {
        id: 'compact',
        name: 'Compact',
        type: 'boolean',
        values: { default: false }
    };
    const member = { locked: false, selected: false, visible: true };
    document.groups.labels = {
        ...member,
        id: 'labels',
        name: 'Labels',
        rotation: 15,
        shapesIds: ['caption', 'field']
    };
    document.layers.notes = { ...member, id: 'notes', name: 'Notes', shapesIds: ['title'] };
    document.links.flow = {
        ...member,
        id: 'flow',
        name: 'Home to details',
        source: 'next',
        target: 'title',
        type: 'arrow'
    };
    document.guides.margin = {
        ...member,
        id: 'margin',
        name: 'Margin',
        orientation: 'vertical',
        position: { x: 24, y: 0 }
    };

    return document;
}

/** Colors and numbers without modes, an alias among them: what a DTCG file can carry. */
function plainTokens(): Document {
    const card = createShape({
        type: 'rectangle',
        name: 'Card',
        order: 'a0',
        position: { x: 40, y: 40 },
        size: { width: 160, height: 96 },
        fill: '#2457d6',
        bindings: { fill: 'accent', width: 'card-width' }
    });
    card.id = 'card';

    return createDocument({
        id: 'plain-tokens',
        name: 'Plain tokens',
        variables: {
            brand: { id: 'brand', name: 'Brand', type: 'color', values: { default: '#2457d6' } },
            accent: {
                id: 'accent',
                name: 'Accent',
                type: 'color',
                values: { default: '#2457d6' },
                alias: 'brand'
            },
            'card-width': {
                id: 'card-width',
                name: 'Card width',
                type: 'number',
                values: { default: 160 }
            }
        },
        shapes: { card },
        shapesIds: ['card']
    });
}

/** The fixtures above and the records no drawing needs. */
export const SAVED_FIXTURES: [string, () => Document][] = [
    ...DOCUMENT_FIXTURES,
    ['records, rules, groups and guides', organizedRecords],
    ['colors and numbers with an alias', plainTokens]
];

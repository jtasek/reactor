import { dataFields, dataProblems, dataRecords } from 'src/app/data';
import type { DataType, DataValue } from 'src/app/dataTypes';
import type { AiCase } from './harness';

/** Outcomes are independent of the reference calls; live answers may use different calls. */
export function defineCase({
    expected,
    ...test
}: Omit<AiCase, 'check'> & {
    expected: {
        document?: object;
        shapes?: Record<string, object>;
        variables?: Record<string, object>;
        bindings?: Record<string, Record<string, string>>;
        unbound?: string[];
        templates?: Record<string, string>;
        counts: { shapes: number; variables: number; groups: number; components?: number };
    };
}): AiCase {
    return {
        ...test,
        check(document) {
            try {
                expect(document).toMatchObject(expected.document ?? {});
                for (const [collection, count] of Object.entries(expected.counts)) {
                    expect(
                        Object.keys(document[collection as keyof typeof expected.counts])
                    ).toHaveLength(count);
                }
                for (const collection of ['shapes', 'variables'] as const) {
                    for (const [name, fields] of Object.entries(expected[collection] ?? {})) {
                        const matches = Object.values(document[collection]).filter(
                            (record) => record.name === name
                        );

                        expect(matches, `${collection}: ${name}`).toHaveLength(1);
                        expect(matches[0]).toMatchObject(fields);
                    }
                }
                const shapeNamed = (name: string) =>
                    Object.values(document.shapes).find((shape) => shape.name === name);
                const variableNamed = (name: string) =>
                    Object.values(document.variables).find((variable) => variable.name === name);

                for (const [name, bindings] of Object.entries(expected.bindings ?? {})) {
                    for (const [field, variable] of Object.entries(bindings)) {
                        const target = variableNamed(variable);

                        expect(target).toBeDefined();
                        expect(shapeNamed(name)?.bindings?.[field]).toBe(target?.id);
                    }
                }
                for (const name of expected.unbound ?? []) {
                    expect(shapeNamed(name)).toBeDefined();
                    expect(Object.keys(shapeNamed(name)?.bindings ?? {})).toHaveLength(0);
                }
                for (const [name, variable] of Object.entries(expected.templates ?? {})) {
                    const shape = shapeNamed(name);
                    const target = variableNamed(variable);

                    expect(target).toBeDefined();
                    expect(shape?.type === 'text' ? shape.template : undefined).toContain(
                        `\u0024{${target?.id}$${target?.name}}`
                    );
                }

                return [];
            } catch (error) {
                return [error instanceof Error ? error.message : String(error)];
            }
        }
    };
}

/** Names as a person reads them, so `In stock` and `inStock` are the same field. */
const normalized = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

/** R5.5's bar: at least this share of the fields a case expects have the right type. */
export const FIELD_TYPE_ACCURACY = 0.9;

/**
 * A data case passes when the entity exists with the expected field types (at least 90% right,
 * matched by name), the expected number of records, no record failing validation, and a list
 * of the named instance's component bound to the entity.
 */
export function defineDataCase({
    expected,
    ...test
}: Omit<AiCase, 'check'> & {
    expected: {
        entity: string;
        fieldTypes: Record<string, DataType>;
        records: number;
        /** The component an instance repeating over the entity's records uses. */
        listComponent: string;
        /** Exact values some record must hold, by field name. */
        values?: Array<Record<string, DataValue>>;
    };
}): AiCase {
    return {
        ...test,
        check(document) {
            const entity = Object.values(document.dataEntities).find(
                ({ name }) => normalized(name) === normalized(expected.entity)
            );
            if (!entity) {
                return [`No entity named ${expected.entity}.`];
            }
            const problems: string[] = [];
            const fields = dataFields(document, entity.id);
            const field = (name: string) =>
                fields.find((each) => normalized(each.name) === normalized(name));
            const wrong = Object.entries(expected.fieldTypes).filter(
                ([name, type]) => field(name)?.type !== type
            );
            const total = Object.keys(expected.fieldTypes).length;
            if ((total - wrong.length) / total < FIELD_TYPE_ACCURACY) {
                problems.push(
                    `Field types right: ${total - wrong.length} of ${total}; wrong or missing: ${wrong
                        .map(
                            ([name, type]) =>
                                `${name} (${field(name)?.type ?? 'missing'}, not ${type})`
                        )
                        .join(', ')}.`
                );
            }
            const records = dataRecords(document, entity.id);
            if (records.length !== expected.records) {
                problems.push(`${records.length} records, not ${expected.records}.`);
            }
            problems.push(...dataProblems(document));
            for (const values of expected.values ?? []) {
                const found = records.some((record) =>
                    Object.entries(values).every(
                        ([name, value]) => record.values[field(name)?.id ?? ''] === value
                    )
                );
                if (!found) {
                    problems.push(`No record holds ${JSON.stringify(values)}.`);
                }
            }
            const list = Object.values(document.shapes).find(
                (shape) =>
                    shape.type === 'instance' &&
                    shape.componentId === expected.listComponent &&
                    shape.dataList?.entityId === entity.id &&
                    Object.keys(shape.dataList.fields).length > 0
            );
            if (!list) {
                problems.push(`No ${expected.listComponent} list is bound to ${entity.name}.`);
            }

            return problems;
        }
    };
}

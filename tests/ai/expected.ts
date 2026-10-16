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

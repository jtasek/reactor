import type { Variable } from 'src/app/types';
import { resolveVariable, resolveTemplate } from 'src/app/variableResolver';
import { templateProblems } from 'src/app/editorVariables';

const variables: Record<string, Variable> = {
    color: { id: 'color', name: 'Brand', type: 'color', values: { default: '#3366ff' } },
    number: { id: 'number', name: 'Count', type: 'number', values: { default: 0 } },
    boolean: { id: 'boolean', name: 'Enabled', type: 'boolean', values: { default: false } },
    text: { id: 'text', name: 'Person', type: 'text', values: { default: 'Ada' } },
    greeting: {
        id: 'greeting',
        name: 'Greeting',
        type: 'text',
        values: { default: 'Hi ${text$Person}: ${number}, ${boolean}, ${color}' }
    }
};

it('resolves the four types without coercing zero, false or empty text', () => {
    expect(resolveVariable(variables.color, variables)).toBe('#3366ff');
    expect(resolveVariable(variables.number, variables)).toBe(0);
    expect(resolveVariable(variables.boolean, variables)).toBe(false);
    expect(resolveVariable(variables.text, variables)).toBe('Ada');
    expect(
        resolveVariable(
            { id: 'empty', name: 'Empty', type: 'text', values: { default: '' } },
            variables
        )
    ).toBe('');
});

it('reads frozen definitions without materializing or rewriting templates', () => {
    const frozen = structuredClone(variables);
    Object.values(frozen).forEach((variable) => {
        Object.freeze(variable.values);
        Object.freeze(variable);
    });
    Object.freeze(frozen);

    expect(resolveVariable(frozen.greeting, frozen)).toBe('Hi Ada: 0, false, #3366ff');
    expect(resolveTemplate('${greeting}', frozen)).toBe('Hi Ada: 0, false, #3366ff');
    expect(frozen).toEqual(variables);
});

it('keeps ID precedence, deterministic duplicate-name lookup and the existing name fallback', () => {
    const duplicate: Record<string, Variable> = {
        z: { id: 'z', name: 'Person', type: 'text', values: { default: 'Last' } },
        a: { id: 'a', name: 'Person', type: 'text', values: { default: 'First' } }
    };

    expect(resolveTemplate('${z$Person} / ${Person} / ${gone$Person}', duplicate)).toBe(
        'Last / First / First'
    );
    expect(templateProblems('${z$Person} / ${Person} / ${gone$Person}', duplicate)).toEqual([]);
});

it('reports unresolved references and cycles in the same order as their visible placeholders', () => {
    const cyclic: Record<string, Variable> = {
        a: { id: 'a', name: 'A', type: 'text', values: { default: '${b$B}' } },
        b: { id: 'b', name: 'B', type: 'text', values: { default: '${a$A}' } }
    };
    const template = '\\${literal} ${gone$Missing} ${a$A} ${gone$Missing}';

    expect(resolveTemplate(template, cyclic)).toBe('${literal} ${Missing} ${A} ${Missing}');
    expect(templateProblems(template, cyclic)).toEqual(['Missing', 'A', 'Missing']);
    expect(resolveVariable(cyclic.a, cyclic)).toBe('${A}');
    expect(templateProblems(cyclic.a.values.default as string, cyclic, ['a'])).toEqual(['A']);
});

it('preserves the depth boundary for both a template and a variable as the root', () => {
    const chain: Record<string, Variable> = Object.fromEntries(
        Array.from({ length: 18 }, (_, index) => [
            `v${index}`,
            {
                id: `v${index}`,
                name: `V${index}`,
                type: 'text',
                values: { default: index === 17 ? 'End' : `\${v${index + 1}}` }
            }
        ])
    );

    expect(resolveTemplate('${v0}', chain)).toBe('${V16}');
    expect(templateProblems('${v0}', chain)).toEqual(['V16']);
    expect(resolveVariable(chain.v0, chain)).toBe('${V16}');
    expect(templateProblems(chain.v0.values.default as string, chain, ['v0'])).toEqual(['V16']);
});

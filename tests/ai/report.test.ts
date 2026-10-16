import { evaluationProblems, evaluationReport, type EvalSample } from './report';

const sample: EvalSample = {
    name: 'case',
    firstValid: true,
    finalValid: true,
    passed: true,
    firstOperationMs: 1000,
    durationMs: 2000,
    usage: { inputTokens: 1000, outputTokens: 100 },
    problems: []
};
const samples = () => Array.from({ length: 40 }, (_, index) => ({ ...sample, name: `${index}` }));
const report = (runs = samples()) => evaluationReport('openai', 'test-model', 'suite', runs);

it('reports nearest-rank latency, repairs, semantic failures and estimated cost separately', () => {
    const runs = samples();

    runs[0] = { ...runs[0], firstValid: false, durationMs: 9000 };
    runs[1] = { ...runs[1], passed: false };
    const result = evaluationReport('openai', 'test-model', 'suite', runs, {
        inputPerMillion: 2,
        outputPerMillion: 8
    });

    expect(result).toMatchObject({
        firstValidPercent: 97.5,
        finalValidPercent: 100,
        passedPercent: 97.5,
        firstOperationP50Ms: 1000,
        durationP95Ms: 2000,
        usage: { inputTokens: 40000, outputTokens: 4000 },
        estimatedCostUsd: 0.112
    });
    expect(evaluationProblems(result, report())).toEqual([]);
    runs[2] = { ...runs[2], passed: false };
    expect(evaluationProblems(report(runs), report())).toContain(
        'Semantic pass rate dropped by more than 3 percentage points.'
    );
});

it('does not report missing usage or latency as zero', () => {
    const result = report([{ ...sample, usage: null, firstOperationMs: null }]);

    expect(result.usage).toBeNull();
    expect(result.estimatedCostUsd).toBeNull();
    expect(result.firstOperationP50Ms).toBeNull();
    expect(evaluationProblems(result)).toContain('At least 40 cases are required.');
    expect(evaluationProblems(result)).toContain(
        'First operation p50 exceeds 2 seconds or is unavailable.'
    );
});

it('rejects an unrelated baseline and enforces validity and timing limits', () => {
    const runs = samples().map((run) => ({
        ...run,
        firstValid: false,
        finalValid: false,
        firstOperationMs: 2001,
        durationMs: 5001
    }));

    expect(evaluationProblems(report(runs), { ...report(), suite: 'another-suite' })).toHaveLength(
        5
    );
    expect(evaluationProblems(report(), { ...report(), kind: 'offline' } as never)).toContain(
        'Baseline must be a live report for the same provider and case suite.'
    );
});

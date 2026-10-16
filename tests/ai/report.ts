import type { Usage } from '../../server/aiTasks';

export interface EvalSample {
    name: string;
    firstValid: boolean;
    finalValid: boolean;
    passed: boolean;
    firstOperationMs: number | null;
    durationMs: number;
    usage: Usage | null;
    problems: string[];
}

export interface Pricing {
    inputPerMillion: number;
    outputPerMillion: number;
}

/** Nearest-rank percentile, with no invented value for an absent measurement. */
const percentile = (values: number[], percent: number) => {
    const sorted = [...values].sort((a, b) => a - b);

    return sorted[Math.ceil(sorted.length * percent) - 1] ?? null;
};

export function evaluationReport(
    provider: string,
    model: string,
    suite: string,
    samples: EvalSample[],
    pricing?: Pricing
) {
    const rate = (key: 'firstValid' | 'finalValid' | 'passed') =>
        samples.length
            ? (100 * samples.filter((sample) => sample[key]).length) / samples.length
            : 0;
    const usage =
        samples.length && samples.every((sample) => sample.usage !== null)
            ? samples.reduce(
                  (total, sample) => ({
                      inputTokens: total.inputTokens + sample.usage!.inputTokens,
                      outputTokens: total.outputTokens + sample.usage!.outputTokens
                  }),
                  { inputTokens: 0, outputTokens: 0 }
              )
            : null;

    return {
        kind: 'live' as const,
        provider,
        model,
        suite,
        cases: samples.length,
        firstValidPercent: rate('firstValid'),
        finalValidPercent: rate('finalValid'),
        passedPercent: rate('passed'),
        firstOperationP50Ms: percentile(
            samples.flatMap(({ firstOperationMs }) =>
                firstOperationMs === null ? [] : [firstOperationMs]
            ),
            0.5
        ),
        durationP95Ms: percentile(
            samples.map(({ durationMs }) => durationMs),
            0.95
        ),
        usage,
        pricing: pricing ?? null,
        // An estimate at supplied flat rates; cache discounts and provider fees are not inferred.
        estimatedCostUsd:
            usage && pricing
                ? (usage.inputTokens * pricing.inputPerMillion +
                      usage.outputTokens * pricing.outputPerMillion) /
                  1_000_000
                : null,
        samples
    };
}

export type EvalReport = ReturnType<typeof evaluationReport>;

/** R2's automated gates; usage by ten people remains a separate, human gate. */
export function evaluationProblems(report: EvalReport, baseline?: EvalReport): string[] {
    const problems: string[] = [];

    if (report.cases < 40) problems.push('At least 40 cases are required.');
    if (report.firstValidPercent < 90) problems.push('First-try validity is below 90%.');
    if (report.finalValidPercent < 97) problems.push('Validity after one repair is below 97%.');
    if (report.passedPercent < 97)
        problems.push('Fewer than 97% of cases satisfy the requested edit.');
    if (report.firstOperationP50Ms === null || report.firstOperationP50Ms > 2000) {
        problems.push('First operation p50 exceeds 2 seconds or is unavailable.');
    }
    if (report.durationP95Ms === null || report.durationP95Ms > 5000) {
        problems.push('Completion p95 exceeds 5 seconds or is unavailable.');
    }
    if (baseline) {
        if (
            baseline.kind !== 'live' ||
            baseline.suite !== report.suite ||
            baseline.provider !== report.provider ||
            baseline.cases !== report.cases ||
            !Number.isFinite(baseline.passedPercent)
        ) {
            problems.push('Baseline must be a live report for the same provider and case suite.');
        } else if (baseline.passedPercent - report.passedPercent > 3) {
            problems.push('Semantic pass rate dropped by more than 3 percentage points.');
        }
    }

    return problems;
}

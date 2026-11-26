export type Smoothing = 'off' | 'low' | 'high';

export const DEFAULT_SMOOTHING: Smoothing = 'low';

export const SMOOTHING_KEY = 'reactor:pencil-smoothing';

export const readSmoothing = (value: unknown): Smoothing =>
    value === 'off' || value === 'high' ? value : DEFAULT_SMOOTHING;

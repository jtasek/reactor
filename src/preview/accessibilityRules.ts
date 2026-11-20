/** WCAG 2.2 AA thresholds the accessibility check holds text to, and how much it checks. */
export interface AccessibilityRules {
    /** Least contrast for text below the large sizes. */
    textContrast: number;
    /** Least contrast for large text. */
    largeTextContrast: number;
    /** Text this size or larger is large. */
    largeTextSize: number;
    /** Bold text (weight 700 or more) this size or larger is large. */
    largeBoldTextSize: number;
    /** The most mode and size combinations one check or download covers. */
    maxContexts: number;
}

export const DEFAULT_ACCESSIBILITY_RULES: AccessibilityRules = {
    textContrast: 4.5,
    largeTextContrast: 3,
    largeTextSize: 24,
    largeBoldTextSize: 18.66,
    maxContexts: 16
};

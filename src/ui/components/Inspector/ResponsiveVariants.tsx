import React, { useState } from 'react';
import type { Component } from 'src/app/types';
import { useActions } from 'src/app/hooks';
import styles from './styles.css';

/** Author rules on the family; choosing Auto remains an explicit instance action. */
export function ResponsiveVariants({
    component,
    readOnly,
    variants
}: {
    component: Component;
    readOnly: boolean;
    variants: { id: string; name: string }[];
}) {
    const { setResponsiveVariants } = useActions();
    const saved = component.responsiveVariants ?? { source: 'screen' as const, rules: [] };
    const [source, setSource] = useState(saved.source);
    const [rules, setRules] = useState(
        saved.rules.map((rule) => ({ ...rule, minWidth: String(rule.minWidth) }))
    );
    const changed =
        source !== saved.source ||
        JSON.stringify(rules) !==
            JSON.stringify(
                saved.rules.map((rule) => ({ ...rule, minWidth: String(rule.minWidth) }))
            );
    const thresholds = rules.map((rule) => Number(rule.minWidth));
    const invalid = rules.some(
        (rule) =>
            rule.minWidth.trim() === '' ||
            !Number.isFinite(Number(rule.minWidth)) ||
            Number(rule.minWidth) < 0 ||
            !variants.some((variant) => variant.id === rule.variantId)
    );
    const duplicate = new Set(thresholds).size !== thresholds.length;

    return (
        <section className={styles.responsiveRules} aria-label="Responsive variants">
            <h4>Automatic selection</h4>
            <p className={styles.componentHint}>
                Instances set to Auto use the highest matching minimum width. Below all rules they
                use the default.
            </p>
            <div className={styles.responsiveRules}>
                <div className={styles.responsiveField}>
                    <label htmlFor="variant-width-source">Measure</label>
                    <select
                        id="variant-width-source"
                        value={source}
                        disabled={readOnly}
                        onChange={(event) => setSource(event.target.value as typeof source)}
                    >
                        <option value="screen">Screen view width</option>
                        <option value="parent">Parent inner width</option>
                    </select>
                </div>
                {rules.map((rule, index) => (
                    <div className={styles.responsiveRule} key={index}>
                        <div className={styles.responsiveField}>
                            <label htmlFor={`variant-min-${index}`}>Minimum width (px)</label>
                            <input
                                id={`variant-min-${index}`}
                                type="number"
                                min="0"
                                value={rule.minWidth}
                                disabled={readOnly}
                                onChange={(event) =>
                                    setRules(
                                        rules.map((item, at) =>
                                            at === index
                                                ? { ...item, minWidth: event.target.value }
                                                : item
                                        )
                                    )
                                }
                            />
                        </div>
                        <div className={styles.responsiveField}>
                            <label htmlFor={`variant-source-${index}`}>Use variant</label>
                            <select
                                id={`variant-source-${index}`}
                                value={rule.variantId}
                                disabled={readOnly}
                                onChange={(event) =>
                                    setRules(
                                        rules.map((item, at) =>
                                            at === index
                                                ? { ...item, variantId: event.target.value }
                                                : item
                                        )
                                    )
                                }
                            >
                                {!variants.some((variant) => variant.id === rule.variantId) && (
                                    <option value={rule.variantId}>Unavailable variant</option>
                                )}
                                {variants.map((variant) => (
                                    <option key={variant.id} value={variant.id}>
                                        {variant.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className={styles.variantActions}>
                            <button
                                type="button"
                                disabled={readOnly}
                                onClick={() => setRules(rules.filter((_, at) => at !== index))}
                            >
                                Remove rule {index + 1}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
            {(invalid || duplicate) && (
                <p role="alert" className={styles.componentHint}>
                    {duplicate
                        ? 'Minimum widths must be different.'
                        : 'Choose an available variant and a minimum width of zero or greater.'}
                </p>
            )}
            <div className={styles.variantActions}>
                <button
                    type="button"
                    disabled={readOnly || variants.length === 0}
                    onClick={() =>
                        setRules([
                            ...rules,
                            {
                                minWidth: '',
                                variantId: variants[0].id
                            }
                        ])
                    }
                >
                    Add width rule
                </button>
                <button
                    type="button"
                    disabled={readOnly || !changed || invalid || duplicate}
                    onClick={() =>
                        setResponsiveVariants({
                            componentId: component.id,
                            settings: {
                                source,
                                rules: rules.map((rule) => ({
                                    ...rule,
                                    minWidth: Number(rule.minWidth)
                                }))
                            }
                        })
                    }
                >
                    Save rules
                </button>
            </div>
        </section>
    );
}

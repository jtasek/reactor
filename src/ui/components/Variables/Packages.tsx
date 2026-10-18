import React, { useEffect, useRef, useState } from 'react';
import { json } from 'overmind';
import { useActions, useCurrentDocument, useEffects } from 'src/app/hooks';
import {
    exportDesignSystemPackage,
    packageMatches,
    parseDesignSystemPackage,
    planDesignSystemImport,
    PACKAGE_MAX_BYTES
} from 'src/app/designSystemPackages';
import type { DesignSystemPackage, ImportChoice } from 'src/app/designSystemPackages';
import styles from './styles.css';

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

function PackageControls() {
    const document = useCurrentDocument();
    const { applyOperations } = useActions();
    const { newId } = useEffects();
    const input = useRef<HTMLInputElement>(null);
    const reading = useRef(0);
    const [data, setData] = useState<DesignSystemPackage>();
    const [choice, setChoice] = useState<ImportChoice>('reuse');
    const [problem, setProblem] = useState('');
    const [notice, setNotice] = useState('');
    useEffect(
        () => () => {
            reading.current++;
        },
        []
    );
    const snapshot = {
        id: document.id,
        variables: json(document.variables),
        dimensions: json(document.dimensions)
    };
    const exportPackage = () => {
        try {
            const text = exportDesignSystemPackage(json(document));
            const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
            const link = window.document.createElement('a');
            link.href = url;
            link.download = 'design-system.reactor.json';
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 0);
            setProblem('');
        } catch (error) {
            setProblem(message(error));
        }
    };
    const load = async (file: File | undefined) => {
        const request = ++reading.current;
        setData(undefined);
        setProblem('');
        setNotice('');
        if (!file) return;
        try {
            if (file.size > PACKAGE_MAX_BYTES) throw new Error('The package is larger than 1 MiB.');
            const text = await file.text();
            if (request !== reading.current) return;
            setData(parseDesignSystemPackage(text));
            setChoice('reuse');
        } catch (error) {
            if (request === reading.current) setProblem(message(error));
        }
    };
    const apply = () => {
        if (!data) return;
        try {
            const operations = planDesignSystemImport(json(document), data, choice, newId);
            if (!operations.length) {
                setNotice('Existing definitions reused; nothing changed.');
            } else {
                const result = applyOperations({
                    documentId: document.id,
                    by: { kind: 'person' },
                    operations
                });
                if (!result.applied) throw new Error(result.problem);
                setNotice('Design system imported. Undo restores the previous definitions.');
            }
            setData(undefined);
            setProblem('');
        } catch (error) {
            setProblem(message(error));
        }
    };
    return (
        <details className={styles.dimensions}>
            <summary>Design-system import / export</summary>
            <div className={styles.dimension}>
                <div className={styles.rowHeader}>
                    <button type="button" onClick={exportPackage}>
                        Export design system
                    </button>
                    <button
                        type="button"
                        disabled={document.locked}
                        onClick={() => input.current?.click()}
                    >
                        Import design system
                    </button>
                    <input
                        ref={input}
                        hidden
                        type="file"
                        accept=".json,application/json"
                        aria-label="Design-system package"
                        onChange={(event) => {
                            void load(event.target.files?.[0]);
                            event.target.value = '';
                        }}
                    />
                </div>
                {data && (
                    <>
                        <strong>{data.name}</strong>
                        <span>
                            {data.variables.length} variables · {data.dimensions.length} dimensions
                        </span>
                        <p className={styles.resolution}>
                            Review matches below. Nothing changes until you import.
                        </p>
                        <ul aria-label="Import preview">
                            {data.dimensions.map((dimension) => {
                                const matches = packageMatches(
                                    dimension,
                                    snapshot.dimensions,
                                    snapshot.id
                                );
                                return (
                                    <li key={`dimension:${dimension.id}`} className={styles.row}>
                                        Dimension: {dimension.name} —{' '}
                                        {matches.length
                                            ? `matches ${matches.map((d) => d.name).join(', ')}`
                                            : 'new'}
                                    </li>
                                );
                            })}
                            {data.variables.map((variable) => {
                                const matches = packageMatches(
                                    variable,
                                    snapshot.variables,
                                    snapshot.id
                                );
                                return (
                                    <li key={variable.id} className={styles.row}>
                                        {variable.name} ({variable.type}) —{' '}
                                        {matches.length
                                            ? `matches ${matches.map((v) => v.name).join(', ')}`
                                            : 'new'}
                                    </li>
                                );
                            })}
                        </ul>
                        <label className={styles.field}>
                            <span>Matches</span>
                            <select
                                className={styles.source}
                                aria-label="Import conflict handling"
                                value={choice}
                                onChange={(event) => setChoice(event.target.value as ImportChoice)}
                            >
                                <option value="reuse">Reuse existing</option>
                                <option value="replace">Replace existing</option>
                                <option value="separate">Import separately</option>
                            </select>
                        </label>
                        <p className={styles.resolution}>
                            {choice === 'reuse'
                                ? 'Keep matching local definitions. Add new tokens and connect their references to the matches.'
                                : choice === 'replace'
                                  ? 'Replace matching definitions, including their names and values. Bound shapes will update.'
                                  : 'Add independent copies with unique names. Keep all existing definitions.'}
                        </p>
                        <div className={styles.rowHeader}>
                            <button type="button" disabled={document.locked} onClick={apply}>
                                Apply import
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setData(undefined);
                                    setProblem('');
                                }}
                            >
                                Cancel import
                            </button>
                        </div>
                    </>
                )}
                {problem && (
                    <p role="alert" className={styles.problem}>
                        {problem}
                    </p>
                )}
                {notice && (
                    <p role="status" className={styles.resolution}>
                        {notice}
                    </p>
                )}
            </div>
        </details>
    );
}

export function Packages() {
    const document = useCurrentDocument();
    return <PackageControls key={document.id} />;
}

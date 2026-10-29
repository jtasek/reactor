import {
    exportDesignTokenInterchange,
    parseDesignTokenInterchange
} from 'src/app/designTokenInterchange';
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
import { Dialog } from '../Dialog';

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

function PackageControls({ mode, onClose }: { mode: 'import' | 'export'; onClose: () => void }) {
    const document = useCurrentDocument();
    const { applyOperations } = useActions();
    const { newId } = useEffects();
    const input = useRef<HTMLInputElement>(null);
    const reading = useRef(0);
    const [data, setData] = useState<DesignSystemPackage>();
    const [choice, setChoice] = useState<ImportChoice>('reuse');
    const [format, setFormat] = useState<'native' | 'dtcg'>('native');
    const [problem, setProblem] = useState('');
    const [notice, setNotice] = useState('');
    const status = useRef<HTMLParagraphElement>(null);
    useEffect(() => {
        if (notice) {
            status.current?.focus();
        }
    }, [notice]);
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
            const text =
                format === 'native'
                    ? exportDesignSystemPackage(json(document))
                    : exportDesignTokenInterchange(json(document));
            const url = URL.createObjectURL(
                new Blob([text], {
                    type:
                        format === 'native' ? 'application/json' : 'application/design-tokens+json'
                })
            );
            const link = window.document.createElement('a');
            link.href = url;
            link.download =
                format === 'native' ? 'design-system.reactor.json' : 'design-system.tokens.json';
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
        if (!file) {
            return;
        }
        try {
            if (file.size > PACKAGE_MAX_BYTES) {
                throw new Error('The package is larger than 1 MiB.');
            }
            const text = await file.text();
            if (request !== reading.current) {
                return;
            }
            setData(
                format === 'native'
                    ? parseDesignSystemPackage(text)
                    : parseDesignTokenInterchange(text, file.name)
            );
            setChoice('reuse');
        } catch (error) {
            if (request === reading.current) {
                setProblem(message(error));
            }
        }
    };
    const apply = () => {
        if (!data) {
            return;
        }
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
                if (!result.applied) {
                    throw new Error(result.problem);
                }
                setNotice('Design system imported. Undo restores the previous definitions.');
            }
            setData(undefined);
            setProblem('');
        } catch (error) {
            setProblem(message(error));
        }
    };

    return (
        <Dialog
            visible
            title={mode === 'import' ? 'Import design system' : 'Export design system'}
            description={
                mode === 'import'
                    ? 'Choose a file and review its definitions before applying changes.'
                    : 'Download variables, dimensions and modes in your chosen format.'
            }
            onClose={onClose}
            actions={
                mode === 'export' ? (
                    <>
                        <button type="button" onClick={onClose}>
                            Close
                        </button>
                        <button type="button" data-variant="primary" onClick={exportPackage}>
                            Export design system
                        </button>
                    </>
                ) : data ? (
                    <>
                        <button type="button" onClick={onClose}>
                            Cancel import
                        </button>
                        <button
                            type="button"
                            data-variant="primary"
                            disabled={document.locked}
                            onClick={apply}
                        >
                            Apply import
                        </button>
                    </>
                ) : undefined
            }
        >
            <div className={`${styles.variables} ${styles.packageContent}`}>
                <label className={styles.field}>
                    <span>Format</span>
                    <select
                        className={styles.source}
                        aria-label="Design-system format"
                        value={format}
                        onChange={(event) => {
                            reading.current++;
                            setFormat(event.target.value === 'dtcg' ? 'dtcg' : 'native');
                            setData(undefined);
                            setProblem('');
                            setNotice('');
                        }}
                    >
                        <option value="native">Reactor (all definitions)</option>
                        <option value="dtcg">DTCG (colors / numbers)</option>
                    </select>
                </label>
                {format === 'dtcg' && (
                    <p className={styles.resolution}>
                        Supports opaque sRGB as 8-bit colors, unitless numbers and aliases.
                        Unsupported definitions reject the whole file. Use Reactor format for modes,
                        text and booleans.
                    </p>
                )}
                {mode === 'import' && (
                    <div className={styles.rowHeader}>
                        <button
                            type="button"
                            disabled={document.locked}
                            onClick={() => input.current?.click()}
                        >
                            Choose file…
                        </button>
                        <input
                            ref={input}
                            hidden
                            type="file"
                            accept=".json,.tokens,application/json,application/design-tokens+json"
                            aria-label="Design-system package"
                            onChange={(event) => {
                                void load(event.target.files?.[0]);
                                event.target.value = '';
                            }}
                        />
                    </div>
                )}
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
                    </>
                )}
                {problem && (
                    <p role="alert" className={styles.problem}>
                        {problem}
                    </p>
                )}
                {notice && (
                    <p ref={status} tabIndex={-1} role="status" className={styles.resolution}>
                        {notice}
                    </p>
                )}
            </div>
        </Dialog>
    );
}

export function Packages({ mode, onClose }: { mode: 'import' | 'export'; onClose: () => void }) {
    const document = useCurrentDocument();

    return <PackageControls key={`${document.id}-${mode}`} mode={mode} onClose={onClose} />;
}

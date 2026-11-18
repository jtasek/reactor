import React, { useEffect, useId, useRef, useState } from 'react';
import type { Document } from 'src/app/types';
import type { DataField, DataRecord } from 'src/app/dataTypes';
import { fieldChoices } from 'src/app/data';
import { checkRecordDraft } from 'src/preview/recordForms';
import { Dialog } from '../Dialog/Dialog';
import styles from './recordForm.css';

export function RecordForm({
    record,
    document,
    fields,
    entityName,
    close,
    save
}: {
    record: DataRecord;
    /** Includes this session's saved records, so references show their current names. */
    document: Document;
    fields: DataField[];
    entityName: string;
    close: () => void;
    save: (draft: Record<string, string>, signal: AbortSignal) => Promise<Record<string, string>>;
}) {
    const id = useId();
    const [initial] = useState(() => JSON.stringify([record, fields]));
    const [draft, setDraft] = useState(() =>
        Object.fromEntries(fields.map((field) => [field.id, String(record.values[field.id] ?? '')]))
    );
    const [problems, setProblems] = useState<Record<string, string>>({});
    const [pending, setPending] = useState(false);
    const controller = useRef<AbortController | null>(null);
    const changed = initial !== JSON.stringify([record, fields]);
    useEffect(() => () => controller.current?.abort(), []);

    return (
        <Dialog
            visible
            title={`Edit ${entityName} record`}
            description="Changes apply only to this Prototype session. Restart restores the sample records."
            onClose={close}
            actions={
                <>
                    <button type="button" onClick={close}>
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form={id}
                        data-variant="primary"
                        disabled={pending || changed || !fields.length}
                    >
                        {pending ? 'Saving…' : 'Save'}
                    </button>
                </>
            }
        >
            <form
                id={id}
                className={styles.form}
                noValidate
                onSubmit={async (event) => {
                    event.preventDefault();
                    if (pending || changed) {
                        return;
                    }
                    const request = new AbortController();
                    controller.current = request;
                    setPending(true);
                    try {
                        const errors = await save(draft, request.signal);
                        if (request.signal.aborted) {
                            return;
                        }
                        if (!Object.keys(errors).length) {
                            close();

                            return;
                        }
                        setProblems(errors);
                    } catch (error) {
                        if (!request.signal.aborted) {
                            setProblems({
                                record:
                                    error instanceof Error
                                        ? error.message
                                        : 'Could not save the record.'
                            });
                        }
                    } finally {
                        if (!request.signal.aborted) {
                            setPending(false);
                        }
                    }
                }}
            >
                {changed && (
                    <p role="alert">
                        This record or its fields changed. Cancel and reopen the form.
                    </p>
                )}
                {problems.record && <p role="alert">{problems.record}</p>}
                {!fields.length && <p>Add fields in Data first.</p>}
                {fields.map((field) => {
                    const fieldId = `${id}-${field.id}`;
                    const common = {
                        id: fieldId,
                        value: draft[field.id] ?? '',
                        disabled: pending || changed,
                        'aria-required': field.required,
                        'aria-invalid': Boolean(problems[field.id]),
                        'aria-describedby': problems[field.id] ? `${fieldId}-error` : undefined,
                        onChange: (
                            event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
                        ) => {
                            const next = { ...draft, [field.id]: event.target.value };
                            setDraft(next);
                            // Only messages already shown are updated, so typing never nags.
                            setProblems((previous) => {
                                if (!Object.values(previous).some(Boolean)) {
                                    return previous;
                                }
                                const current = checkRecordDraft(
                                    document,
                                    record.entityId,
                                    next
                                ).problems;

                                return Object.fromEntries(
                                    Object.keys(previous).map((key) => [key, current[key] ?? ''])
                                );
                            });
                        }
                    };

                    return (
                        <div key={field.id} className={styles.field}>
                            <label htmlFor={fieldId}>
                                {field.name}
                                <span>
                                    {field.type}
                                    {field.required ? ' · Required' : ''}
                                </span>
                            </label>
                            {field.type === 'boolean' ? (
                                <select {...common}>
                                    <option value="">Not set</option>
                                    <option value="true">True</option>
                                    <option value="false">False</option>
                                    {draft[field.id] &&
                                        !['true', 'false'].includes(draft[field.id]) && (
                                            <option value={draft[field.id]}>
                                                {draft[field.id]} (invalid)
                                            </option>
                                        )}
                                </select>
                            ) : field.type === 'choice' || field.type === 'reference' ? (
                                <ChoiceSelect {...common} choices={fieldChoices(document, field)} />
                            ) : (
                                <input
                                    {...common}
                                    inputMode={field.type === 'number' ? 'decimal' : undefined}
                                />
                            )}
                            {problems[field.id] && (
                                <p id={`${fieldId}-error`} role="alert">
                                    {problems[field.id]}
                                </p>
                            )}
                        </div>
                    );
                })}
            </form>
        </Dialog>
    );
}

/** A value that is no longer offered stays selectable, marked, so opening a form never changes it. */
function ChoiceSelect({
    choices,
    ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
    value: string;
    choices: { value: string; label: string }[];
}) {
    return (
        <select {...props}>
            <option value="">Not set</option>
            {choices.map((choice) => (
                <option key={choice.value} value={choice.value}>
                    {choice.label}
                </option>
            ))}
            {props.value && !choices.some((choice) => choice.value === props.value) && (
                <option value={props.value}>{props.value} (unavailable)</option>
            )}
        </select>
    );
}

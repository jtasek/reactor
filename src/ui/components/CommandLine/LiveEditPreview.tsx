import React, { useEffect, useState } from 'react';
import { useAppState } from 'src/app/hooks';
import { previewEdit } from './editPreview';
import { SELECTION_PATTERN } from './selection';
import styles from './styles.css';

/** Delay typing work, but track live selection and value changes through the store. */
export function LiveEditPreview({ input }: { input: string }) {
    const [settled, setSettled] = useState('');
    useEffect(() => {
        const timer = setTimeout(() => setSettled(input), 120);

        return () => clearTimeout(timer);
    }, [input]);
    const preview = useAppState((state) =>
        input === settled ? previewEdit(input, state) : undefined
    );
    if (!SELECTION_PATTERN.test(input.trim())) {
        return null;
    }
    if (input !== settled) {
        return <small>Checking edit…</small>;
    }
    if (!preview) {
        return null;
    }

    return (
        <section className={styles.editPreview} aria-label="Edit preview">
            <strong>Before you apply</strong>
            {preview.problem ? (
                <p role="status">{preview.problem}</p>
            ) : (
                <>
                    <p>
                        {preview.items.length === 0
                            ? 'No values would change.'
                            : `${preview.items.length} ${preview.items.length === 1 ? 'object' : 'objects'} will change. Nothing has been applied.`}
                    </p>
                    {preview.items.slice(0, 8).map((item, index) => (
                        <div key={index}>
                            <strong>{item.name}</strong>
                            {item.changes.map((change, index) => (
                                <p key={index}>{change}</p>
                            ))}
                        </div>
                    ))}
                    {preview.items.length > 8 && (
                        <p>And {preview.items.length - 8} more objects.</p>
                    )}
                    <small>
                        Stored values are shown; inherited modes still resolve on the canvas. Apply
                        creates one undo step.
                    </small>
                </>
            )}
        </section>
    );
}

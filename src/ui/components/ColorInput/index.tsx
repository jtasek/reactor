import React, { FC, InputHTMLAttributes, lazy, Suspense, useRef, useState } from 'react';

// Loads the first time an editor opens. Unnamed, so the startup runtime's chunk map grows least.
const ColorEditor = lazy(() =>
    import('./ColorEditor').then((module) => ({ default: module.ColorEditor }))
);

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> & {
    value: string;
    /** Names the editor that opens, such as "Fill". */
    label: string;
    onValue: (value: string) => void;
};

/**
 * A color field that opens Reactor's color editor instead of the browser's picker.
 * The field stays a native color input, so its value, label and form behavior are unchanged.
 */
export const ColorInput: FC<Props> = ({ value, label, onValue, disabled, ...props }) => {
    const input = useRef<HTMLInputElement>(null);
    const [open, setOpen] = useState(false);
    // Pressing the field while the editor is open closes it (light dismiss); it should not reopen.
    const openOnPress = useRef(false);

    return (
        <>
            <input
                {...props}
                ref={input}
                type="color"
                value={value}
                disabled={disabled}
                aria-haspopup="dialog"
                onChange={(event) => onValue(event.target.value)}
                onPointerDown={(event) => {
                    openOnPress.current = open;
                    props.onPointerDown?.(event);
                }}
                onClick={(event) => {
                    // Keeps the browser's own picker closed; Enter and Space click too.
                    event.preventDefault();
                    if (!openOnPress.current && !disabled) {
                        setOpen(true);
                    }
                    openOnPress.current = false;
                    props.onClick?.(event);
                }}
            />
            {open && (
                <Suspense fallback={null}>
                    <ColorEditor
                        anchor={input}
                        label={label}
                        value={value}
                        onValue={onValue}
                        onClose={() => setOpen(false)}
                    />
                </Suspense>
            )}
        </>
    );
};

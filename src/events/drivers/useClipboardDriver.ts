/** Copying, cutting and pasting shapes; not implemented yet. */
export const useClipboardDriver = () => {
    const handleCopy: (event: ClipboardEvent) => void = () => {};
    const handleCut: (event: ClipboardEvent) => void = () => {};
    const handlePaste: (event: ClipboardEvent) => void = () => {};

    return {
        handleCopy,
        handleCut,
        handlePaste
    };
};

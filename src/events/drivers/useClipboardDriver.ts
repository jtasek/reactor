import { useActions } from 'src/app/hooks';

export const useKeyboardDriver = () => {
    const actions = useActions();

    const handleCopy = (event: ClipboardEvent) => {};
    const handleCut = (event: ClipboardEvent) => {};
    const handlePaste = (event: ClipboardEvent) => {};

    return {
        handleCopy,
        handleCut,
        handlePaste
    };
};

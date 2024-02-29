import React, { FC } from 'react';

import { useCamera, useControls, useCurrentDocument, useKeyboard, usePointer } from 'src/app/hooks';

import { ZoomSlider } from './ZoomSlider';
import { StatusBarSlot } from './StatusBarSlot';
import { StatusBar } from './StatusBar';

export const KeyboardInfo: FC = () => {
    const keyboard = useKeyboard();

    const result: string[] = [];
    result.push('keyboard: [');

    if (keyboard.altKey) {
        result.push('ALT +');
    }
    if (keyboard.ctrlKey) {
        result.push('CTRL + ');
    }
    if (keyboard.shiftKey) {
        result.push('SHIFT + ');
    }

    result.push(keyboard.key);
    result.push(']');

    return <span>{result.join(' ')}</span>;
};

export const StatusBarContainer: FC = () => {
    const { position: offset, scale } = useCamera();
    const { name, selectedShapesIds } = useCurrentDocument();
    const { statusBar } = useControls();
    const { current } = usePointer();

    if (!statusBar.visible) {
        return null;
    }

    const selectedShapeCount = selectedShapesIds?.length;

    return (
        <StatusBar>
            <StatusBarSlot name="message">{name}</StatusBarSlot>
            <StatusBarSlot name="selection">{`selection: [${selectedShapeCount}]`}</StatusBarSlot>
            <StatusBarSlot name="keyboard">
                <KeyboardInfo />
            </StatusBarSlot>
            <StatusBarSlot name="mouse">{`mouse: [${current.x}, ${current.y}]`}</StatusBarSlot>
            <StatusBarSlot name="camera">{`camera: [${offset.x}, ${offset.y}, ${scale}]`}</StatusBarSlot>
            <StatusBarSlot name="tools">
                <ZoomSlider />
            </StatusBarSlot>
        </StatusBar>
    );
};

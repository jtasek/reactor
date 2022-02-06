import React, { FC } from 'react';

import { useAppState } from 'src/app/hooks';

import { ZoomSlider } from './ZoomSlider';
import { StatusBarSlot } from './StatusBarSlot';
import { StatusBar } from './StatusBar';

export const KeyboardInfo: FC = () => {
  const { keyboard } = useAppState().events;

  const result: string[] = [];
  result.push('keyboard: [');
  result.push(keyboard.key);
  if (keyboard.altKey) {
    result.push('+ ALT');
  }
  if (keyboard.ctrlKey) {
    result.push('+ CTRL');
  }
  if (keyboard.shiftKey) {
    result.push('+ SHIFT');
  }
  result.push(']');

  return <span>{result.join(' ')}</span>;
};

export const StatusBarContainer: FC = () => {
  const { currentDocument, ui, events } = useAppState();

  const visible = ui.statusBar.visible;
  if (!visible) {
    return null;
  }

  const position = events.pointer.position;
  const offset = events.pointer.offset;
  const selectedShapeCount = currentDocument.selectedShapesIds?.length;
  const documentName = currentDocument.name;

  return (
    <StatusBar>
      <StatusBarSlot name="message">{documentName}</StatusBarSlot>
      <StatusBarSlot name="selection">{`selection: [${selectedShapeCount}]`}</StatusBarSlot>
      <StatusBarSlot name="keyboard">
        <KeyboardInfo />
      </StatusBarSlot>
      <StatusBarSlot name="mouse">{`position: [${position.x}, ${position.y}]`}</StatusBarSlot>
      <StatusBarSlot name="offset">{`offset: [${offset.x}, ${offset.y}]`}</StatusBarSlot>
      <StatusBarSlot name="tools">
        <ZoomSlider />
      </StatusBarSlot>
    </StatusBar>
  );
};

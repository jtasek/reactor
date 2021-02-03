import React, { FC } from 'react';

import { useState } from 'src/app/hooks';

import { ZoomSlider } from './ZoomSlider';
import { StatusBarSlot } from './StatusBarSlot';
import { StatusBar } from './StatusBar';

export const StatusBarContainer: FC = () => {
  const { currentDocument, ui, events } = useState();

  const visible = ui.statusBar.visible;
  if (!visible) {
    return null;
  }

  const position = events.pointer.position;
  const offset = events.pointer.offset;
  const selectedShapeCount = currentDocument.selectedShapes?.length;
  const documentName = currentDocument.name;

  return (
    <StatusBar>
      <StatusBarSlot name="message">{documentName}</StatusBarSlot>
      <StatusBarSlot name="selection">{`selection: ${selectedShapeCount}`}</StatusBarSlot>
      <StatusBarSlot name="position">{`position: [${position.x}, ${position.y}]`}</StatusBarSlot>
      <StatusBarSlot name="offset">{`offset: [${offset.x}, ${offset.y}]`}</StatusBarSlot>
      <StatusBarSlot name="tools">
        <ZoomSlider />
      </StatusBarSlot>
    </StatusBar>
  );
};

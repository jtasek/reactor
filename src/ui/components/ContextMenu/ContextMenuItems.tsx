import React, { FC } from 'react';
import { useActions, useAppState } from 'src/app/hooks';
import { useTools } from 'src/tools/components';
import { Tool } from 'src/tools/types';

import { ContextMenuItem } from './ContextMenuItem';

function getInlineStyle(size: number, angle: number, active: boolean) {
  return {
    backgroundColor: `rgba(0, 0, 0, ${active ? 0.7 : 0.5})`,
    color: `hsl(${angle}, 100%, ${active ? '75%' : '100%'})`,
    // Rotate the axis
    // Move the item from the center
    // Rotate the item back to its default position
    transform: `rotate(${angle}deg) translate(${size / 2.5}em) rotate(-${angle}deg)`
  };
}

function* angles(count: number): Generator<number> {
  let index = 0;
  let rotation = 0;
  const angle = 360 / count;

  while (index < count) {
    index++;
    yield (rotation += angle);
  }
}

interface Props {
  items: Tool[];
}

export const ContextMenuItems: FC<Props> = ({ items }) => {
  const { tools } = useActions();
  const anglegen = angles(items.length);

  return (
    <>
      {Object.values(items).map((item) => {
        const angle = anglegen.next().value;
        const style = getInlineStyle(12, angle, false);

        return (
          <ContextMenuItem
            key={item.code}
            tool={item}
            inlineStyles={style}
            onClick={() => tools.activateTool(item.code)}
          />
        );
      })}
    </>
  );
};

export const ConnectedContextMenuItems: FC = () => {
  const tools = useTools();

  return <ContextMenuItems items={tools} />;
};

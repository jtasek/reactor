import React, { FC } from 'react';
import { useState } from 'src/app/hooks';
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
  tools: Tool[];
}

export const ContextMenuItems: FC<Props> = ({ tools }) => {
  const count = Object.keys(tools).length;
  const anglegen = angles(count);

  return (
    <>
      {Object.keys(tools).map((name, index) => {
        const angle = anglegen.next().value;
        const tool = tools[name];
        const style = getInlineStyle(15, angle, tool.active);

        return (
          <ContextMenuItem
            key={index}
            tool={tool}
            inlineStyles={style}
            onClick={() => console.log('not implemented')}
          />
        );
      })}
    </>
  );
};

export const ConnectedContextMenuItems: FC = () => {
  // const { commands } = useState().tools;

  return <ContextMenuItems tools={[]} />;
};

import React, { FC } from 'react';

import styles from '../../styles.css';
import type { Tool } from 'src/tools/types';
import { Command } from 'src/app/types';
import { Context } from 'src/app/hooks';

/**
 * Insert image based on current coords
 * Select from library or upload to librarys
 
<image 
    x="the x-axis top-left corner of the image"
    y="the y-axis top-left corner of the image"
    width="the width of the image. Required."
    height="the height of the image. Required."
    xlink:href="the path to the image. Required." 
/>
 
 **/

interface Props {
  key: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  href: string;
  selected: boolean;
  type: string;
}

export const createImageProps = ({ state }: Context, designMode = false) => {
  const { startPosition, scaledStartPosition, size, scaledSize } = state.events.pointer;

  return {
    key: 'image-x',
    x: designMode ? scaledStartPosition.x : startPosition.x,
    y: designMode ? scaledStartPosition.y : startPosition.y,
    width: designMode ? scaledSize.width : size.width,
    height: designMode ? scaledSize.height : size.height,
    href: '/images/avatar.jpg',
    name: 'Image x',
    selected: true,
    type: 'image'
  };
};

export const Image: FC<Props> = ({ name, x, y, width, height, href, selected }) => {
  const className = selected ? `${styles.shape} ${styles.selected}` : styles.shape;

  return (
    <image
      key="image"
      className={className}
      data-cy={name}
      x={x}
      y={y}
      height={height}
      //width={width}
      xlinkHref={href}
    />
  );
};

export const DesignImage: FC<Props> = ({
  code,
  x,
  y,
  width,
  height,
  href,
  name,
  selected,
  type
}) => {
  return (
    <Image
      code={code}
      key="image"
      x={x}
      y={y}
      height={height}
      width={width}
      href={href}
      selected={selected}
      name={name}
      type={type}
    />
  );
};

export const ImageCommand: Command = {
  id: 'image',
  name: 'Image',
  category: 'shapes',
  description: 'Draws an image shape',
  icon: {
    group: 'image',
    name: 'image',
    color: 'rgb(234, 2, 130)',
    size: 24
  },
  regex: /(?<toolCode>image)\('(?<protocol>www|http|https):\/\/(?<url>[^\s]+[\w])'\)/,
  shortcut: 'ctrl+i',
  canExecute: (context, args?) => true,
  execute: (context, args?) => React.createElement(Image, createImageProps(context), null),
  factory: (context: Context) => createImageProps(context, true)
};

export const ImageTool: Tool = {
  id: 'image',
  name: 'Image',
  description: 'Insert an image',
  command: ImageCommand,
  component: Image
};

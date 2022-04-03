import React, { FC } from 'react';
import type { Point, Size } from 'src/app/types';
import type { Pointer } from 'src/events/types';
import { string } from 'yargs';
import { useAppState } from 'src/app/hooks';
import styles from '../../styles.css';
import type { Tool } from 'src/tools/types';

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
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  href: string;
  selected: boolean;
  type: string;
}

export const createImage = ({ topLeftPosition, size }: Pointer): Props => {
  return {
    x: topLeftPosition.x,
    y: topLeftPosition.y,
    width: size.width,
    height: size.height,
    href: '/images/avatar.jpg',
    name: 'Image x',
    selected: true,
    type: 'image'
  };
};

export const Image: FC<Props> = ({ x, y, width, height, href }) => (
  <image key="image" x={x} y={y} width={width} xlinkHref={href} />
);

export const ImageTool: FC = () => {
  const { pointer } = useAppState(state => state.events);

  return <Image {...createImage(pointer)} />;
};

export const ImageCommand: Tool = {
  id: 'image',
  name: 'Image',
  description: 'Insert an image',
  factory: createImage,
  tool: ImageTool,
  component: Image,
  icon: {
    group: 'image',
    name: 'image',
    // color: 'rgb(234, 2, 130)',
    size: 24
  },
  regex: /(?<toolCode>image)\('(?<protocol>www|http|https):\/\/(?<url>[^\s]+[\w])'\)/,
  shortcut: 'ctrl+i'
};

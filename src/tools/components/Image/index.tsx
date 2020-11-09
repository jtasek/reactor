import React, { FC } from 'react';
import { Point, Size } from 'src/app/types';
import { Pointer } from 'src/events/types';
import { string } from 'yargs';
import { useState } from 'src/app/hooks';
import styles from '../../styles.css';

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
    href: '',
    name: 'Image x',
    selected: true,
    type: 'image'
  };
};

export const Image: FC<Props> = ({ x, y, width, height, href }) => (
  <image key="image" x={x} y={y} width={width} height={height} xlinkHref={href} />
);

export const DesignImage: FC = () => {
  const { pointer } = useState().events;

  return <Image {...createImage(pointer)} />;
};

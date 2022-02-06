import React, { FC } from 'react';
import { Point } from 'src/app/types';
import { useAppState } from 'src/app/hooks';

import inlineStyles from '../../inlineStyles';

/**
 * Change zoom of the surface
 **/

interface Props {
  position: Point;
}

export const Zoom: FC<Props> = ({ position }) => (
  <text key="text" style={inlineStyles} x={position.x} y={position.y}>
    Tohle je test string
  </text>
);

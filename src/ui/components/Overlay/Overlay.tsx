import React, { FC } from 'react';
import styles from './styles.css';

export const Overlay: FC = () => (
  <defs>
    <filter id="overlay">
      <feColorMatrix
        in="SourceGraphic"
        result="LIGHTENED"
        type="matrix"
        values="3.3 0 0 0 0, 0 3.3 0 0 0, 0 0 3.3 0 0, 0 0 0 1 0"
      />
      <feGaussianBlur
        colorInterpolationFilters="sRGB"
        id="blur_1"
        stdDeviation="4"
        result="BLUR"
        in="LIGHTENED"
      />
      <feImage
        id="feimage"
        xlinkHref='data:image/svg+xml;charset=utf-8,<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"  width="100" height="100"><rect width="100%" height="100%" fill="black"/></svg>'
        x="0"
        y="0"
        width="100%"
        height="100%"
        result="mask"
        preserveAspectRatio="none"
      />
      <feComposite in2="mask" in="BLUR" operator="in" result="comp" />
      <feMerge result="merge">
        <feMergeNode in="SourceGraphic" />
        <feMergeNode in="comp" />
      </feMerge>
    </filter>
  </defs>
);

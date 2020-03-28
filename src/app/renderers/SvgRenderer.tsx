import React from './react';
import { Document, Renderer } from '../types';

class SvgRenderer implements Renderer {
  document: Document;
  render(): void {}
}

const Group = props => <g>{props.children}</g>;
/*
const Line = () => <line 
    x1="the x start point of the line"
    y1="the y start point of the line"
    x2="the x end point of the line"
    y2="the y end point of the line" />

const Polygon = () => <polygon 
    points="the points of the polygon. The total number of points must be even. Required."
    fill-rule="part of the FillStroke presentation attributes" />


const Polyline = () => <polyline 
    points="the points on the polyline. Required." />


    
const Text = () => <text 
    x="a list of x-axis positions. The nth x-axis position is given to the nth character in the text. If there are additional characters after the positions run out they are placed after the last character. 0 is default"
    y="a list of y-axis positions. (see x). 0 is default"
    dx="a list of lengths which moves the characters relative to the absolute position of the last glyph drawn. (see x)"
    dy="a list of lengths which moves the characters relative to the absolute position of the last glyph drawn. (see x)" 
    rotate="a list of rotations. The nth rotation is performed on the nth character. Additional characters are NOT given the last rotation value"
    textLength="a target length for the text that the SVG viewer will attempt to display the text between by adjusting the spacing and/or the glyphs. (default: The text's normal length)"
    lengthAdjust="tells the viewer what to adjust to try to accomplish rendering the text if the length is specified. The two values are 'spacing' and 'spacingAndGlyphs'" />

const Image = () => <image 
    x="the x-axis top-left corner of the image"
    y="the y-axis top-left corner of the image"
    width="the width of the image. Required."
    height="the height of the image. Required."
    xlinkHref="the path to the image. Required." />

const Pattern = () => <pattern 
    id="the unique id used to reference this pattern. Required. "
    patternUnits="'userSpaceOnUse' or 'objectBoundingBox'. The second value makes units of x, y, width, height a fraction (or %) of the object bounding box which uses the pattern."
    patternContentUnits="'userSpaceOnUse' or 'objectBoundingBox'"
    patternTransform="allows the whole pattern to be transformed"
    x="pattern's offset from the top-left corner (default 0)" 
    y="pattern's offset from the top-left corner. (default 0)"
    width="the width of the pattern tile (default 100%)" 
    height="the height of the pattern tile (default 100%)"
    viewBox="the points "seen" in this SVG drawing area. 4 values separated by white space or commas. (min x, min y, width, height)" 
    xlinkHref="reference to another pattern whose attribute values are used as defaults and any children are inherited. Recursive" />
*/

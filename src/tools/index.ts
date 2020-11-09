import { state } from './state';
import * as actions from './actions';

import { Circle as circle } from './components/Circle';
import { Image as image } from './components/Image';
import { Line as line } from './components/Line';
import { Pen as pen } from './components/Pen';
import { Rect as rect } from './components/Rect';
import { Text as text } from './components/Text';

const components = {
  circle,
  image,
  line,
  pen,
  rect,
  text
};

export { actions, state, components };

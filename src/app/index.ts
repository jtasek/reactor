import { merge, namespaced } from 'overmind/config';

import * as actions from './actions';
import * as effects from './effects';

import * as events from '../events';
import * as tools from '../tools';
import * as ui from '../ui';
import { state } from './state';
import { onInitialize } from './actions';

export const config = merge(
  {
    onInitialize,
    actions,
    effects,
    state
  },
  namespaced({
    events,
    tools,
    ui
  })
);

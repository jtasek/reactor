import { merge, namespaced } from 'overmind/config';

import * as actions from './actions';
import * as effects from './effects';
import * as events from '../events';
import * as tools from '../tools';
import * as ui from '../ui';
import { IContext } from 'overmind';
import { state } from './state';

export const config = merge(
  {
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

export type Context = IContext<typeof config>;
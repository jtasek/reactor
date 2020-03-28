import { createHook } from 'overmind-react';
import { merge, namespaced } from 'overmind/config';

import commands from '../tools/commands';
import * as events from '../events';
import * as tools from '../tools';
import * as ui from '../ui';
import * as actions from './actions';
import { state } from './state';

export const config = merge(
    {
      state,
      actions
    },
    namespaced({
      events,
      tools,
      ui
    })
);

export const useApp = createHook<typeof config>();

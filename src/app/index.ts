import { IConfig } from 'overmind';
import { createHook } from 'overmind-react';
import { merge, namespaced } from 'overmind/config';

import * as actions from './actions';
import * as effects from './effects';
import * as events from '../events';
import * as tools from '../tools';
import * as ui from '../ui';
import { onInitialize } from './onInitialize';
import { state } from './state';

export const config = merge(
  {
    actions,
    effects,
    onInitialize,
    state
  },
  namespaced({
    events,
    tools,
    ui
  })
);

declare module 'overmind' {
  // tslint:disable:interface-name
  interface Config extends IConfig<typeof config> {}
}

export const useApp = createHook<typeof config>();

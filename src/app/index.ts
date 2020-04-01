import { createHook } from 'overmind-react';
import { IConfig } from 'overmind';
import { merge, namespaced } from 'overmind/config';

import * as actions from './actions';
import * as events from '../events';
import * as tools from '../tools';
import * as ui from '../ui';
import { Application } from './types';
import { onInitialize } from './onInitialize';
import { state } from './state';

export const config = merge(
  {
    onInitialize,
    state,
    actions
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

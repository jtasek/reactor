// @flow
import { Controller } from 'cerebral'
import { set, debounce } from 'cerebral/operators'
import { state } from 'cerebral/tags'
// system modules
import Devtools from 'cerebral/devtools'
import Router from '@cerebral/router'
import FormsProvider from '@cerebral/forms'
// application modules
import core from './modules/core'
import commands from './modules/tools/commands'
import reflex from './modules/reflex'
import tools from './modules/tools'
import ui from './modules/ui'

import data from './data'

function search({ props, state }) {
  console.log(`searching: ${props.value}`)
  state.set(state`filter`, props.value)
}

const controller = Controller({
  state: data,
  commands: commands,
  devtools:
    process.env.NODE_ENV === 'production'
      ? null
      : Devtools({
          host: 'localhost:8585',
          reconnect: false
        }),
  modules: {
    core,
    reflex,
    tools,
    ui,
    router: Router({
      onlyHash: true, // Use hash urls
      routes: {
        '/': 'core.applicationStarted'
        // '/login': '',
        // '/signup': '',
        // '/logout': '',
        // '/terms': '',
        // '/privacy': '',
        // '/export': '',
        // '/import': '',
        // '/about': ''
      }
    })
  },
  providers: [FormsProvider()],
  signals: {
    search: [...debounce(300), [search]]
  }
})

export default controller

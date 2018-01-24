// @flow
import { Module } from 'cerebral'
import { set, debounce } from 'cerebral/operators'
import { state } from 'cerebral/tags'
// system modules
import Router from '@cerebral/router'
import FormsProvider from '@cerebral/forms'
// application modules
import commands from '../tools/commands'
import reflex from '../reflex'
import tools from '../tools'
import ui from '../ui'
// actions
import search from './actions/search'
// configuration
import config from './config'
import routes from './routes'
// signals
import applicationStarted from './signals/applicationStarted'
import commandExecuted from './signals/commandExecuted'
import executeCommand from './services/executeCommand'
import distructionFreeModeToggled from './signals/distructionFreeModeToggled'
import scaleChanged from './signals/scaleChanged'

export default Module({
    state: config,
    modules: {
        reflex,
        tools,
        ui,
        router: Router({
            onlyHash: true, // Use hash urls
            routes
        })
    },
    providers: [FormsProvider()],
    signals: {
        applicationStarted,
        commandExecuted,
        distructionFreeModeToggled,
        scaleChanged,
        search: [...debounce(300), [search]]
        // scaleUp,
        // scaleDown
        //
    }
    // services: {
    //     executeCommand
    // }
})

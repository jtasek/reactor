import applicationStarted from './signals/applicationStarted'
import commandExecuted from './signals/commandExecuted'
import executeCommand from './services/executeCommand'
import distructionFreeModeToggled from './signals/distructionFreeModeToggled'
import scaleChanged from './signals/scaleChanged'

export default {
    state: {
        started: Date.now(),
        user: {
            name: 'jakub',
            email: 'me@jakubtasek.com',
            lastLogin: Date.now()
        },
        distractionFreeMode: false,
        workspaces: []
    },
    signals: {
        applicationStarted,
        commandExecuted,
        distructionFreeModeToggled,
        scaleChanged
        // scaleUp,
        // scaleDown
    },
    services: {
        executeCommand
    }
}
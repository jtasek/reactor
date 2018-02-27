import { set, toggle } from 'cerebral/operators'
import { props, state } from 'cerebral/tags'

export default [
    // set(state`ui.controls.commandline.visible`, false),
    // set(state`ui.controls.contextmenu.visible`, false),
    // set(state`ui.controls.controlpanel.visible`, false),
    // set(state`ui.controls.grouppanel.visible`, false),
    // set(state`ui.controls.layerpanel.visible`, false),
    // set(state`ui.controls.menubar.visible`, false),
    // set(state`ui.controls.minimappanel.visible`, false),
    // set(state`ui.controls.navbar.visible`, false),
    // set(state`ui.controls.propertypanel.visible`, false),
    // set(state`ui.controls.sidebar.visible`, false),
    // set(state`ui.controls.statusbar.visible`, false),
    // set(state`ui.controls.toolbar.visible`, false),
    // set(state`ui.controls.workspace.visible`, false),
    toggle(state`distructionFreeMode`)
]
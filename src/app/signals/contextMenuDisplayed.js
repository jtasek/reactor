export default [function ({props, state}) {
    state.set('ui.controls.contextmenu.visible', true)
    state.set('ui.controls.contextmenu.position', props)
}]
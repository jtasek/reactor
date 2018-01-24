export default [function ({props, state}) {
    const path = `ui.controls.${props.name}.visible`
    // !state.get(path)
    state.toggle(path)
}]
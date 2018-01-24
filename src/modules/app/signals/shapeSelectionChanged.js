export default [function ({props, state}) {
    const path = `workspace.shapes.${props.id}.selected`
    state.set(path, !state.get(path))
}]
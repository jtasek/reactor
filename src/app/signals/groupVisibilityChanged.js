export default [function ({props, state}) {
    const path = `workspace.groups.${props.id}.visible`
    state.set(path, !state.get(path))
}]
export default ({props, state}) => {
    const path = `workspace.layers.${props.id}.visible`
    state.set(path, !state.get(path))
}
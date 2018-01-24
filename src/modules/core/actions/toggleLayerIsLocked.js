export default ({props, state}) => {
    const path = `workspace.layers.${props.id}.locked`
    state.set(path, !state.get(path))
}
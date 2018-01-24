export default ({props, state}) => {
    const path = `workspace.shapes.${props.id}.locked`
    state.set(path, !state.get(path))
}
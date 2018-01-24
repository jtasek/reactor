export default ({props, state}) => {
    const path = `workspace.shapes.${props.id}.visible`
    state.set(path, !state.get(path))
}
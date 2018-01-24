export default ({props, state}) => {
    const path = `workspace.links.${props.id}.visible`
    state.set(path, !state.get(path))
}
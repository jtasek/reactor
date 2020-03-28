export default ({props, state}) => {
    const path = `workspace.links.${props.id}.locked`
    state.set(path, !state.get(path))
}
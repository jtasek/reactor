export default ({props, state}) => {
    const path = `workspace.groups.${props.id}.locked`
    state.set(path, !state.get(path))
}
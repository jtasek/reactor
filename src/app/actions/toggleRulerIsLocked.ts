export default ({props, state}) => {
    const path = `workspace.rulers.${props.id}.locked`
    state.set(path, !state.get(path))
}
export default ({props, state}) => {
    const path = `workspace.rulers.${props.id}.visible`
    state.set(path, !state.get(path))
}
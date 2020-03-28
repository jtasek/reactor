export default ({props, state}) => {
    state.unset(`workspaces.${props.id}`)
}
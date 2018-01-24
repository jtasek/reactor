export default ({props, state}) => {
    state.unset(`workspace.links.${props.id}`)
}
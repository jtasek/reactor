export default ({props, state}) => {
    state.unset(`workspace.groups.${props.id}`)
}
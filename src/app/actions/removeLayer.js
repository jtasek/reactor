export default ({props, state}) => {
    state.unset(`workspace.layers.${props.id}`)
}
export default ({props, state}) => {
    state.unset(`workspace.shapes.${props.id}`)
}
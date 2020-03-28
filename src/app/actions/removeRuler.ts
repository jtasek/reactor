export default ({props, state}) => {
    state.unset(`workspace.rulers.${props.id}`)
}
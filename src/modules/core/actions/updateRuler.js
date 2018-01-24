export default ({props, state}) => {
    state.merge(`workspace.rulers.${props.id}`, props)
}
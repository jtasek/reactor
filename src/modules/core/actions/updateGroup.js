export default ({props, state}) => {
    state.merge(`workspace.layers.${props.id}`, props)
}
export default ({props, state}) => {
    state.merge(`workspace.shapes.${props.id}`, props)
}
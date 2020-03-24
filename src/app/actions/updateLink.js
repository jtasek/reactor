export default ({props, state}) => {
    state.merge(`workspace.links.${props.id}`, props)
}
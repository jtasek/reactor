export default ({props, state}) => {
    state.merge(`workspaces.${props.id}`, props)
}
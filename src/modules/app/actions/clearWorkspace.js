//@flow
export default ({ props, state}) => {
    state.unset('workspace.shapes')
    state.unset('workspace.groups')
    state.unset('workspace.layers')
    state.unset('workspace.links')
}
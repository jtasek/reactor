export default ({ props, state }) => {
    state.set('workspace.status', `${props.name} tool activated/deactivate`);
};
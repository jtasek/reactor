export default ({props, state}) => {
  state.set(`workspace.groups.${props.id}.selected`, true)
}
export default ({props, state}) => {
  state.set(`workspace.rulers.${props.id}.selected`, true)
}
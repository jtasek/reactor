export default ({ props, state }) => {
    const path = `tools.${props.name}.active`
    state.toggle(path)
}
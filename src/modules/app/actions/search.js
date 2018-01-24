export default function search({ props, state }) {
    console.log(`searching: ${props.value}`)
    state.set(state`filter`, props.value)
}

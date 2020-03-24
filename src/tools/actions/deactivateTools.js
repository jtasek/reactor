export default function ({ props, state }) {
    const tools = state.get('tools')
    for (let key in tools) {
        let tool = tools[key]
        if (tool.active) {
            const path = `tools.${key}.active`
            state.set(path, false)
        }
    }
}
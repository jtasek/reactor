import {createWorkspace} from '../app/factories'

export default ({props, state}) => {
    const workspace = createWorkspace(props)

    state.push(`workspaces.${workspace.id}`, workspace)

    output({ id: workspace.id })
}
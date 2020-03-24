import { IWorkspace, IRenderer } from '../index'

export class HtmlRenderer implements IRenderer {
    Workspace: IWorkspace
    Render(): void {
        console.log(this.Workspace.toString())

        this.Workspace.Shapes.forEach(function(value, index) {
            console.log(value.Name)
        })
    }
}

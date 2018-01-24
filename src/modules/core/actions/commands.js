// Commands
import {IApplicationState, ICommand} from './core'

export class UndoCommand implements ICommand {
    name = 'Undo';
    canExecute(app: IApplicationState): boolean {
        return app.history.any()
    }
    execute(app: IApplicationState): void {
        app.future = app.future.push(app)
        app.state = app.history.peek()
        app.history = app.history.pop()
    }
}

export class RedoCommand implements ICommand {
    name = 'Redo';
    canExecute(app: IApplicationState): boolean {
        return app.future.any()
    }
    execute(app: IApplicationState): void {
        app.history = app.history.push(app)
        app.state = app.future.peek()
        app.future = app.future.pop()
    }
}

export class AlignLeft implements ICommand {
    name = 'Align Left';
    canExecute(app: IApplicationState): boolean {
        return app.Selection.any()
    }
    execute(app: IApplicationState) {
        var left = getLeftCoordinate(app.workspace.seletection)
        for (var item in this.Application.Selection) {
            item.Left = left
        }
    }
}
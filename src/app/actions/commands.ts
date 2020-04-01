// Commands
import { Application, Command } from '../types';

export class UndoCommand implements Command {
  id = 'undo';
  name = 'Undo';
  action = () => console.log('NOT IMPLEMENTED');

  canExecute(state: Application): boolean {
    return false;
    //  return state.openDocument.history.any();
  }

  execute(state: Application): void {
    // state.future = state.future.push(state);
    // state.state = state.history.peek();
    // state.history = state.history.pop();
  }
}

export class RedoCommand implements Command {
  id = 'Redo';
  name = 'Redo';
  action = () => console.log('NOT IMPLEMENTED');
  canExecute(app: Application): boolean {
    return false;
    //return app.future.any();
  }
  execute(app: Application): void {
    // app.history = app.history.push(app);
    // app.state = app.future.peek();
    // app.future = app.future.pop();
  }
}

export class AlignLeft implements Command {
  id = 'align.left';
  name = 'Align left';
  action = () => console.log('NOT IMPLEMENTED');
  canExecute(app: Application): boolean {
    return false;
    // return app.Selection.any();
  }
  execute(app: Application) {
    //app.openDocument.selection.forEach(shape => (shape.left = left));
  }
}

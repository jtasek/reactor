import { DeleteCommand } from './delete';
import { CloneCommand } from './clone';
import { MoveCommand } from './move';
import { GroupCommand, UngroupCommand } from './group';
import { LayerCommand, UnlayerCommand } from './layer';
import { ZoomInCommand, ZoomOutCommand, ZoomResetCommand } from './zoom';

export const commands = [
  DeleteCommand,
  CloneCommand,
  MoveCommand,
  GroupCommand,
  UngroupCommand,
  LayerCommand,
  UnlayerCommand,
  ZoomInCommand,
  ZoomOutCommand,
  ZoomResetCommand
];

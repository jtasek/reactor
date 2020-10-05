import { Application, Point } from '../../app/types';
import { Events } from '../types';

export const path = ({ pointer }: Events, { currentDocument }: Application) => {
  const { path } = pointer;
  const scale = currentDocument?.camera.scale || 1;

  return path.map((point: Point) => `${point.x / scale}, ${point.y / scale}`);
};

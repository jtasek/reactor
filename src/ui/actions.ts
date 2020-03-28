import { UI } from './types';

export const showControl = ({ state: UI }, control: string) => {
  UI[control].visible = true;
};

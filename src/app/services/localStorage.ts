import { Application } from '../types';

export const loadState = (key: string): Application | null => {
  try {
    const serializedState = localStorage.getItem(key);

    if (!serializedState) {
      return null;
    }

    return JSON.parse(serializedState);
  } catch (error) {
    throw new Error(`Failed to load application state: ${error}`);
  }
};

export const saveState = (key: string, state: Application): void => {
  try {
    const serializedState = JSON.stringify(state);

    localStorage.setItem(key, serializedState);

    console.log('Application state saved');
  } catch (error) {
    console.error('Failed to save application state', error);
  }
};

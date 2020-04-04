import { Application } from '../types';

export const loadState = (key: string) => {
  try {
    const serializedState = localStorage.getItem(key);

    if (!serializedState) {
      return null;
    }

    return JSON.parse(serializedState);
  } catch (error) {
    console.error('Failed to load application state', error);
  }
};

export const saveState = (key: string, state: Application) => {
  try {
    const serializedState = JSON.stringify(state);

    localStorage.setItem(key, serializedState);
  } catch (error) {
    console.error('Failed to save application state', error);
  }
};

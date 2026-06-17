import { Application } from './types';
import { createApplication } from './factories';

export const state: Application = {
    ...createApplication()
};

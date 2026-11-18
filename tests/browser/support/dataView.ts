import type { Locator } from '@playwright/test';

/** Shows one of the Data View's Records, Fields and Rules sections. */
export const showDataTab = (panel: Locator, name: 'Records' | 'Fields' | 'Rules') =>
    panel.getByRole('tab', { name: new RegExp(`^${name}`) }).click();

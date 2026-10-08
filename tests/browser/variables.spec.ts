import { expect, test, type Page } from '@playwright/test';
import { drawRect, openEditor, pointer, selectTool, shapes } from './support/editor';

const field = (page: Page, label: string) => page.getByLabel(label, { exact: true });
const panel = (page: Page) => page.getByRole('region', { name: 'Variables' });

async function addVariable(page: Page, name: string, type: string) {
    await field(page, 'New variable name').fill(name);
    await field(page, 'New variable type').selectOption({ label: type });
    await panel(page).getByRole('button', { name: 'Add', exact: true }).click();
}

async function rectangleWithPanels(page: Page) {
    await openEditor(page, ['Inspector', 'Variables']);
    await drawRect(page, { x: 100, y: 100 }, { x: 150, y: 150 });

    const rect = shapes(page).first().locator('rect[data-cy]');

    return {
        fill: () => rect.evaluate((element) => getComputedStyle(element).fill),
        drawn: shapes(page).first().locator('> g').first()
    };
}

test('a fill follows a color variable until it stops using it, also after a reload', async ({
    page
}) => {
    const { fill } = await rectangleWithPanels(page);

    await addVariable(page, 'brand/primary', 'Color');
    await field(page, 'Value of brand/primary').fill('#3366ff');
    await field(page, 'Variable for Fill').selectOption({ label: 'brand/primary' });

    await expect.poll(fill).toBe('rgb(51, 102, 255)');
    await expect(field(page, 'Fill')).toHaveText('◆ brand/primary');

    await field(page, 'Value of brand/primary').fill('#ff0000');
    await expect.poll(fill).toBe('rgb(255, 0, 0)');
    await expect(panel(page).getByTitle('Used by 1 properties')).toBeVisible();

    await page.reload();
    await openEditor(page, ['Inspector', 'Variables']);
    await pointer(page, 'pointerdown', { x: 125, y: 125 });
    await pointer(page, 'pointerup', { x: 125, y: 125 });
    await expect(field(page, 'Fill')).toHaveText('◆ brand/primary');

    await page
        .getByRole('button', { name: 'Stop using brand/primary for Fill' })
        .dispatchEvent('click');
    await expect(field(page, 'Fill')).toHaveValue('#ff0000');

    await field(page, 'Value of brand/primary').fill('#00ff00');
    await expect.poll(fill).toBe('rgb(255, 0, 0)');
});

test('an opacity follows a number variable as typed into its field', async ({ page }) => {
    const { drawn } = await rectangleWithPanels(page);

    await addVariable(page, 'faded', 'Number');
    await field(page, 'Value of faded').fill('40');
    await field(page, 'Value of faded').press('Enter');
    await field(page, 'Variable for Opacity (%)').selectOption({ label: 'faded' });

    await expect(drawn).toHaveAttribute('opacity', '0.4');

    await field(page, 'Value of faded').fill('70');
    await field(page, 'Value of faded').press('Enter');
    await expect(drawn).toHaveAttribute('opacity', '0.7');
});

test('deleting a used variable asks first and leaves the shapes as they were', async ({ page }) => {
    const { fill } = await rectangleWithPanels(page);

    await addVariable(page, 'brand', 'Color');
    await field(page, 'Value of brand').fill('#3366ff');
    await field(page, 'Variable for Fill').selectOption({ label: 'brand' });

    await page.getByRole('button', { name: 'Delete brand', exact: true }).click();
    await page.getByRole('button', { name: 'Keep', exact: true }).click();
    await expect(field(page, 'Name of brand')).toBeVisible();

    await page.getByRole('button', { name: 'Delete brand', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm deleting brand' }).click();

    await expect(panel(page).getByText('No variables yet')).toBeVisible();
    await expect(field(page, 'Fill')).toHaveValue('#3366ff');
    await expect.poll(fill).toBe('rgb(51, 102, 255)');
});

test('a name that is taken or holds a template mark is refused', async ({ page }) => {
    await openEditor(page, ['Variables']);

    await addVariable(page, 'size', 'Number');
    await addVariable(page, 'size', 'Text');
    await expect(panel(page).getByRole('alert')).toHaveText('A variable is already named size.');

    await addVariable(page, 'a{b}', 'Text');
    await expect(panel(page).getByRole('alert')).toHaveText(
        'A name cannot be blank or hold {, } or $.'
    );
    await expect(panel(page).getByRole('listitem')).toHaveCount(1);
});

/** Clicks the canvas with the real mouse, which also moves focus like a user would. */
async function click(page: Page, x: number, y: number) {
    const box = (await page.locator('svg#surface').boundingBox())!;

    await page.mouse.click(box.x + x, box.y + y);
}

test('a text shows the variables its template names and follows their changes', async ({
    page
}) => {
    await openEditor(page, ['Inspector', 'Variables']);
    await addVariable(page, 'first name', 'Text');
    await field(page, 'Value of first name').fill('Ada');
    await field(page, 'Value of first name').press('Enter');
    await addVariable(page, 'full name', 'Text');
    await field(page, 'Value of full name').fill('${first name} Lovelace');
    await field(page, 'Value of full name').press('Enter');

    await selectTool(page, 'Type a text');
    await pointer(page, 'pointerdown', { x: 100, y: 300 });
    await pointer(page, 'pointerup', { x: 100, y: 300 });
    await page.keyboard.type('hello');
    await page.keyboard.press('Enter');
    await click(page, 600, 500);
    await click(page, 110, 295);

    await field(page, 'Text').fill('Hi ${full name}');
    await field(page, 'Text').press('Enter');

    const letters = page.locator('svg#surface text[data-cy]');

    await expect(letters).toHaveText('Hi Ada Lovelace');
    await expect(field(page, 'Text')).toHaveValue('Hi ${full name}');

    await field(page, 'Value of first name').fill('Grace');
    await field(page, 'Value of first name').press('Enter');
    await expect(letters).toHaveText('Hi Grace Lovelace');

    await field(page, 'Text').fill('Hi ${nobody}');
    await field(page, 'Text').press('Enter');
    await expect(letters).toHaveText('Hi ${nobody}');
    await expect(page.getByRole('note')).toHaveText('Cannot show nobody');
});

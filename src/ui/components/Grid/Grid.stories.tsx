import React from 'react';
// also exported from '@storybook/react' if you can deal with breaking changes in 6.1
import { Story, Meta } from '@storybook/react/types-6-0';

import { Grid, Props } from './Grid';
import { createCamera, createGrid } from 'src/app/factories';

export default {
  title: 'Example/Grid',
  component: Grid
} as Meta;

const Template: Story<Props> = (args) => <Grid {...args} />;

export const Default = Template.bind({});
Default.args = {
  camera: createCamera(),
  grid: createGrid()
};

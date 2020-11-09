import React from 'react';
// also exported from '@storybook/react' if you can deal with breaking changes in 6.1
import { Story, Meta } from '@storybook/react/types-6-0';

import { Surface } from './Surface';

export default {
  title: 'Example/Surface',
  component: Surface
} as Meta;

const Template: Story = (args) => <Surface {...args} />;

export const Default = Template.bind({});
Default.args = {};

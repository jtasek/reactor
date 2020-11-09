import React from 'react';
// also exported from '@storybook/react' if you can deal with breaking changes in 6.1
import { Story, Meta } from '@storybook/react/types-6-0';

import { Explorer } from './Explorer';

export default {
  title: 'Example/Explorer',
  component: Explorer
} as Meta;

const Template: Story = (args) => <Explorer {...args} />;

export const Default = Template.bind({});
Default.args = {};

import React from 'react';
// also exported from '@storybook/react' if you can deal with breaking changes in 6.1
import { Story, Meta } from '@storybook/react/types-6-0';

import { NavBar } from './NavBar';

export default {
  title: 'Example/NavBar',
  component: NavBar
} as Meta;

const Template: Story = (args) => <NavBar {...args} />;

export const Default = Template.bind({});
Default.args = {};

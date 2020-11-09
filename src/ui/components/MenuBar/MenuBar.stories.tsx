import React from 'react';
// also exported from '@storybook/react' if you can deal with breaking changes in 6.1
import { Story, Meta } from '@storybook/react/types-6-0';

import { MenuBar, Props } from './MenuBar';

export default {
  title: 'Example/MenuBar',
  component: MenuBar
} as Meta;

const Template: Story<Props> = (args) => <MenuBar {...args} />;

export const Default = Template.bind({});
Default.args = {};

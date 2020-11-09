import React from 'react';
// also exported from '@storybook/react' if you can deal with breaking changes in 6.1
import { Story, Meta } from '@storybook/react/types-6-0';

import { StatusBar } from './StatusBar';
import { StatusBarSlot } from './StatusBarSlot';

export default {
  title: 'Example/StatusBar',
  component: StatusBar
} as Meta;

const Template: Story = () => (
  <StatusBar>
    <StatusBarSlot name="Document Name">Test document</StatusBarSlot>
    <StatusBarSlot name="Current Action">Test action</StatusBarSlot>
  </StatusBar>
);

export const Default = Template.bind({});
Default.args = {};

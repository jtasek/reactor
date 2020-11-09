import React from 'react';
// also exported from '@storybook/react' if you can deal with breaking changes in 6.1
import { Story, Meta } from '@storybook/react/types-6-0';

import { ContextMenu, Props } from './ContextMenu';

export default {
  title: 'Example/ContextMenu',
  component: ContextMenu
} as Meta;

const Template: Story<Props> = (args) => <ContextMenu {...args} />;

export const Default = Template.bind({});
Default.args = {
  position: { x: 10, y: 10 }
};

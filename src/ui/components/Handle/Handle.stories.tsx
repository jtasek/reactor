import React from 'react';
// also exported from '@storybook/react' if you can deal with breaking changes in 6.1
import { Story, Meta } from '@storybook/react/types-6-0';

import { Handle, Props } from '.';

export default {
  title: 'Example/Handle',
  component: Handle
} as Meta;

const Template: Story<Props> = (args) => <Handle {...args} />;

export const Default = Template.bind({});
Default.args = {
  position: { x: 10, y: 10 },
  size: 5
};

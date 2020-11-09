import React from 'react';
// also exported from '@storybook/react' if you can deal with breaking changes in 6.1
import { Story, Meta } from '@storybook/react/types-6-0';

import { Cursor, Props } from './Cursor';

export default {
  title: 'Example/Cursor',
  component: Cursor
} as Meta;

const Template: Story<Props> = (args) => <Cursor {...args} />;

export const Default = Template.bind({});
Default.args = {
  position: { x: 10, y: 20 }
};

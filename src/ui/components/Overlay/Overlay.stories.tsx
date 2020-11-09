import React from 'react';
// also exported from '@storybook/react' if you can deal with breaking changes in 6.1
import { Story, Meta } from '@storybook/react/types-6-0';

import { Overlay } from './Overlay';

export default {
  title: 'Example/Overlay',
  component: Overlay
} as Meta;

const Template: Story = (args) => <Overlay {...args} />;

export const Default = Template.bind({});
Default.args = {};

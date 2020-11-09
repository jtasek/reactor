import React from 'react';
// also exported from '@storybook/react' if you can deal with breaking changes in 6.1
import { Story, Meta } from '@storybook/react/types-6-0';

import { MiniMap, Props } from './MiniMap';

export default {
  title: 'Example/MiniMap',
  component: MiniMap
} as Meta;

const Template: Story<Props> = (args) => <MiniMap {...args} />;

export const Default = Template.bind({});
Default.args = {};

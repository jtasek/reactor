import React from 'react';
// also exported from '@storybook/react' if you can deal with breaking changes in 6.1
import { Story, Meta } from '@storybook/react/types-6-0';

import { CommandLine, Props } from './CommandLine';

export default {
  title: 'Example/CommandLine',
  component: CommandLine
} as Meta;

const Template: Story<Props> = (args) => <CommandLine {...args} />;

export const Default = Template.bind({});
Default.args = {};

export const execute = (command: string, ...args: string[]): void => {
  console.log(`Execute command${command}(${args.join(', ')})`);
};

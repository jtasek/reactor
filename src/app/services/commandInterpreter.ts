export const execute = (command: string, ...args: any[]) => {
  console.log(`Execute command${command}(${args.join(', ')})`);
};

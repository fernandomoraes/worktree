const registry = new WeakMap<object, string[]>();

export const withExamples = <T extends object>(
  command: T,
  examples: string[]
): T => {
  registry.set(command, examples);
  return command;
};

export const examplesFor = (command: object) => registry.get(command);

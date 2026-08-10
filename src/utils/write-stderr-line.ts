export const writeStderrLine = (line = '') => {
  process.stderr.write(`${line}\n`);
};

export const getFormattedTime = (): string => {
  const now = new Date();
  const hh = now.getHours().toString().padStart(2, '0');
  const mm = now.getMinutes().toString().padStart(2, '0');
  const ss = now.getSeconds().toString().padStart(2, '0');
  const mss = now.getMilliseconds().toString().padStart(3, '0');
  return `${hh}:${mm}:${ss}.${mss}`;
};

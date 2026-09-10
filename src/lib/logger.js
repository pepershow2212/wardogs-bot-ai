export function logInfo(...args) {
  console.log(new Date().toISOString(), '[info]', ...args);
}

export function logWarn(...args) {
  console.warn(new Date().toISOString(), '[warn]', ...args);
}

export function logError(...args) {
  console.error(new Date().toISOString(), '[error]', ...args);
}

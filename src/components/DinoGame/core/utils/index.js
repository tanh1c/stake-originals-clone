// Environment detection for Vite
export const isProd = import.meta.env?.PROD ?? false;
export const isDev = import.meta.env?.DEV ?? true;
export const isTest = false;

/**
 * Local declaration so the feature stylesheet import type-checks without the shell's
 * toolchain. Remove or narrow this once the shared Vite toolchain declares the CSS module
 * type (HZ-03); duplicate wildcard declarations can otherwise conflict with vite/client.
 */
declare module "*.css";

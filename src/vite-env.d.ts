/// <reference types="vite/client" />

// Add declarations for polyfilled functions for MacOS 13 compatibility
interface Crypto {
    randomUUID?: () => `${string}-${string}-${string}-${string}-${string}`;
}

interface ObjectConstructor {
    hasOwn?: (object: object, property: PropertyKey) => boolean;
}

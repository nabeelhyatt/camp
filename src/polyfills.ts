// ES2022 polyfills for older environments

// Object.hasOwn polyfill
export function applyPolyfills() {
    if (!Object.hasOwn) {
        Object.defineProperty(Object, "hasOwn", {
            value: function (object: object, property: PropertyKey): boolean {
                if (object == null) {
                    throw new TypeError(
                        "Cannot convert undefined or null to object",
                    );
                }
                return Object.prototype.hasOwnProperty.call(
                    Object(object),
                    property,
                );
            },
            configurable: true,
            writable: true,
        });
    }
}

// Apply polyfills immediately
applyPolyfills();

export {};

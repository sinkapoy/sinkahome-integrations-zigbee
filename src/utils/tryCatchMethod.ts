export function tryCatchMethod (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod: Function = descriptor.value;
    descriptor.value = function (...args: any[]) {
        try {
            return originalMethod.call(this, ...args);
        } catch (e) {
            console.error(e);
        }
    };
}

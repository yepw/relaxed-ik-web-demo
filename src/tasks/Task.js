
/**
 * Abstract Class Task
 */
export default class Task {
    constructor() {
        if (this.constructor == Task) {
            throw new Error("Abstract classes can't be instantiated.");
        }
    }

    update() {
        throw new Error("Method 'update()' must be implemented");
    }

    setRound(num) {
        throw new Error("Method 'setRound(num)' must be implemented");
    }

    reset() {
        throw new Error("Method 'reset()' must be implemented");
    }
}
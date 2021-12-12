
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

    nextRound() {
        throw new Error("Method 'nextRound()' must be implemented");
    }

    init() {
        throw new Error("Method 'init()' must be implemented");
    }

    quit() {
        throw new Error("Method 'quit()' must be implemented");
    }
    
    reset() {
        throw new Error("Method 'reset()' must be implemented");
    }
}
class ApiError extends Error {
    constructor(
        statusCode,
        message= "Something went wrong",
        errors = [],
        stack = ""
    ){
        super(message)
        this.statusCode = statusCode
        this.data = null
        this.message = message
        this.success = false;
        this.errors = errors

        if (process.env.NODE_ENV === "development") {
            this.stack = stack || Error.captureStackTrace(this, this.constructor);
        } else {
            this.stack = undefined; // Don't send stack traces in production
        }
    }
    formatResponse() {
        return {
            success: this.success,
            statusCode: this.statusCode,
            message: this.message,
            errors: this.errors.length > 0 ? this.errors : undefined,
        };  
    }
}

export {ApiError}
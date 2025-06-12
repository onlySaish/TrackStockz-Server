import { ApiError } from "../utils/ApiError.js";

const errorHandler = (err, req, res, next) => {
    if (err instanceof ApiError) {
        return res.status(err.statusCode).json(err.formatResponse());
    }

    // For unknown errors, return a generic error message
    return res.status(500).json({
        success: false,
        message: 'Internal Server Error',
    });
};

export {errorHandler}
// Use the error handling middleware after your routes

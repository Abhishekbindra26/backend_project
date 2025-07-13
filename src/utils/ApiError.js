class ApiError extends Error{
    constructor(
        statusCode,
        message = "something went wrong",
        error = [],
        statck = ""
    ){
        super(message)
        this.statusCode = statusCode
        this.errors = error
        this.data = null
        this.message = message
        this.success = false

        if(statck){
            this.stack = statck
        }
        else{
            Error.captureStackTrace(this,this.constructor)
        }
    }
}
export {ApiError}

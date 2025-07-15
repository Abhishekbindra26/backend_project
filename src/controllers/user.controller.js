import {asyncHandler} from "../utils/asyncHandler.js"
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import { uploadCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"

// function to generate tokens
const generateAccessAndRefreshTokens = async(userID)=>{
    try{
        const user = await User.findById(userID)       //getting user instance from db
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken  // saving to database
        await user.save({ validateBeforeSave:false })
        return { accessToken, refreshToken }
    }
    catch(error){
        throw new ApiError(500, "Something went wrong while generating access and refresh tokens")
    }
}

// registering a user
const registerUser = asyncHandler( async (req, res) => {
    // get user details from frontend
    // validation- not empty
    // check if user already exists: username/email
    // check for images, avatar
    // upload them to cloudinary, avatar
    // create user object- create entry in db
    // remove password and refresh token field from response
    // check for user creation
    // return response

    const {fullName, email,username, password} = req.body
    console.log("email:",email);
    if(
        [fullName,email, username, password].some( (field)=> field?.trim() === "" )
    )
    {
        throw new ApiError(400, "Full Name is required")
    }     
    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })

    if(existedUser){
        throw new ApiError(409, "User with current credentials already existed")
    }

    const avatarLocalPath =  req.files?.avatar[0]?.path
    //const coverImageLocalPath = req.files?.coverImage[0]?.path

    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
    coverImageLocalPath = req.files.coverImage[0].path
    }


    if(!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required")
    }
    
    const avatar =  await uploadCloudinary(avatarLocalPath)
    const coverImage = await uploadCloudinary(coverImageLocalPath)

    if(!avatarLocalPath) {
        throw new ApiError(400, " Avatar file is required")
    }

    const user =  await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )
    if(!createdUser){
        throw new ApiError (500, "Something went wrong while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered successfully")
    )

} )

// logging in a user
const loginUser = asyncHandler(async (req, res) => {
    // get details from frontend
    // validate email and password
    // if not already registered route to registration page
    // access/refresh token generation
    // send cookie
    const {email, username, password} = req.body
    if(!username && !email){
        throw new ApiError(400, "username or email is required")
    }
    // User - imported from mongodb, user- instance imported
    const user = await User.findOne({
        $or: [{username}, {email}]
    })

    if(!user){
        throw new ApiError(404, "User does not exist")
    }

    const isPasswordValid = await user.isPasswordCorrect(password) // password- coming from frontend

    if(!isPasswordValid){
        throw new ApiError(404, "Invalid user credentials")
    }
    //   user credentials checked////

    const {accessToken, refreshToken} =  await generateAccessAndRefreshTokens(user._id)
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    // sending cookie
    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken",refreshToken, options)
    .json(
        new ApiResponse(
            200,
            {
                user:loggedInUser, accessToken,refreshToken
            },
            "User loggedIn successfully"
        )
    )

})

const logoutUser = asyncHandler( async(req, res) => {
    // remove cookie and tokens
    await User.findByIdAndUpdate( 
        req.user._id,
        {
            $set:{
                refreshToken:undefined
            }
        },
        {  
            new: true   
        }
    ) 

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200 ,{}, "User logged out successfully"))
})

export { 
    registerUser,
    loginUser,
    logoutUser
}
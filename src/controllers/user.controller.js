import {asyncHandler} from "../utils/asyncHandler.js"
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import { uploadCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import jwt from "jsonwebtoken"
import mongoose from "mongoose"
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
// refresh token so that user dont need to login again and again

const refreshAccessToken = asyncHandler (async(req,res)=>{
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken
    if(!incomingRefreshToken) {
        throw new ApiError(401," unauthorized request")
    }
    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
        const user = await User.findById(decodedToken?._id)
        if(!user) {
            throw new ApiError(401,"Invalid refresh token")
        }
        if(incomingRefreshToken !== user?.refreshToken){
            throw new(401, "Refresh token is expired or used")
        }
    
        const options ={
            httpOnly: true,
            secure: true
        }
        const {accessToken, newRefreshToken} = await generateAccessAndRefreshTokens(user._id)
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(
                200,
                {accessToken, refreshToke:newRefreshToken},
                "Access token refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token")
    }
})

const changeCurrentPassword = asyncHandler(async(req,res)=>{
    const {oldPassword, newPassword} = req.body
    const user = await User.findById(req.user?._id)
    const isPassword = await user.isPasswordCorrect(oldPassword)

    if(isPassword) {
        throw new ApiError(400, "Invalid old password")
    }
    user.password = newPassword
    await user.save({validateBeforeSave: false})

    return res
    .status(200)
    .json(
        new ApiResponse(200,{},"Password changes successfully")
    )
})

const getCurrentUser = asyncHandler(async(req,res)=>{
    return res
    .status(200)
    .json(2000, req.user, "Current user fetched successfully")
})

const updateCurrentDetails = asyncHandler(async(req,res)=>{
    const {fullName, email} = req.body
    if(!fullName || !email) {
        throw new ApiError(400,"All fields are required")
    }
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                fullName,
                email
            }
        },
        {new :true}
    ).select("-password")
    return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"))
})

const updateUserAvatar = asyncHandler(async(req ,res) => {
    const avatarLocalPath = req.file?.path
    if(!avatar) {
        throw new ApiError(400, "Avatar file is missing")
    }
    const avatar = await uploadCloudinary(avatarLocalPath)
    // delete old image
    if(!avatar.url){
        throw new ApiError(400, "Error while uploading avatar")
    }
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar:avatar.url
            }
        },
        {new :true}
    ).select("-password")
    
    return res
    .status(200)
    .json(new ApiResponse(200, user, "avatar updated successfully"))

})

const updateUserCoverImage = asyncHandler(async(req ,res) => {
    const coverImageLocalPath = req.file?.path
    if(!coverImage) {
        throw new ApiError(400, "Cover Image file is missing")
    }
    const coverImage = await uploadCloudinary(coverImageLocalPath)
    // delete old image
    if(!coverImage.url){
        throw new ApiError(400, "Error while uploading CoverImage")
    }
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage: coverImage.url
            }
        },
        {new :true}
    ).select("-password")
    
    return res
    .status(200)
    .json(new ApiResponse(200, user, "cover image updated successfully"))

})

const getUserChannelProfile = asyncHandler(async(req,res)=>{
    const {username} =  req.params  //we get data of a channel from the url i,e params
    if(!username?.trim){
        throw new ApiError(400, "Username is missing")
    }
    const channel = await User.aggregate([
        {
            $match:{
                username: username?.toLowerCase()
            }
        },
        {
            $lookup:{
                from: "subscriptions",  //lowercase and plural in db
                localField: "_id",
                foreignField:"channel",
                as: "subscribers"  // name we can allot
            }
        },
        {
            $lookup:{
                from: "subscriptions",  //lowercase and plural in db
                localField: "_id",
                foreignField:"subscriber",
                as: "subscribedTo" 
            }
        },
        {
            $addFields: {
                subscribersCount:{
                    $size:"$subscribers"
                },
                channelsSubcribedToCount:{
                    $size: "$subscribedTo"
                },
                isSubscribed:{
                    $cond :{
                        if: {$in: [req.user?._id, "subscribers.subscriber"]},
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                channelsSubcribedToCount: 1,
                isSubscribed: 1,
                coverImage: 1,
                email:1
            }
        }
    ])

    if(!channel?.length){
        throw new ApiError(404, "channel does not exist")
    }
    return res
    .status(200)
    .json( new ApiResponse(200, channel[0],"User channel fetched successfully"))

})

const getWatchHistory = asyncHandler(async(req,res)=>{
    const user = await User.aggregate([
        {
            $match:{
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup:{
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline:[
                    {
                        $lookup:{
                            from:"users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline:[
                                {
                                    $project:{
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields:{
                            owner:{
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res
    .status(200)
    .json( new ApiResponse(200, user[0].watchHistory, "Watch history fetched successfully" )
    )
})

export { 
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateCurrentDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
}
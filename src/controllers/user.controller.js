import { User } from "../models/user.model.js";
import {ApiError} from "../utils/ApiError.js";
import {asyncHandler} from "../utils/asyncHandler.js";
import { deleteFromCloudinary, getPublicIdFromUrl, uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"
import nodemailer from "nodemailer"
import axios from "axios";
import { oauth2client } from "../utils/googleConfig.js";

const compareTwoObjects = (obj1,obj2) => {
    let keys = Object.keys(obj1);
    for (let key of keys){
        if (obj1[key] !== obj2[key]){
            return false;
        }
    }
    return true;
}

const FRONTEND_URL = process.env.FRONTEND_URL;
const transporter = nodemailer.createTransport({
  service: 'gmail',
  host: "smtp.gmail.com",
  port: 587,
  secure: false, 
  auth: {
    user: process.env.EMAIL_USER, 
    pass: process.env.APP_PASS, 
  },
});

const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();
        
        user.refreshToken = refreshToken;
        await user.save({validateBeforeSave : false})

        return {accessToken,refreshToken};        
    } catch (error) {
        throw new ApiError(500,"Some Error Occured while generating Access / Refresh Tokens")
    }
}

const sendOtp = asyncHandler(async (req, res) => {
        const { email, password } = req.body;
        if (!(email && password)) {throw new ApiError(400,"All Fields are Required")};
        
          const existingUser = await User.findOne({ email: email });
          if (existingUser) {throw new ApiError(400,"User Already Registered")}
      
          const otp = Math.floor(1000 + Math.random() * 9000); // Generate 6-digit OTP
        //   const hashedPassword = await bcrypt.hash(password, 10);
      
          // Create JWT with OTP and store in cookies
          const token = jwt.sign({ email: email,password: password, otp: otp }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "5m" });
        //   res.cookie("otp_token", token, { httpOnly: true, maxAge: 300000 }); // 5 minutes
      
          // Send OTP Email
          const response = await transporter.sendMail({
            from: process.env.EMAIL,
            to: email,
            subject: "Your OTP Code",
            text: `Your OTP is: ${otp}`,
          });
      
          if (!response) {throw new ApiError(500,'Error sending email')};
    
          res.status(200)
          .cookie("otp_token", token, {
            httpOnly: true,
            secure: true,               // Only over HTTPS
            sameSite: 'None',           // MUST be 'None' for cross-origin cookies
            maxAge: 60 * 60 * 1000, // 7 days
          })
          .json(
            new ApiResponse(
                200,
                {},
                "OTP Sent Successfully"
                )
            );
  });
  
 const verifyOtp = asyncHandler(async (req, res) => {
    const { otp } = req.body;
    if (!otp) {throw new ApiError(400, "OTP is Required")};

    const otpToken = req.cookies.otp_token;
    if (!otpToken) {throw new ApiError(400,"OTP Expired or Invalid")}
  
    let decoded;
        try {
            decoded = jwt.verify(otpToken, process.env.ACCESS_TOKEN_SECRET);
        } catch (error) {
            throw new ApiError(400,'OTP is Expired');  
        }
      if (decoded.otp !== parseInt(otp)) {throw new ApiError(400,"Incorrect OTP")}
  
    //   Create JWT for email confirmation
      const authToken = jwt.sign({ email: decoded.email, password: decoded.password }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "10m" });
    //   res.cookie("auth_token", authToken, { httpOnly: true, maxAge: 600000 });
  
      res.status(200)
      .cookie("auth_token", authToken, {
        httpOnly: true,
        secure: true,               // Only over HTTPS
        sameSite: 'None',           // MUST be 'None' for cross-origin cookies
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      })
      .json(
        new ApiResponse(
            200, {},
            "OTP verified"
        )
      )
  });

const userRegister = asyncHandler(async (req, res) => {
            const { username, fullName } = req.body;
            if (!(username && fullName)) {throw new ApiError(400,"All Fields are Required")};
    
            const authToken = req.cookies.auth_token;
            if (!authToken) {throw new ApiError(400,"Unauthorized Access")};
        
            const avatarLocalPath = req.file?.path
            if (!avatarLocalPath) {throw new ApiError(404,"Avatar file is required")}
            
            const avatar = await uploadOnCloudinary(avatarLocalPath);
            if (!avatar) {throw new ApiError(400,"Avatar file is required")};
        
            let decoded;
              try {
                 decoded = jwt.verify(authToken, process.env.ACCESS_TOKEN_SECRET);
              } catch (error) {
                throw new ApiError(400,'Session Expired');
              }
        
              const user = await User.create({
                email: decoded.email,
                password: decoded.password,
                fullName: fullName,
                username: username.toLowerCase(),
                avatar: avatar.url
            })
        
            const createdUser = await User.findById(user._id).select("-password -refreshToken");
        
            if (!createdUser) {throw new ApiError(500,"Something went wrong while registering user")};
        
            //   const newUser = new User({
            //     email: decoded.email,
            //     password: decoded.hashedPassword,
            //     username,
            //     fullName,
            //     avatar,
            //   });
          
            //   await newUser.save();
            //   res.clearCookie("otp_token");
            //   res.clearCookie("auth_token");
          
            //   res.json({ success: true, message: "User registered successfully" });

            const options = {
                httpOnly: true,
                secure: true,               // Only over HTTPS
                sameSite: 'None',           // MUST be 'None' for cross-origin cookies
                maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            };
        
            res.status(200)
            .clearCookie("otp_token",options)
            .clearCookie("auth_token",options)
            .json(
                new ApiResponse(
                    200, createdUser,
                    "Successfully Registered"
                )
            )
  });

// const userRegister = asyncHandler(async(req,res) => {
//     const {fullName, username, email, password} = req.body    
    
//     if (            
//         [fullName,username,email,password].some((field) => field?.trim() === "")
//     ) throw new ApiError(400,"All Fields are Required");

//     const existingUser = await User.findOne({         
//         $or: [{email},{username}]
//     })

//     if (existingUser) {throw new ApiError(409,"User with Email or Username already Exists")};
        
    // const avatarLocalPath = req.file?.path
    // if (!avatarLocalPath) {throw new ApiError(404,"Avatar file is required")}
    
    // const avatar = await uploadOnCloudinary(avatarLocalPath);
    // if (!avatar) {throw new ApiError(400,"Avatar file is required")};

    // const user = await User.create({
    //     fullName,
    //     username: username.toLowerCase(),
    //     email,
    //     password,
    //     avatar: avatar.url
    // })

    // const createdUser = await User.findById(user._id).select("-password -refreshToken");

    // if (!createdUser) {throw new ApiError(500,"Something went wrong while registering user")};

//     return res.status(200).json(
//         new ApiResponse(201,createdUser,"Successfully Registered")
//     )
// })

const userLogin = asyncHandler(async(req,res) => {
    const {email, username, password} = req.body

    if (!(username || email)){             
        throw new ApiError(404,"Username or Emailis required",)
    }

    if (!password){
        throw new ApiError(404,"Password is required")
    }

    const user = await User.findOne({
        $or : [{username}, {email}]
    });

    if (!user) {throw new ApiError(400, "User with Username or Email Not Found")};

    const isPasswordValid = await user.isPasswordCorrect(password);

    if(!isPasswordValid) {throw new ApiError(404,"Incorrect Password, Try Again !!")}

    const {accessToken, refreshToken} = await generateAccessAndRefreshToken(user._id);

    const loggedinUser = await User.findById(user._id).select("-password -refreshToken");

    const options = {
        httpOnly: true,
        secure: true,               // Only over HTTPS
        sameSite: 'None',           // MUST be 'None' for cross-origin cookies
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    }

    res.status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedinUser, accessToken, refreshToken     
            },
            "Logged In Successfully"
        )
    )
})

// const googleAuth = asyncHandler(async(req,res) => {
//     const { credential } = req.body;
//     if (!credential) {throw new ApiError(400,"Google Credential is Required")};

//     const ticket = await client.verifyIdToken({
//         idToken: credential,
//         audience: process.env.GOOGLE_CLIENT_ID,
//     });

//     const { email, name, picture } = ticket.getPayload();
//     let user = await User.findOne({
//         $or : [{username: name}, {email}]
//     });
    
//     // let newAvatar;
//     // if (picture) {
//     //     newAvatar = picture.replace(/=s\d+-c/, '=s400');
//     //     console.log(newAvatar);
//     // }
//     if (!user) {
//         user = await User.create({
//             email: email,
//             username: name.toLowerCase(),
//             fullName: name,
//             avatar: picture || `https://sbcf.fr/wp-content/uploads/2018/03/sbcf-default-avatar.png`,
//             // avatar: picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}`,
//         })

//         const createdUser = await User.findById(user._id);

//         if (!createdUser) {throw new ApiError(500,"Something went wrong while registering user")};
//     }

//     const options = {
//         httpOnly: true,
//         secure: true,               // Only over HTTPS
//         sameSite: 'None',           // MUST be 'None' for cross-origin cookies
//         maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
//     }

//     const {accessToken, refreshToken} = await generateAccessAndRefreshToken(user._id);
//     return res.status(200)
//     .cookie("accessToken",accessToken,options)
//     .cookie("refreshToken",refreshToken,options)
//     .json(
//         new ApiResponse(
//             200,
//             {
//                 user, accessToken, refreshToken 
//             },
//             "Logged In Successfully"
//         )
//     )
// })

const googleAuth = asyncHandler(async (req, res) => {
    const { code } = req.query;
    
    if (!code) {
        throw new ApiError(400, "Authorization code is required");
    }
    const googleRes = await oauth2client.getToken(code);
    oauth2client.setCredentials(googleRes.tokens);
    const userRes = await axios.get(
        `https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${googleRes.tokens.access_token}`,
    )

    const { email, name, picture } = userRes.data;
    let user = await User.findOne({
        $or: [{ username: name.toLowerCase() }, { email }],
    });

    if (!user) {
        user = await User.create({
            email,
            username: name.toLowerCase(),
            fullName: name,
            avatar:
                picture ||
                'https://sbcf.fr/wp-content/uploads/2018/03/sbcf-default-avatar.png',
        });

        const createdUser = await User.findById(user._id);
        if (!createdUser) {
            throw new ApiError(500, 'Something went wrong while registering user');
        }
    }

    const options = {
        httpOnly: true,
        secure: true,
        sameSite: 'None',
        maxAge: 7 * 24 * 60 * 60 * 1000,
    };

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id);

    return res
        .status(200)
        .cookie('accessToken', accessToken, options)
        .cookie('refreshToken', refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user,
                    accessToken,
                    refreshToken,
                },
                'Logged in successfully'
            )
        );
});

const userLogout = asyncHandler(async(req,res) => {
    await User.findByIdAndUpdate(req.user._id,
        {
            $unset: {          
                refreshToken: 1       
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true,               // Only over HTTPS
        sameSite: 'None',           // MUST be 'None' for cross-origin cookies
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    }

    return res
    .status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(
        new ApiResponse(
            201,
            {},
            "Logged Out Successfully"
        )
    )

})

const checkAuth = asyncHandler(async(req,res) => {
    if (req.user){
        return res.status(200)
        .json(
            new ApiResponse(
                201,
                req.user,
                "Authorized User"
            )
        )
    } else {
        return res.status(401)
        .json(
            new ApiResponse(
                401,{},
                "UnAuthorized User"
            )
        )
    }
})

const refreshAccessToken = asyncHandler( async(req,res) => {
    const currentToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!currentToken) {throw new ApiError(404,"Unauthorized Request")}
    
    try {
        const decodedToken = jwt.verify(currentToken,process.env.REFRESH_TOKEN_SECRET)
    
        const user = await User.findById(decodedToken?._id);
        const decodedUserToken = jwt.verify(user.refreshToken,process.env.REFRESH_TOKEN_SECRET)
    
        if (!user){
            throw new ApiError(404, "Invalid refresh Token");
        }

        if (!compareTwoObjects(decodedToken,decodedUserToken)){
            throw new ApiError(404, "Refresh Token is expired or used");
        }
    
        const {accessToken, refreshToken} = await generateAccessAndRefreshToken(user._id);
    
        const options = {
            httpOnly: true,
            secure: true,               // Only over HTTPS
            sameSite: 'None',           // MUST be 'None' for cross-origin cookies
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        }
    
        return res.status(200)
        .cookie("accessToken",accessToken,options)
        .cookie("refreshToken",refreshToken,options)
        .json(
            new ApiResponse(
                201,
                {accessToken,refreshToken},
                "Successfully Refreshed Access Token"
            )
        )
    } catch (error) {
        console.log(error);
        throw new ApiError(400, "Error in Refreshing Access Token")
    }

})

const getCurrentUserDetails = asyncHandler(async(req,res) => {
    const user = req.user;
    return res.status(200)
    .json(
        new ApiResponse(201, user, "User Fetched Successfully")
    )
})


const updateAccountDetails = asyncHandler(async(req,res) => {
    const {fullName, email, username} = req.body

    if (! (fullName && email && username) ) {throw new ApiError(404, "All Fields are Required")};

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName : fullName,
                email : email,
                username: username
            }
        },
        {new: true}
    ).select("-password -refreshToken");

    return res.status(200)
    .json(
        new ApiResponse(
            201,
            {user},
            "Account Details Updated Successfully"
        )
    )
})

const updateAvatar = asyncHandler(async(req,res) => {
    const avatarLocalPath = req.file?.path;

    if (!avatarLocalPath) {throw new ApiError(400, "Avatar File is Required")}

    const newAvatar = await uploadOnCloudinary(avatarLocalPath);

    if (!newAvatar) {throw new ApiError(400,"Error occured while uploading on cloudinary")}

    const user = await User.findById(req.user._id);
    const oldAvatar = user.avatar;

    const updatedUser = await User.findByIdAndUpdate(req.user._id,
        {
            $set: {
                avatar: newAvatar.secure_url
            }
        },
        {new: true}
    ).select("-password -refreshToken");

    try {
        getPublicIdFromUrl(oldAvatar)
        .then((value) => deleteFromCloudinary(value,"image"))
    } catch (error) {
        throw new ApiError(400, "Error Deleting old file from cloudinary")
    }

    res.status(200)
    .json(
        new ApiResponse(
            201,
            {user: updatedUser},
            "Avatar Updated Successfully"
        )
    )
})

const changeCurrentPassword = asyncHandler(async(req,res) => {
    const {oldPassword, newPassword} = req.body

    if (!(oldPassword && newPassword)) {throw new ApiError(404, "All Fields are Required")}

    const user = await User.findById(req.user._id);
    const isPasswordValid = await user.isPasswordCorrect(oldPassword);

    if (!isPasswordValid) {throw new ApiError(400,"Invalid Current Password")};

    user.password = newPassword;
    await user.save({validateBeforeSave: false});

    return res.status(200)
    .json(
        new ApiResponse(201,{},"Password Updated Successfully")
    )

})


const forgotPassword = asyncHandler(async(req,res) => {
    const {email} = req.body;
    if (!email) {throw new ApiError(404,"Email is Required")};
    
    const user = await User.findOne({email: email});
    if (!user) {throw new ApiError(404,"User not found")};
    // console.log(user);

    const token = jwt.sign({ userId: user._id }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '15m' });

    const resetLink = `${FRONTEND_URL}/resetpassword/${token}`;
    const response = await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Password Reset Request',
      html: `<p>Click the link below to reset your password:</p>
             <a href="${resetLink}">${resetLink}</a>
             <p>This link is valid for 15 minutes.</p>`,
    });
    // console.log(response);
    if (!response) {throw new ApiError(500,'Error sending email')};

    res.status(200)
    .json(
        new ApiResponse(
            200,response,
            "Password Reset Email Sent Successfully"
        )
    )
})

const verifyToken = asyncHandler(async(req,res) => {
    const {token} = req.params;
    if (!token) {throw new ApiError(400,"Access Token is Required")}
        
    let decodedToken;
    try {
        decodedToken = jwt.verify(token,process.env.ACCESS_TOKEN_SECRET);
    } catch (error) {
        throw new ApiError(400,'Link is Expired');
    }
        
    const user = await User.findById(decodedToken.userId);
    if (!user){
        throw new ApiError(404,'User not found');
    }

    res.status(200)
    .json(
        new ApiResponse(
            200,{},
            "User Verified Successfully"
        )
    )
})

const resetPassword = asyncHandler(async(req,res) => {
    const {token, newPassword} = req.body;
    if (!token) {throw new ApiError(400,"Access Token is Required")}
    
    // const decodedToken = jwt.verify(token,process.env.ACCESS_TOKEN_SECRET);

    // if (!decodedToken && !decodedToken._id){
    //     throw new ApiError(400,'Invalid or expired token');
    // }

    let decodedToken;
    try {
        decodedToken = jwt.verify(token,process.env.ACCESS_TOKEN_SECRET);
    } catch (error) {
        throw new ApiError(400,'Link is Expired');
    }

    const user = await User.findById(decodedToken.userId);
    if (!user){
        throw new ApiError(404,'User not found');
    }

    user.password = newPassword;
    await user.save({validateBeforeSave: false});

    res.status(200)
    .json(
        new ApiResponse(
            200,
            "Password Reset Successfully"
        )
    )
}) 


//Phone Number Feature at Profile
// const sendMobileOtp = asyncHandler(async (req, res) => {
//     try {
//         const { phoneNumber } = req.body;
//         console.log(phoneNumber);
        
        
//         let otp;
//         if (!phoneNumber) {
//             throw new ApiError(400, "Phone number is required");
//         }
    
//         // Check if user is already registered
//         const existingUser = await User.findOne({ phoneNumber });
//         if (existingUser) {
//           throw new ApiError(400, "User Already Registered");
//         }
    
//         const options = {
//             method: 'POST',
//             url: 'https://sms-verify3.p.rapidapi.com/send-numeric-verify',
//             headers: {
//               'x-rapidapi-key': 'a8a247d2d3mshff63a0fb138c833p17d789jsnd532608de621',
//               'x-rapidapi-host': 'sms-verify3.p.rapidapi.com',
//               'Content-Type': 'application/json'
//             },
//             data: {target: `+91 ${phoneNumber}`}
//           };
          
//           const response = await axios.request(options);
//           if (response.status !== "success") { throw new ApiError(500, `Error sending OTP: ${response}`) };
//           otp = response.data.verify_code;
    
//             const token = jwt.sign(
//             { phoneNumber, otp },
//             process.env.ACCESS_TOKEN_SECRET,
//             { expiresIn: "5m" }
//             );
      
//             res.status(200)
//             .cookie("otp_token", token, { httpOnly: true, maxAge: 300000 }) // 5 min expiry
//             .json(
//                 new ApiResponse(
//                     200, {}, 
//                     "OTP Sent Successfully"
//                 )
//             );
//     } catch (error) {
//         console.log(error);
//     }
//   });

// const verifyMobileOtp = asyncHandler(async (req, res) => {
//     const { otp } = req.body;
//     if (!otp) {
//       throw new ApiError(400, "OTP is required");
//     }
  
//     const otpToken = req.cookies.otp_token;
//     if (!otpToken) {
//       throw new ApiError(400, "OTP Expired or Invalid");
//     }
  
//     let decoded;
//     try {
//       decoded = jwt.verify(otpToken, process.env.ACCESS_TOKEN_SECRET);
//     } catch (error) {
//       throw new ApiError(400, "OTP is Expired");
//     }
  
//     if (decoded.otp !== parseInt(otp)) {
//       throw new ApiError(400, "Incorrect OTP");
//     }

//     const user = await User.findByIdAndUpdate(req.user._id,
//         {
//             $set: {
//                 phoneNumber : decoded.phoneNumber
//             }
//         },
//         {new: true}
//     );

//   if (!user) {
//     throw new ApiError(404, "User not found");
//   }

//     res
//       .status(200)
//       .clearCookie("otp_token")
//       .json(
//         new ApiResponse(
//             200, {}, 
//             "Mobile Number Updated Successfully"
//         )
//     );
//   });

export {
    sendOtp,
    verifyOtp,
    userRegister,
    userLogin,
    googleAuth,
    userLogout,
    checkAuth,
    refreshAccessToken,
    getCurrentUserDetails,
    updateAccountDetails,
    updateAvatar,
    changeCurrentPassword,
    forgotPassword,
    verifyToken,
    resetPassword,
    // sendMobileOtp,
    // verifyMobileOtp
}
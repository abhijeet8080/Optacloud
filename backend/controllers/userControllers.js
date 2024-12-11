// controllers/UserController.js

const User = require("../model/UserModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto"); // Import crypto for token generation
const { getUserDetailsFromToken } = require("../middleware/auth");
const { sendVerificationCode, sendWelcomeMail, sendPasswordResetEmail } = require("../middleware/Email"); // Update to include sendPasswordResetEmail

// Register User
const registerUser = async (req, res) => {
  try {
    console.log("Register User called");
    const { name, email, password, profile_pic } = req.body;
    // //console.log("Register User Request:", req.body); // Debugging

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        message: "User Already Exists",
        error: true,
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    const newUser = new User({
      name,
      email,
      profile_pic,
      password: hashedPassword,
      verificationCode,
      isVerified: false, // Assuming you have this field
    });

    const savedUser = await newUser.save();

    // Send Verification Email
    await sendVerificationCode({
      name:savedUser.name,
      mail: savedUser.email,
      subject: "Verify your Email",
      verificationCode: verificationCode,
    });

    // Optionally send Welcome Email after verification

    const userResponse = savedUser.toObject();
    delete userResponse.password;
    delete userResponse.verificationCode;

    return res.status(201).json({
      message: "User Created Successfully. Please verify your email.",
      data: userResponse,
      success: true,
    });
  } catch (error) {

    console.error("Registration Error:", error);
    return res.status(500).json({
      message: error.message || "Internal Server Error",
      error: true,
    });
  }
};

// Verify Email
const verifyEmail = async (req, res) => {
  try {
    console.log("Verify email called");

    const { email, verificationCode } = req.body;
    // //console.log("Verify Email Request:", req.body); // Debugging

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({
        message: "Invalid Email",
        error: true,
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        message: "Email is already verified",
        error: true,
      });
    }

    if (user.verificationCode !== verificationCode) {
      return res.status(400).json({
        message: "Invalid Verification Code",
        error: true,
      });
    }

    user.isVerified = true;
    user.verificationCode = undefined; // Remove the code
    await user.save();

    // Optionally send Welcome Email after verification
    // await sendWelcomeMail({
    //   mail: user.email,
    //   subject: "Welcome to ChatWave",
    //   name: user.name,
    // });
    const tokenData = {
      id: user._id,
      email: user.email,
    };

    const token = await jwt.sign(tokenData, process.env.JWT_SECRET, {
      expiresIn: "5d",
    });

    const cookieOptions = {
      httpOnly: true, // Corrected from 'http' to 'httpOnly'
      secure: process.env.NODE_ENV === "production", // Secure only in production
    };

    return res.status(200).json({
      message: "Email Verified Successfully",
      success: true,
      token: token,
    });
  } catch (error) {
    console.error("Email Verification Error:", error);
    return res.status(500).json({
      message: error.message || "Internal Server Error",
      error: true,
    });
  }
};

// Check Mail
const checkMail = async (req, res) => {
  try {
    console.log("checkMail called");
    const { email } = req.body;
    const user = await User.findOne({ email }).select("-password");

    if (!user) {
      // If user not found, return an error
      return res.status(400).json({
        message: "Email Does Not Exist",
        error: true,
      });
    }

    // If user is found, return success message
    return res.status(200).json({
      message: "Email Verified",
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("CheckMail Error:", error);

    return res.status(500).json({
      message: error.message || error,
      error: true,
    });
  }
};

// Check Password
const checkPassword = async (req, res) => {
  try {
    console.log("Check password called");

    const { userId, password } = req.body;
    // //console.log(req.body);

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
        error: true,
      });
    }

    const verifyPassword = await bcrypt.compare(password, user.password);

    if (!verifyPassword) {
      return res.status(400).json({
        message: "Please check your password",
        error: true,
      });
    }

    const tokenData = {
      id: user._id,
      email: user.email,
    };

    const token = await jwt.sign(tokenData, process.env.JWT_SECRET, {
      expiresIn: "5d",
    });

    const cookieOptions = {
      httpOnly: true, // Corrected from 'http' to 'httpOnly'
      secure: process.env.NODE_ENV === "production", // Secure only in production
    };

    // Set cookie and respond
    res.cookie("token", token, cookieOptions).status(200).json({
      message: "Login Successfully",
      success: true,
      token: token,
    });
  } catch (error) {
    console.error("CheckPassword Error:", error);

    return res.status(500).json({
      message: error.message || error,
      error: true,
    });
  }
};

// Get User Details
const getUserDetails = async (req, res) => {
  try {
    console.log("Get user details called");
    const token = req.headers.authorization;
    if (!token || !token.startsWith("Bearer ")) {
      throw new ErrorHandler("Please Login to access this resource", 401);
    }
    const authToken = token.split(" ")[1];

    const user = await getUserDetailsFromToken(authToken); // Await here

    if (!user) {
      return res.status(401).json({
        message: "Unauthorized access. Please login again.",
        logout: true,
        error: true,
      });
    }

    return res.status(200).json({
      message: "User details fetched successfully",
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("Get User Details Error: ",error)
    return res.status(500).json({
      message: error.message || error,
      error: true,
    });
  }
};

// Logout
const logout = async (req, res) => {
  try {
    const cookieOptions = {
      httpOnly: true, // Changed from 'http' to 'httpOnly'
      secure: process.env.NODE_ENV === "production", // Set secure based on environment
      expires: new Date(Date.now() - 1000), // Set to expire immediately
    };

    //console.log("Logging out user..."); // Optional logging for debugging

    return res.cookie("token", "", cookieOptions).status(200).json({
      message: "Session out",
      success: true,
    });
  } catch (error) {
    console.error("Logout Error:", error);

    return res.status(500).json({
      message: error.message || error,
      error: true,
    });
  }
};

// Update User Details
const updateUserDetails = async (req, res) => {
  try {
    console.log("Update User Details called")
    const token = req.body.token || ""; // Correctly extract the token
    const user = await getUserDetailsFromToken(token);
    //console.log(user);

    if (!user) {
      return res.status(401).json({
        message: "Unauthorized access. Please login again.",
        error: true,
      });
    }

    const { name, profile_pic } = req.body;
    //console.log(req.body);

    // Validate input
    if (!name && !profile_pic) {
      return res.status(400).json({
        message: "Please provide at least one field to update.",
        error: true,
      });
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (profile_pic) updateData.profile_pic = profile_pic;

    const updateUser = await User.updateOne(
      { _id: user._id },
      { $set: updateData }
    );

    if (updateUser.nModified === 0) {
      return res.status(404).json({
        message: "User not found or no changes made.",
        error: true,
      });
    }

    // Optionally fetch the updated user info
    const userInfo = await User.findById(user._id).select("-password");
    //console.log(userInfo);

    return res.status(200).json({
      message: "User Details Updated Successfully",
      data: userInfo,
      success: true,
    });
  } catch (error) {
    console.error("Error updating user details:", error);
    return res.status(500).json({
      message: error.message || error,
      error: true,
    });
  }
};



// Forgot Password
const forgotPassword = async (req, res) => {
  try {
    console.log("Forgot Password called");

    const { email } = req.body;

    //console.log("Forgot Password Request:", req.body);

    if (!email) {
      return res.status(400).json({
        message: "Please provide your email address.",
        error: true,
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      // To prevent email enumeration, respond with a generic message
      return res.status(200).json({
        message: "If that email address is in our database, we will send you an email to reset your password.",
        success: true,
      });
    }

    // Generate a secure random token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");

    // Set token and expiration on user model
    user.resetPasswordToken = resetTokenHash;
    user.resetPasswordExpires = Date.now() + 60 * 60 * 1000; // 1 hour from now

    await user.save();

    // Create a reset URL
    const resetUrl = `${process.env.FRONTEND_URL}/forgot-password/${resetToken}`;

    // Send password reset email
    await sendPasswordResetEmail({
      mail: user.email,
      subject: "Password Reset Request",
      name: user.name,
      resetUrl: resetUrl,
    });

    return res.status(200).json({
      message: "If that email address is in our database, we will send you an email to reset your password.",
      success: true,
    });
  } catch (error) {
    console.error("Forgot Password Error:", error);
    return res.status(500).json({
      message: "Internal Server Error",
      error: true,
    });
  }
};

// Reset Password Controller
const resetPassword = async (req, res) => {
  console.log("reset password called");
  try {

    const { token } = req.params; 
    const { newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        message: "Invalid request.",
        error: true,
      });
    }

    const resetTokenHash = crypto.createHash("sha256").update(token).digest("hex");

    // Find user by reset token and check if token has not expired
    const user = await User.findOne({
      resetPasswordToken: resetTokenHash,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        message: "Invalid or expired token.",
        error: true,
      });
    }

    // Hash the new password before saving
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update user's password and remove reset token fields
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    // Optionally, you can send a confirmation email here

    return res.status(200).json({
      message: "Password has been reset successfully.",
      success: true,
    });
  } catch (error) {
    console.error("Reset Password Error:", error);
    return res.status(500).json({
      message: "Internal Server Error",
      error: true,
    });
  }
};


module.exports = {
  registerUser,
  verifyEmail,
  checkMail,
  checkPassword,
  getUserDetails,
  logout,
  updateUserDetails,
  forgotPassword,
  resetPassword, 
};

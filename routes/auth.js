const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { auth } = require("../middleware/auth");

const router = express.Router();

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET || "your-secret-key", {
    expiresIn: "7d",
  });
};

router.post("/wallet-login", async (req, res) => {
  try {
    const { walletAddress } = req.body;
    if (!walletAddress) {
      return res.status(400).json({ message: "Wallet address is required" });
    }

    let user = await User.findOne({ walletAddress });
    if (!user) {
      user = new User({
        walletAddress,
        username: `user_${walletAddress.slice(0, 8)}_${Date.now().toString(
          36
        )}`,
        balance: 1000,
      });
      await user.save();
    }

    const token = generateToken(user._id);
    user.lastLogin = new Date();
    await user.save();

    res.json({
      message: "Wallet login successful",
      token,
      user: {
        id: user._id,
        username: user.username,
        walletAddress: user.walletAddress,
        balance: user.balance,
        isAdmin: user.isAdmin,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    console.error("Wallet login error:", error);
    res.status(500).json({ message: "Server error during wallet login" });
  }
});

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post("/register", async (req, res) => {
  try {
    const { email, walletAddress, password, username } = req.body;

    // Validate input
    if (!email && !walletAddress) {
      return res
        .status(400)
        .json({ message: "Either email or wallet address is required" });
    }

    // Check if user already exists
    let existingUser = null;
    if (email) {
      existingUser = await User.findOne({ email: email.toLowerCase() });
    }
    if (walletAddress && !existingUser) {
      existingUser = await User.findOne({ walletAddress });
    }

    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Create new user
    const userData = {
      username: username || `user_${Date.now()}`,
      balance: 1000, // Starting balance
    };

    if (email) userData.email = email.toLowerCase();
    if (walletAddress) userData.walletAddress = walletAddress;
    if (password) userData.password = password;

    const user = new User(userData);
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    res.status(201).json({
      message: "User registered successfully",
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        walletAddress: user.walletAddress,
        balance: user.balance,
        isAdmin: user.isAdmin,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Server error during registration" });
  }
});

// @route   POST /api/auth/admin-register
// @desc    Register or elevate an admin by wallet address
// @access  Public (guarded by possession of wallet address; use responsibly)
router.post("/admin-register", async (req, res) => {
  try {
    const { walletAddress } = req.body;
    if (!walletAddress) {
      return res.status(400).json({ message: "Wallet address is required" });
    }

    let user = await User.findOne({ walletAddress });
    if (!user) {
      user = new User({
        walletAddress,
        username: `admin_${Date.now()}`,
        balance: 1000,
      });
    }
    user.isAdmin = true;
    await user.save();

    const token = generateToken(user._id);

    res.status(201).json({
      message: "Admin registered successfully",
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        walletAddress: user.walletAddress,
        balance: user.balance,
        isAdmin: user.isAdmin,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    console.error("Admin registration error:", error);
    res.status(500).json({ message: "Server error during admin registration" });
  }
});

// @route   POST /api/auth/admin-login
// @desc    Admin login via wallet address only
// @access  Public
router.post("/admin-login", async (req, res) => {
  try {
    const { walletAddress } = req.body;
    if (!walletAddress) {
      return res.status(400).json({ message: "Wallet address is required" });
    }
    const user = await User.findOne({ walletAddress, isAdmin: true });
    if (!user) {
      return res.status(400).json({ message: "Admin not found" });
    }
    const token = generateToken(user._id);
    user.lastLogin = new Date();
    await user.save();
    res.json({
      message: "Admin login successful",
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        walletAddress: user.walletAddress,
        balance: user.balance,
        isAdmin: user.isAdmin,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    console.error("Admin login error:", error);
    res.status(500).json({ message: "Server error during admin login" });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post("/login", async (req, res) => {
  try {
    const { email, walletAddress, password } = req.body;

    // Validate input
    if (!email && !walletAddress) {
      return res
        .status(400)
        .json({ message: "Either email or wallet address is required" });
    }

    // Find user
    let user = null;
    if (email) {
      user = await User.findOne({ email: email.toLowerCase() });
    } else if (walletAddress) {
      user = await User.findOne({ walletAddress });
    }

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Check password if provided
    if (password && user.password) {
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(400).json({ message: "Invalid credentials" });
      }
    }

    // Generate token
    const token = generateToken(user._id);

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        walletAddress: user.walletAddress,
        balance: user.balance,
        isAdmin: user.isAdmin,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error during login" });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    res.json(user);
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put("/profile", auth, async (req, res) => {
  try {
    const { username, avatar, email, walletAddress } = req.body;
    const updateData = {};

    if (username) updateData.username = username;
    if (avatar) updateData.avatar = avatar;
    if (email) updateData.email = email.toLowerCase();
    if (walletAddress) updateData.walletAddress = walletAddress;

    const user = await User.findByIdAndUpdate(req.user._id, updateData, {
      new: true,
      runValidators: true,
    }).select("-password");

    res.json({
      message: "Profile updated successfully",
      user,
    });
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).json({ message: "Server error during profile update" });
  }
});

// @route   POST /api/auth/logout
// @desc    Logout user (client-side token removal)
// @access  Private
router.post("/logout", auth, async (req, res) => {
  try {
    // In a real application, you might want to blacklist the token
    // For now, we'll just return a success message
    res.json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ message: "Server error during logout" });
  }
});

// @route   POST /api/auth/refresh
// @desc    Refresh JWT token
// @access  Private
router.post("/refresh", auth, async (req, res) => {
  try {
    const token = generateToken(req.user._id);
    res.json({
      message: "Token refreshed successfully",
      token,
      user: {
        id: req.user._id,
        username: req.user.username,
        email: req.user.email,
        walletAddress: req.user.walletAddress,
        balance: req.user.balance,
        isAdmin: req.user.isAdmin,
        avatar: req.user.avatar,
      },
    });
  } catch (error) {
    console.error("Token refresh error:", error);
    res.status(500).json({ message: "Server error during token refresh" });
  }
});

module.exports = router;

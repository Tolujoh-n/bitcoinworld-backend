const express = require("express");
const User = require("../models/User");
const Trade = require("../models/Trade");
const Poll = require("../models/Poll");
const { auth } = require("../middleware/auth");

const router = express.Router();

// @route   GET /api/users/profile
// @desc    Get user profile
// @access  Private
router.get("/profile", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    res.json(user);
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put("/profile", auth, async (req, res) => {
  try {
    const { username, email, avatar } = req.body; // Remove walletAddress from destructure
    const updateData = {};

    if (username) updateData.username = username;
    if (email) updateData.email = email.toLowerCase();
    if (avatar) updateData.avatar = avatar;

    // Don't allow walletAddress change
    // if (walletAddress) updateData.walletAddress = walletAddress;

    const user = await User.findByIdAndUpdate(req.user._id, updateData, {
      new: true,
      runValidators: true,
    }).select("-password");

    res.json({
      message: "Profile updated successfully",
      user,
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   GET /api/users/trades
// @desc    Get user's trading history
// @access  Private
router.get("/trades", auth, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;

    const query = { user: req.user._id };
    if (status) {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const trades = await Trade.find(query)
      .populate("poll", "title category image")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Trade.countDocuments(query);

    res.json({
      trades,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        total,
        hasNext: skip + trades.length < total,
        hasPrev: parseInt(page) > 1,
      },
    });
  } catch (error) {
    console.error("Get user trades error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   GET /api/users/portfolio
// @desc    Get user's portfolio (active positions)
// @access  Private
router.get("/portfolio", auth, async (req, res) => {
  try {
    // Get user's active trades
    const activeTrades = await Trade.find({
      user: req.user._id,
      status: "completed",
    }).populate(
      "poll",
      "title category image endDate isResolved winningOption"
    );

    // Group by poll and calculate positions
    const portfolio = {};

    for (const trade of activeTrades) {
      const pollId = trade.poll._id.toString();

      if (!portfolio[pollId]) {
        portfolio[pollId] = {
          poll: trade.poll,
          positions: {},
          totalInvested: 0,
          currentValue: 0,
        };
      }

      const optionKey = `option_${trade.optionIndex}`;
      if (!portfolio[pollId].positions[optionKey]) {
        portfolio[pollId].positions[optionKey] = {
          optionIndex: trade.optionIndex,
          amount: 0,
          averagePrice: 0,
          totalCost: 0,
        };
      }

      const position = portfolio[pollId].positions[optionKey];
      const cost = trade.amount * trade.price;

      position.amount += trade.amount;
      position.totalCost += cost;
      position.averagePrice = position.totalCost / position.amount;

      portfolio[pollId].totalInvested += cost;
    }

    // Calculate current values and P&L
    const portfolioArray = Object.values(portfolio).map((item) => {
      let currentValue = 0;
      let unrealizedPnL = 0;

      Object.values(item.positions).forEach((position) => {
        const option = item.poll.options[position.optionIndex];
        if (option) {
          const marketValue = position.amount * (option.percentage / 100);
          currentValue += marketValue;
          unrealizedPnL += marketValue - position.totalCost;
        }
      });

      return {
        ...item,
        currentValue,
        unrealizedPnL,
        positions: Object.values(item.positions),
      };
    });

    res.json(portfolioArray);
  } catch (error) {
    console.error("Get portfolio error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   GET /api/users/created-polls
// @desc    Get polls created by user
// @access  Private
router.get("/created-polls", auth, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;

    const query = { createdBy: req.user._id };
    if (status === "active") {
      query.isActive = true;
    } else if (status === "resolved") {
      query.isResolved = true;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const polls = await Poll.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Poll.countDocuments(query);

    res.json({
      polls,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        total,
        hasNext: skip + polls.length < total,
        hasPrev: parseInt(page) > 1,
      },
    });
  } catch (error) {
    console.error("Get created polls error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   GET /api/users/saved-polls
// @desc    Get user's saved polls
// @access  Private
router.get("/saved-polls", auth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const user = await User.findById(req.user._id).populate({
      path: "savedPolls",
      match: { isActive: true },
      populate: { path: "createdBy", select: "username avatar" },
      options: {
        sort: { createdAt: -1 },
        skip: (parseInt(page) - 1) * parseInt(limit),
        limit: parseInt(limit),
      },
    });

    const total = user.savedPolls.length;

    res.json({
      polls: user.savedPolls,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        total,
        hasNext:
          (parseInt(page) - 1) * parseInt(limit) + user.savedPolls.length <
          total,
        hasPrev: parseInt(page) > 1,
      },
    });
  } catch (error) {
    console.error("Get saved polls error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   GET /api/users/stats
// @desc    Get user statistics
// @access  Private
router.get("/stats", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    // Get trading statistics
    const totalTrades = await Trade.countDocuments({
      user: req.user._id,
      status: "completed",
    });
    const winningTrades = await Trade.countDocuments({
      user: req.user._id,
      status: "completed",
      optionIndex: { $exists: true },
    });

    // Get poll creation statistics
    const createdPolls = await Poll.countDocuments({ createdBy: req.user._id });
    const activePolls = await Poll.countDocuments({
      createdBy: req.user._id,
      isActive: true,
    });

    // Calculate win rate
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

    // Get recent activity
    const recentTrades = await Trade.find({ user: req.user._id })
      .populate("poll", "title category")
      .sort({ createdAt: -1 })
      .limit(5);

    const stats = {
      balance: user.balance,
      totalTrades: user.totalTrades,
      successfulTrades: user.successfulTrades,
      winRate: Math.round(winRate * 100) / 100,
      createdPolls,
      activePolls,
      recentTrades,
    };

    res.json(stats);
  } catch (error) {
    console.error("Get user stats error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   GET /api/users/:id
// @desc    Get public user profile
// @access  Public
router.get("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select("username avatar totalTrades successfulTrades createdAt")
      .lean();

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get user's public polls
    const publicPolls = await Poll.find({
      createdBy: req.params.id,
      isActive: true,
    })
      .select("title category totalVolume totalTrades createdAt")
      .sort({ createdAt: -1 })
      .limit(5);

    const publicProfile = {
      ...user,
      polls: publicPolls,
    };

    res.json(publicProfile);
  } catch (error) {
    console.error("Get public profile error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;

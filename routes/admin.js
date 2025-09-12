const express = require("express");
const Poll = require("../models/Poll");
const User = require("../models/User");
const Trade = require("../models/Trade");
const Comment = require("../models/Comment");
const { adminAuth } = require("../middleware/auth");

const router = express.Router();

// @route   GET /api/admin/dashboard
// @desc    Get admin dashboard statistics
// @access  Private (Admin)
router.get("/dashboard", adminAuth, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalPolls = await Poll.countDocuments();
    const activePolls = await Poll.countDocuments({ isActive: true });
    const totalTrades = await Trade.countDocuments({ status: "completed" });
    const totalVolume = await Trade.aggregate([
      { $match: { status: "completed" } },
      { $group: { _id: null, total: { $sum: "$totalValue" } } },
    ]);

    const recentPolls = await Poll.find()
      .populate("createdBy", "username")
      .sort({ createdAt: -1 })
      .limit(5);

    const topUsers = await User.find()
      .sort({ totalTrades: -1 })
      .limit(10)
      .select("username totalTrades successfulTrades balance");

    const stats = {
      totalUsers,
      totalPolls,
      activePolls,
      totalTrades,
      totalVolume: totalVolume[0]?.total || 0,
      recentPolls,
      topUsers,
    };

    res.json(stats);
  } catch (error) {
    console.error("Admin dashboard error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   GET /api/admin/polls
// @desc    Get all polls for admin management
// @access  Private (Admin)
router.get("/polls", adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, category } = req.query;

    const query = {};
    if (status) query.isActive = status === "active";
    if (category) query.category = category;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const polls = await Poll.find(query)
      .populate("createdBy", "username email")
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
    console.error("Admin get polls error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   PUT /api/admin/polls/:id
// @desc    Update poll as admin
// @access  Private (Admin)
router.put("/polls/:id", adminAuth, async (req, res) => {
  try {
    const poll = await Poll.findById(req.params.id);

    if (!poll) {
      return res.status(404).json({ message: "Poll not found" });
    }

    const updatedPoll = await Poll.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).populate("createdBy", "username email");

    // Emit live update to room
    const io = req.app.get("io");
    if (io) {
      io.to(`poll-${req.params.id}`).emit("poll-updated", {
        pollId: req.params.id,
        poll: updatedPoll,
      });
    }

    res.json({
      message: "Poll updated successfully",
      poll: updatedPoll,
    });
  } catch (error) {
    console.error("Admin update poll error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   DELETE /api/admin/polls/:id
// @desc    Delete poll as admin
// @access  Private (Admin)
router.delete("/polls/:id", adminAuth, async (req, res) => {
  try {
    const poll = await Poll.findById(req.params.id);

    if (!poll) {
      return res.status(404).json({ message: "Poll not found" });
    }

    // Hard delete the poll
    await Poll.findByIdAndDelete(req.params.id);

    // Also delete related trades and comments
    await Trade.deleteMany({ poll: req.params.id });
    await Comment.deleteMany({ poll: req.params.id });

    res.json({ message: "Poll deleted successfully" });
  } catch (error) {
    console.error("Admin delete poll error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   POST /api/admin/polls/:id/resolve
// @desc    Resolve a poll as admin
// @access  Private (Admin)
router.post("/polls/:id/resolve", adminAuth, async (req, res) => {
  try {
    const { winningOption } = req.body;

    if (winningOption === undefined) {
      return res.status(400).json({ message: "Winning option is required" });
    }

    const poll = await Poll.findById(req.params.id);

    if (!poll) {
      return res.status(404).json({ message: "Poll not found" });
    }

    if (poll.isResolved) {
      return res.status(400).json({ message: "Poll is already resolved" });
    }

    if (winningOption < 0 || winningOption >= poll.options.length) {
      return res.status(400).json({ message: "Invalid winning option" });
    }

    poll.isResolved = true;
    poll.winningOption = winningOption;
    poll.isActive = false;

    await poll.save();

    // Mark winning trades as eligible for claim and set payout amounts
    await markWinningTradesEligible(poll);

    // Emit live resolve to room
    const io = req.app.get("io");
    if (io) {
      io.to(`poll-${req.params.id}`).emit("poll-resolved", {
        pollId: req.params.id,
        winningOption: poll.winningOption,
        poll,
      });
    }

    res.json({
      message: "Poll resolved successfully",
      poll,
    });
  } catch (error) {
    console.error("Admin resolve poll error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   GET /api/admin/users
// @desc    Get all users for admin management
// @access  Private (Admin)
router.get("/users", adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;

    const query = {};
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { walletAddress: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const users = await User.find(query)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      users,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        total,
        hasNext: skip + users.length < total,
        hasPrev: parseInt(page) > 1,
      },
    });
  } catch (error) {
    console.error("Admin get users error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   PUT /api/admin/users/:id
// @desc    Update user as admin
// @access  Private (Admin)
router.put("/users/:id", adminAuth, async (req, res) => {
  try {
    const { balance, isAdmin, isBanned } = req.body;

    const updateData = {};
    if (balance !== undefined) updateData.balance = balance;
    if (isAdmin !== undefined) updateData.isAdmin = isAdmin;
    if (isBanned !== undefined) updateData.isBanned = isBanned;

    const user = await User.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    }).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      message: "User updated successfully",
      user,
    });
  } catch (error) {
    console.error("Admin update user error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   DELETE /api/admin/users/:id
// @desc    Delete user as admin
// @access  Private (Admin)
router.delete("/users/:id", adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Delete user and all related data
    await User.findByIdAndDelete(req.params.id);
    await Trade.deleteMany({ user: req.params.id });
    await Comment.deleteMany({ user: req.params.id });

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Admin delete user error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   GET /api/admin/trades
// @desc    Get all trades for admin monitoring
// @access  Private (Admin)
router.get("/trades", adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 50, status, pollId } = req.query;

    const query = {};
    if (status) query.status = status;
    if (pollId) query.poll = pollId;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const trades = await Trade.find(query)
      .populate("user", "username email")
      .populate("poll", "title category")
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
    console.error("Admin get trades error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   GET /api/admin/comments
// @desc    Get flagged comments for moderation
// @access  Private (Admin)
router.get("/comments", adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, flagged } = req.query;

    const query = {};
    if (flagged === "true") {
      query.isFlagged = true;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const comments = await Comment.find(query)
      .populate("user", "username email")
      .populate("poll", "title category")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Comment.countDocuments(query);

    res.json({
      comments,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        total,
        hasNext: skip + comments.length < total,
        hasPrev: parseInt(page) > 1,
      },
    });
  } catch (error) {
    console.error("Admin get comments error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   POST /api/admin/comments/:id/moderate
// @desc    Moderate a comment
// @access  Private (Admin)
router.post("/comments/:id/moderate", adminAuth, async (req, res) => {
  try {
    const { action } = req.body; // 'approve', 'delete', 'warn'

    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    switch (action) {
      case "approve":
        comment.isFlagged = false;
        comment.flaggedBy = [];
        break;
      case "delete":
        await comment.softDelete();
        break;
      case "warn":
        // Add warning to comment
        comment.notes = "Comment flagged by admin for review";
        break;
      default:
        return res.status(400).json({ message: "Invalid action" });
    }

    await comment.save();

    res.json({
      message: `Comment ${action}ed successfully`,
      comment,
    });
  } catch (error) {
    console.error("Admin moderate comment error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Helper function to process poll payouts
async function processPollPayouts(poll) {
  try {
    // Get all trades for this poll
    const trades = await Trade.find({ poll: poll._id, status: "completed" });

    for (const trade of trades) {
      const user = await User.findById(trade.user);
      if (!user) continue;

      if (trade.optionIndex === poll.winningOption) {
        // User bet on winning option - they get paid
        const payout = trade.amount; // Full payout for winning
        user.balance += payout;
        user.successfulTrades += 1;
      } else {
        // User bet on losing option - they lose their stake
        // Balance already deducted during trade
      }

      await user.save();
    }
  } catch (error) {
    console.error("Process poll payouts error:", error);
  }
}

// Mark trades on winning option as eligible for claim and compute payouts
async function markWinningTradesEligible(poll) {
  try {
    const trades = await Trade.find({ poll: poll._id, status: "completed" });

    // Simple payout: winners get back their stake (amount). You can adjust multiplier if needed.
    for (const trade of trades) {
      if (trade.optionIndex === poll.winningOption) {
        trade.eligible = true;
        trade.payoutAmount = trade.amount; // simple 1x payout; adjust if needed
      } else {
        trade.eligible = false;
        trade.payoutAmount = 0;
      }
      await trade.save();
    }
  } catch (err) {
    console.error("Mark winning trades eligible error:", err);
  }
}

module.exports = router;

const express = require("express");
const Trade = require("../models/Trade");
const Poll = require("../models/Poll");
const User = require("../models/User");
const { auth } = require("../middleware/auth");

const router = express.Router();

// @route   POST /api/trades
// @desc    Create a new trade (buy/sell)
// @access  Private
router.post("/", auth, async (req, res) => {
  try {
    const {
      pollId,
      type,
      optionIndex,
      amount,
      price,
      orderType = "market",
    } = req.body;

    // Validate required fields
    if (
      !pollId ||
      !type ||
      optionIndex === undefined ||
      !amount ||
      price === undefined
    ) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Validate poll exists and is active
    const poll = await Poll.findById(pollId);
    if (!poll || !poll.isActive) {
      return res.status(404).json({ message: "Poll not found or inactive" });
    }

    // Validate option index
    if (optionIndex < 0 || optionIndex >= poll.options.length) {
      return res.status(400).json({ message: "Invalid option index" });
    }

    // Validate amount and price
    if (amount <= 0 || price < 0 || price > 1) {
      return res.status(400).json({ message: "Invalid amount or price" });
    }

    // Check user balance for buy orders
    if (type === "buy") {
      const totalCost = amount * price;
      if (req.user.balance < totalCost) {
        return res.status(400).json({ message: "Insufficient balance" });
      }
    }

    // Create trade
    const trade = new Trade({
      poll: pollId,
      user: req.user._id,
      type,
      optionIndex,
      amount,
      price,
      totalValue: amount * price,
      orderType,
      remainingAmount: amount,
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    });

    await trade.save();

    // Process the trade
    const result = await processTrade(trade, poll);

    // Update user balance
    await updateUserBalance(req.user._id, trade, result);

    // Update poll statistics
    await updatePollStatistics(pollId);

    // Emit real-time update
    const io = req.app.get("io");
    if (io) {
      io.to(`poll-${pollId}`).emit("trade-updated", {
        pollId,
        trade: result,
        orderBook: await Trade.getOrderBook(pollId, optionIndex),
      });
    }

    res.status(201).json({
      message: "Trade executed successfully",
      trade: result,
    });
  } catch (error) {
    console.error("Create trade error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   GET /api/trades/poll/:pollId
// @desc    Get trades for a specific poll
// @access  Public
router.get("/poll/:pollId", async (req, res) => {
  try {
    const { pollId } = req.params;
    const { page = 1, limit = 50, optionIndex } = req.query;

    const query = { poll: pollId, status: "completed" };
    if (optionIndex !== undefined) {
      query.optionIndex = parseInt(optionIndex);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const trades = await Trade.find(query)
      .populate("user", "username avatar")
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
    console.error("Get trades error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   GET /api/trades/user
// @desc    Get user's trading history
// @access  Private
router.get("/user", auth, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;

    const query = { user: req.user._id };
    if (status) {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    // Populate full poll object so client can access endDate, isResolved, etc.
    const trades = await Trade.find(query)
      .populate("poll")
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

// @route   GET /api/trades/orderbook/:pollId/:optionIndex
// @desc    Get order book for a specific poll and option
// @access  Public
router.get("/orderbook/:pollId/:optionIndex", async (req, res) => {
  try {
    const { pollId, optionIndex } = req.params;
    const orderBook = await Trade.getOrderBook(pollId, parseInt(optionIndex));
    res.json(orderBook);
  } catch (error) {
    console.error("Get order book error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   DELETE /api/trades/:id
// @desc    Cancel a pending trade
// @access  Private
router.delete("/:id", auth, async (req, res) => {
  try {
    const trade = await Trade.findById(req.params.id);

    if (!trade) {
      return res.status(404).json({ message: "Trade not found" });
    }

    // Check if user owns the trade
    if (trade.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // Check if trade can be cancelled
    if (trade.status !== "pending") {
      return res.status(400).json({ message: "Trade cannot be cancelled" });
    }

    // Cancel the trade
    trade.status = "cancelled";
    await trade.save();

    // Refund user if it was a buy order
    if (trade.type === "buy") {
      const refundAmount = trade.remainingAmount * trade.price;
      await User.findByIdAndUpdate(req.user._id, {
        $inc: { balance: refundAmount },
      });
    }

    res.json({ message: "Trade cancelled successfully" });
  } catch (error) {
    console.error("Cancel trade error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Helper function to process trades
async function processTrade(trade, poll) {
  try {
    // For market orders, find matching orders
    if (trade.orderType === "market") {
      const matchingOrders = await findMatchingOrders(trade, poll);

      if (matchingOrders.length > 0) {
        // Execute trades with matching orders
        await executeMatchingTrades(trade, matchingOrders);
      } else {
        // No matching orders, create limit order
        trade.status = "pending";
        await trade.save();
      }
    } else {
      // Limit order - add to order book
      trade.status = "pending";
      await trade.save();
    }

    return trade;
  } catch (error) {
    console.error("Process trade error:", error);
    throw error;
  }
}

// Helper function to find matching orders
async function findMatchingOrders(trade, poll) {
  const oppositeType = trade.type === "buy" ? "sell" : "buy";
  const priceCondition =
    trade.type === "buy" ? { $lte: trade.price } : { $gte: trade.price };

  return await Trade.find({
    poll: trade.poll,
    optionIndex: trade.optionIndex,
    type: oppositeType,
    status: "pending",
    price: priceCondition,
  }).sort({ price: trade.type === "buy" ? 1 : -1, createdAt: 1 });
}

// Helper function to execute matching trades
async function executeMatchingTrades(trade, matchingOrders) {
  let remainingAmount = trade.amount;

  for (const matchingOrder of matchingOrders) {
    if (remainingAmount <= 0) break;

    const tradeAmount = Math.min(
      remainingAmount,
      matchingOrder.remainingAmount
    );
    const tradePrice = matchingOrder.price;

    // Execute the trade
    const executedTrade = new Trade({
      poll: trade.poll,
      user: trade.user,
      type: trade.type,
      optionIndex: trade.optionIndex,
      amount: tradeAmount,
      price: tradePrice,
      totalValue: tradeAmount * tradePrice,
      status: "completed",
      orderType: "market",
    });

    await executedTrade.save();

    // Update matching order
    matchingOrder.filledAmount += tradeAmount;
    matchingOrder.remainingAmount -= tradeAmount;

    if (matchingOrder.remainingAmount <= 0) {
      matchingOrder.status = "completed";
    }

    await matchingOrder.save();

    // Update option volume
    await updateOptionVolume(trade.poll, trade.optionIndex, tradeAmount);

    remainingAmount -= tradeAmount;
  }

  // Update original trade
  trade.filledAmount = trade.amount - remainingAmount;
  trade.remainingAmount = remainingAmount;

  if (remainingAmount <= 0) {
    trade.status = "completed";
  } else {
    trade.status = "pending";
  }

  await trade.save();
}

// Helper function to update option volume
async function updateOptionVolume(pollId, optionIndex, amount) {
  const poll = await Poll.findById(pollId);
  if (poll && poll.options[optionIndex]) {
    poll.options[optionIndex].totalVolume += amount;
    poll.options[optionIndex].totalTrades += 1;
    await poll.updatePercentages();
  }
}

// Helper function to update user balance
async function updateUserBalance(userId, trade, result) {
  const user = await User.findById(userId);

  if (trade.type === "buy") {
    const cost = trade.filledAmount * trade.price;
    user.balance -= cost;
  } else {
    const revenue = trade.filledAmount * trade.price;
    user.balance += revenue;
  }

  user.totalTrades += 1;
  await user.save();
}

// Helper function to update poll statistics
async function updatePollStatistics(pollId) {
  const poll = await Poll.findById(pollId);
  if (poll) {
    // Update total volume and trades
    const trades = await Trade.find({ poll: pollId, status: "completed" });
    poll.totalVolume = trades.reduce((sum, trade) => sum + trade.totalValue, 0);
    poll.totalTrades = trades.length;

    // Update unique traders
    const uniqueTraders = new Set(trades.map((trade) => trade.user.toString()));
    poll.uniqueTraders = uniqueTraders.size;

    await poll.save();
  }
}

module.exports = router;

// POST /api/trades/redeem -> allow user to claim payout for a resolved poll
router.post("/redeem", auth, async (req, res) => {
  try {
    const { pollId } = req.body;
    if (!pollId) return res.status(400).json({ message: "pollId required" });

    // Find user's completed, eligible, unclaimed trades for this poll
    const trades = await Trade.find({
      poll: pollId,
      user: req.user._id,
      status: "completed",
      eligible: true,
      claimed: false,
    });
    if (!trades || trades.length === 0)
      return res.status(400).json({ message: "No eligible rewards" });

    // Sum payout amounts and mark claimed
    let totalPayout = 0;
    for (const t of trades) {
      totalPayout += t.payoutAmount || 0;
      t.claimed = true;
      await t.save();
    }

    // Credit user balance
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { balance: totalPayout, successfulTrades: trades.length },
    });

    res.json({ message: "Reward claimed", amount: totalPayout });
  } catch (err) {
    console.error("Redeem error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/trades/claimed/:pollId -> check if user has claimed rewards for poll
router.get("/claimed/:pollId", auth, async (req, res) => {
  try {
    const { pollId } = req.params;
    const claimed = await Trade.exists({
      poll: pollId,
      user: req.user._id,
      claimed: true,
    });
    res.json({ claimed: !!claimed });
  } catch (err) {
    console.error("Check claimed error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

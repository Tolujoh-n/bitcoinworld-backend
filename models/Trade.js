const mongoose = require('mongoose');

const tradeSchema = new mongoose.Schema({
  poll: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Poll',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['buy', 'sell'],
    required: true
  },
  optionIndex: {
    type: Number,
    required: true,
    min: 0
  },
  amount: {
    type: Number,
    required: true,
    min: 0.01
  },
  price: {
    type: Number,
    required: true,
    min: 0,
    max: 1
  },
  totalValue: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'cancelled', 'failed'],
    default: 'pending'
  },
  transactionHash: {
    type: String,
    default: ''
  },
  fees: {
    type: Number,
    default: 0
  },
  // For order book matching
  orderType: {
    type: String,
    enum: ['market', 'limit'],
    default: 'market'
  },
  limitPrice: {
    type: Number,
    min: 0,
    max: 1
  },
  expiresAt: {
    type: Date
  },
  // For partial fills
  filledAmount: {
    type: Number,
    default: 0
  },
  remainingAmount: {
    type: Number,
    default: 0
  },
  // Metadata
  ipAddress: String,
  userAgent: String,
  notes: String
}, {
  timestamps: true
});

// Indexes for better query performance
tradeSchema.index({ poll: 1, createdAt: -1 });
tradeSchema.index({ user: 1, createdAt: -1 });
tradeSchema.index({ status: 1, createdAt: -1 });
tradeSchema.index({ type: 1, optionIndex: 1, price: 1 });

// Pre-save middleware to calculate totals
tradeSchema.pre('save', function(next) {
  if (this.isModified('amount') || this.isModified('price')) {
    this.totalValue = this.amount * this.price;
    this.remainingAmount = this.amount - this.filledAmount;
  }
  next();
});

// Method to check if trade is valid
tradeSchema.methods.isValid = function() {
  return this.amount > 0 && this.price >= 0 && this.price <= 1;
};

// Method to calculate profit/loss
tradeSchema.methods.calculatePnL = function(currentPrice) {
  if (this.type === 'buy') {
    return (currentPrice - this.price) * this.amount;
  } else {
    return (this.price - currentPrice) * this.amount;
  }
};

// Static method to get order book for a poll
tradeSchema.statics.getOrderBook = async function(pollId, optionIndex) {
  const pendingTrades = await this.find({
    poll: pollId,
    optionIndex: optionIndex,
    status: 'pending',
    orderType: 'limit'
  }).sort({ price: 1, createdAt: 1 });
  
  const buyOrders = pendingTrades.filter(trade => trade.type === 'buy');
  const sellOrders = pendingTrades.filter(trade => trade.type === 'sell');
  
  return {
    buyOrders: buyOrders.slice(0, 10), // Top 10 buy orders
    sellOrders: sellOrders.slice(0, 10) // Top 10 sell orders
  };
};

// Static method to get trade history
tradeSchema.statics.getTradeHistory = async function(pollId, limit = 50) {
  return await this.find({
    poll: pollId,
    status: 'completed'
  })
  .populate('user', 'username avatar')
  .sort({ createdAt: -1 })
  .limit(limit);
};

module.exports = mongoose.model('Trade', tradeSchema);

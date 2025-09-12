const mongoose = require("mongoose");

const optionSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    trim: true,
  },
  percentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  totalVolume: {
    type: Number,
    default: 0,
  },
  totalTrades: {
    type: Number,
    default: 0,
  },
  image: {
    type: String,
    default: "",
  },
});

const pollSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      enum: [
        "Politics",
        "Trending",
        "Middle East",
        "Sports",
        "Crypto",
        "Tech",
        "Culture",
        "World",
        "Economy",
        "Elections",
        "Mentions",
      ],
    },
    subCategory: {
      type: String,
      required: true,
      trim: true,
    },
    image: {
      type: String,
      default: "",
    },
    options: [optionSchema],
    // Blockchain market id for tracking
    marketId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
      default: null,
    },
    endDate: {
      type: Date,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isResolved: {
      type: Boolean,
      default: false,
    },
    winningOption: {
      type: Number,
      default: null,
    },
    totalVolume: {
      type: Number,
      default: 0,
    },
    totalTrades: {
      type: Number,
      default: 0,
    },
    uniqueTraders: {
      type: Number,
      default: 0,
    },
    rules: {
      type: String,
      default: "Standard prediction market rules apply.",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    featured: {
      type: Boolean,
      default: false,
    },
    trending: {
      type: Boolean,
      default: false,
    },
    // For sports polls
    team1: {
      name: String,
      logo: String,
      odds: Number,
    },
    team2: {
      name: String,
      logo: String,
      odds: Number,
    },
    matchTime: Date,
    sportType: String,
    // For crypto polls
    cryptoName: String,
    cryptoLogo: String,
    // For election polls
    country: String,
    countryFlag: String,
    candidates: [
      {
        name: String,
        image: String,
        percentage: Number,
        party: String,
      },
    ],
    // For location-based polls
    location: {
      country: String,
      state: String,
      city: String,
    },
    // Has the market's reward been claimed (server-side flag)
    rewardClaimed: {
      type: Boolean,
      default: false,
    },
    // Last redeem transaction id (optional, for audit)
    lastRedeemTx: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
pollSchema.index({ category: 1, subCategory: 1 });
pollSchema.index({ isActive: 1, endDate: 1 });
pollSchema.index({ trending: 1, totalVolume: -1 });
pollSchema.index({ featured: 1, createdAt: -1 });

// Virtual for time remaining
pollSchema.virtual("timeRemaining").get(function () {
  if (this.isResolved) return 0;
  const now = new Date();
  const remaining = this.endDate - now;
  return remaining > 0 ? remaining : 0;
});

// Method to update option percentages based on volume
pollSchema.methods.updatePercentages = function () {
  const totalVolume = this.options.reduce(
    (sum, option) => sum + option.totalVolume,
    0
  );

  this.options.forEach((option) => {
    if (totalVolume > 0) {
      option.percentage = Math.round((option.totalVolume / totalVolume) * 100);
    } else {
      option.percentage = Math.round(100 / this.options.length);
    }
  });

  this.totalVolume = totalVolume;
  return this.save();
};

// Method to check if poll is trending
pollSchema.methods.checkTrending = function () {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentTrades = this.totalTrades;

  this.trending = recentTrades > 50; // Threshold for trending
  return this.save();
};

module.exports = mongoose.model("Poll", pollSchema);

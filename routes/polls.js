const express = require('express');
const Poll = require('../models/Poll');
const Trade = require('../models/Trade');
const User = require('../models/User');
const { auth, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/polls
// @desc    Get all polls with filtering
// @access  Public
router.get('/', optionalAuth, async (req, res) => {
  try {
    const {
      category,
      subCategory,
      search,
      sort = 'createdAt',
      order = 'desc',
      page = 1,
      limit = 20,
      trending,
      featured,
      timeframe, // 'hour' | 'day' | 'month'
      cryptoName
    } = req.query;

    const query = { isActive: true };
    const sortOptions = {};

    // Category filter
    if (category && category !== 'All') {
      query.category = category;
    }

    // Sub-category filter
    if (subCategory && subCategory !== 'All') {
      query.subCategory = subCategory;
    }

    // Search filter
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    // Trending filter
    if (trending === 'true') {
      query.trending = true;
    }

    // Featured filter
    if (featured === 'true') {
      query.featured = true;
    }

    // Crypto name filter
    if (cryptoName) {
      query.cryptoName = cryptoName;
    }

    // Timeframe filter (by createdAt)
    if (timeframe) {
      const now = new Date();
      let from;
      if (timeframe === 'hour' || timeframe === 'hourly') {
        from = new Date(now.getTime() - 60 * 60 * 1000);
      } else if (timeframe === 'day' || timeframe === 'daily') {
        from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      } else if (timeframe === 'month' || timeframe === 'monthly') {
        from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
      if (from) {
        query.createdAt = { $gte: from };
      }
    }

    // Sort options
    switch (sort) {
      case 'volume':
        sortOptions.totalVolume = order === 'desc' ? -1 : 1;
        break;
      case 'trades':
        sortOptions.totalTrades = order === 'desc' ? -1 : 1;
        break;
      case 'endDate':
        sortOptions.endDate = order === 'desc' ? -1 : 1;
        break;
      default:
        sortOptions.createdAt = order === 'desc' ? -1 : 1;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const polls = await Poll.find(query)
      .populate('createdBy', 'username avatar')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Poll.countDocuments(query);

    // Update percentages for each poll
    for (let poll of polls) {
      await poll.updatePercentages();
    }

    res.json({
      polls,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        total,
        hasNext: skip + polls.length < total,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('Get polls error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/polls/trending
// @desc    Get trending polls
// @access  Public
router.get('/trending', optionalAuth, async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const polls = await Poll.find({
      isActive: true,
      trending: true
    })
    .populate('createdBy', 'username avatar')
    .sort({ totalVolume: -1, totalTrades: -1 })
    .limit(parseInt(limit));

    // Update percentages
    for (let poll of polls) {
      await poll.updatePercentages();
    }

    res.json(polls);
  } catch (error) {
    console.error('Get trending polls error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/polls/categories
// @desc    Get available categories and sub-categories
// @access  Public
router.get('/categories', async (req, res) => {
  try {
    const categories = {
      'Politics': ['All', 'Trump-Putin', 'Trump Presidency', 'Trade War', 'Israel Ukraine', 'Inflation', 'AI Geopolitics GPT-5', 'Texas', 'Redistricting', 'Epstein', 'Jerome Powell', 'Earn 4%', 'Fed Rates'],
      'Middle East': ['All', 'Israel Gaza', 'India-Pakistan', 'Iran Military Actions', 'Khamenei', 'Syria', 'Yemen', 'Lebanon', 'Turkey'],
      'Crypto': ['All', 'Bitcoin', 'Ethereum', 'Binance', 'Cardano', 'Solana', 'Polkadot', 'Chainlink', 'Uniswap', 'DeFi', 'NFTs'],
      'Tech': ['All', 'AI', 'GPT-5', 'Elon Musk', 'Grok', 'Science', 'SpaceX', 'OpenAI', 'MicroStrategy', 'Big Tech', 'TikTok', 'Meta'],
      'Culture': ['All', 'Tweet Markets', 'Astronomer', 'Movies', 'Courts', 'Weather', 'GTA VI', 'Kanye', 'Global Temp', 'Mentions', 'Celebrities', 'New Pope', 'Elon Musk', 'Music', 'Pandemics', 'Awards'],
      'World': ['All', 'Bolivia', 'Ukraine', 'Iran', 'Middle East', 'Global Elections', 'India-Pakistan', 'Gaza', 'Israel', 'China', 'Geopolitics'],
      'Economy': ['All', 'Trade War', 'Fed Rates', 'Inflation', 'Taxes', 'Macro Indicators', 'Treasuries'],
      'Sports': ['All', 'Football', 'Basketball', 'Baseball', 'Soccer', 'Tennis', 'Golf', 'Boxing', 'MMA', 'Olympics'],
      'Elections': ['All', 'US Presidential', 'US Senate', 'US House', 'State Elections', 'International Elections'],
      'Mentions': ['All', 'Twitter', 'Reddit', 'YouTube', 'TikTok', 'Instagram']
    };

    res.json(categories);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/polls/:id
// @desc    Get single poll by ID
// @access  Public
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const poll = await Poll.findById(req.params.id)
      .populate('createdBy', 'username avatar')
      .populate('candidates');

    if (!poll) {
      return res.status(404).json({ message: 'Poll not found' });
    }

    // Update percentages
    await poll.updatePercentages();

    // Get order book if user is authenticated
    let orderBook = null;
    if (req.user) {
      orderBook = await Trade.getOrderBook(poll._id, 0);
    }

    // Get trade history
    const tradeHistory = await Trade.getTradeHistory(poll._id, 50);

    res.json({
      poll,
      orderBook,
      tradeHistory
    });
  } catch (error) {
    console.error('Get poll error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/polls
// @desc    Create a new poll
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      subCategory,
      options,
      endDate,
      rules,
      tags,
      image,
      team1,
      team2,
      matchTime,
      sportType,
      cryptoName,
      cryptoLogo,
      country,
      countryFlag,
      candidates,
      location
    } = req.body;

    // Validate required fields
    if (!title || !description || !category || !subCategory || !options || !endDate) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Validate options
    if (!Array.isArray(options) || options.length < 2) {
      return res.status(400).json({ message: 'At least 2 options are required' });
    }

    // Validate end date
    const endDateObj = new Date(endDate);
    if (endDateObj <= new Date()) {
      return res.status(400).json({ message: 'End date must be in the future' });
    }

    const pollData = {
      title,
      description,
      category,
      subCategory,
      options: options.map(opt => ({
        text: opt.text,
        image: opt.image || '',
        percentage: 100 / options.length
      })),
      endDate: endDateObj,
      rules: rules || 'Standard prediction market rules apply.',
      tags: tags || [],
      image: image || '',
      createdBy: req.user._id
    };

    // Add category-specific data
    if (category === 'Sports' && team1 && team2) {
      pollData.team1 = team1;
      pollData.team2 = team2;
      pollData.matchTime = matchTime;
      pollData.sportType = sportType;
    }

    if (category === 'Crypto' && cryptoName) {
      pollData.cryptoName = cryptoName;
      pollData.cryptoLogo = cryptoLogo;
    }

    if (category === 'Elections' && country) {
      pollData.country = country;
      pollData.countryFlag = countryFlag;
      pollData.candidates = candidates || [];
    }

    if (location) {
      pollData.location = location;
    }

    const poll = new Poll(pollData);
    await poll.save();

    // Populate creator info
    await poll.populate('createdBy', 'username avatar');

    res.status(201).json({
      message: 'Poll created successfully',
      poll
    });
  } catch (error) {
    console.error('Create poll error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/polls/:id
// @desc    Update a poll
// @access  Private (Creator or Admin)
router.put('/:id', auth, async (req, res) => {
  try {
    const poll = await Poll.findById(req.params.id);

    if (!poll) {
      return res.status(404).json({ message: 'Poll not found' });
    }

    // Check if user is creator or admin
    if (poll.createdBy.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Only allow updates if poll is not resolved
    if (poll.isResolved) {
      return res.status(400).json({ message: 'Cannot update resolved poll' });
    }

    const updatedPoll = await Poll.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('createdBy', 'username avatar');

    res.json({
      message: 'Poll updated successfully',
      poll: updatedPoll
    });
  } catch (error) {
    console.error('Update poll error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/polls/:id
// @desc    Delete a poll
// @access  Private (Creator or Admin)
router.delete('/:id', auth, async (req, res) => {
  try {
    const poll = await Poll.findById(req.params.id);

    if (!poll) {
      return res.status(404).json({ message: 'Poll not found' });
    }

    // Check if user is creator or admin
    if (poll.createdBy.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Soft delete by setting isActive to false
    poll.isActive = false;
    await poll.save();

    res.json({ message: 'Poll deleted successfully' });
  } catch (error) {
    console.error('Delete poll error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/polls/:id/save
// @desc    Save/unsave a poll
// @access  Private
router.post('/:id/save', auth, async (req, res) => {
  try {
    const poll = await Poll.findById(req.params.id);
    if (!poll) {
      return res.status(404).json({ message: 'Poll not found' });
    }

    const user = await User.findById(req.user._id);
    const savedIndex = user.savedPolls.indexOf(poll._id);

    if (savedIndex > -1) {
      // Remove from saved
      user.savedPolls.splice(savedIndex, 1);
    } else {
      // Add to saved
      user.savedPolls.push(poll._id);
    }

    await user.save();

    res.json({
      message: savedIndex > -1 ? 'Poll removed from saved' : 'Poll saved successfully',
      saved: savedIndex === -1
    });
  } catch (error) {
    console.error('Save poll error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/polls/saved
// @desc    Get user's saved polls
// @access  Private
router.get('/user/saved', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate({
      path: 'savedPolls',
      match: { isActive: true },
      populate: { path: 'createdBy', select: 'username avatar' }
    });

    res.json(user.savedPolls);
  } catch (error) {
    console.error('Get saved polls error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

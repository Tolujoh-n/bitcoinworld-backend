const mongoose = require("mongoose");
const User = require("../models/User");
const Poll = require("../models/Poll");
const Trade = require("../models/Trade");
require("dotenv").config();

// Connect to MongoDB
mongoose.connect(
  process.env.MONGODB_URI || "mongodb://localhost:27017/bitcoinworld",
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
);

// Sample data for different categories
const sampleData = {
  Politics: [
    {
      title: "Will Trump win the 2024 Presidential Election?",
      description:
        "Will Donald Trump be elected as the 47th President of the United States in the 2024 election?",
      subCategory: "Trump Presidency",
      options: [
        { text: "Yes", percentage: 45 },
        { text: "No", percentage: 55 },
      ],
      image: "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400",
      rules:
        "This market will resolve to YES if Donald Trump wins the 2024 Presidential Election. If any other candidate wins, it resolves to NO.",
    },
    {
      title: "Will Putin remain President of Russia until 2030?",
      description:
        "Will Vladimir Putin continue to serve as President of Russia through 2030?",
      subCategory: "Trump-Putin",
      options: [
        { text: "Yes", percentage: 75 },
        { text: "No", percentage: 25 },
      ],
      image:
        "https://images.unsplash.com/photo-1581833971358-2c8b550f87b3?w=400",
      rules:
        "This market resolves to YES if Putin remains President of Russia on December 31, 2030.",
    },
    {
      title: "Will the US-China trade war escalate in 2024?",
      description:
        "Will there be new tariffs or trade restrictions between the US and China in 2024?",
      subCategory: "Trade War",
      options: [
        { text: "Yes", percentage: 60 },
        { text: "No", percentage: 40 },
      ],
      image: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400",
      rules:
        "This market resolves to YES if new tariffs or significant trade restrictions are implemented between the US and China in 2024.",
    },
    {
      title: "Will the US-China trade war escalate in 2024?",
      description:
        "Will there be new tariffs or trade restrictions between the US and China in 2024?",
      subCategory: "Trade War",
      options: [
        { text: "Yes", percentage: 60 },
        { text: "No", percentage: 40 },
      ],
      image: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400",
      rules:
        "This market resolves to YES if new tariffs or significant trade restrictions are implemented between the US and China in 2024.",
    },
  ],
  "Middle East": [
    {
      title: "Will Israel and Hamas reach a ceasefire agreement in 2024?",
      description:
        "Will Israel and Hamas agree to a ceasefire lasting at least 30 days in 2024?",
      subCategory: "Israel Gaza",
      options: [
        { text: "Yes", percentage: 35 },
        { text: "No", percentage: 65 },
      ],
      image:
        "https://images.unsplash.com/photo-1581833971358-2c8b550f87b3?w=400",
      rules:
        "This market resolves to YES if a formal ceasefire agreement is signed between Israel and Hamas in 2024.",
    },
    {
      title: "Will Iran develop nuclear weapons by 2025?",
      description:
        "Will Iran officially announce or demonstrate nuclear weapons capability by the end of 2025?",
      subCategory: "Iran Military Actions",
      options: [
        { text: "Yes", percentage: 20 },
        { text: "No", percentage: 80 },
      ],
      image:
        "https://images.unsplash.com/photo-1581833971358-2c8b550f87b3?w=400",
      rules:
        "This market resolves to YES if Iran officially announces or demonstrates nuclear weapons capability by December 31, 2025.",
    },
    {
      title: "Will Turkey hold early elections this year?",
      description: "Will early general elections be called in Turkey this year?",
      subCategory: "Turkey",
      options: [{ text: "Yes", percentage: 30 }, { text: "No", percentage: 70 }],
      image: "https://images.unsplash.com/photo-1549888834-3ec93abae044?w=400",
      rules: "Resolves YES if official notice for early elections is issued per law.",
    },
  ],
  Crypto: [
    {
      title: "Will Bitcoin reach $100,000 in 2024?",
      description:
        "Will Bitcoin's price reach or exceed $100,000 USD on any major exchange in 2024?",
      subCategory: "Bitcoin",
      options: [
        { text: "Yes", percentage: 40 },
        { text: "No", percentage: 60 },
      ],
      image:
        "https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=400",
      rules:
        "This market resolves to YES if Bitcoin reaches $100,000 or higher on Coinbase, Binance, or Kraken in 2024.",
    },
    {
      title: "Will Ethereum gas fees average under 20 gwei this year?",
      description:
        "Will the average Ethereum gas fee be under 20 gwei for a full calendar month this year?",
      subCategory: "Ethereum",
      options: [
        { text: "Yes", percentage: 55 },
        { text: "No", percentage: 45 },
      ],
      image:
        "https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=400",
      rules:
        "This market resolves to YES if the monthly average Ethereum gas price is < 20 gwei for any month this year.",
    },
    {
      title: "Will Solana reach a new ATH this year?",
      description: "Will SOL set a new all-time high price this year?",
      subCategory: "Solana",
      options: [{ text: "Yes", percentage: 48 }, { text: "No", percentage: 52 }],
      image: "https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=400",
      rules: "Resolves YES if the daily high on any reputable exchange exceeds prior ATH.",
    },
  ],
  Tech: [
    {
      title: "Will GPT-5 be released in 2024?",
      description:
        "Will OpenAI officially release GPT-5 to the public in 2024?",
      subCategory: "GPT-5",
      options: [
        { text: "Yes", percentage: 30 },
        { text: "No", percentage: 70 },
      ],
      image:
        "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=400",
      rules:
        "This market resolves to YES if OpenAI officially releases GPT-5 for public use in 2024.",
    },
    {
      title: "Will SpaceX successfully land on Mars in 2024?",
      description:
        "Will SpaceX successfully land a spacecraft on Mars in 2024?",
      subCategory: "SpaceX",
      options: [
        { text: "Yes", percentage: 10 },
        { text: "No", percentage: 90 },
      ],
      image:
        "https://images.unsplash.com/photo-1446776877081-d282a0f896e2?w=400",
      rules:
        "This market resolves to YES if SpaceX successfully lands a spacecraft on Mars in 2024.",
    },
    {
      title: "Will Apple release a foldable iPhone this year?",
      description: "Official consumer release of a foldable iPhone in any market this year.",
      subCategory: "Big Tech",
      options: [{ text: "Yes", percentage: 15 }, { text: "No", percentage: 85 }],
      image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400",
      rules: "Resolves YES on official retail availability announced by Apple.",
    },
  ],
  Culture: [
    {
      title: "Will GTA VI be released in 2024?",
      description:
        "Will Grand Theft Auto VI be officially released for sale in 2024?",
      subCategory: "GTA VI",
      options: [
        { text: "Yes", percentage: 25 },
        { text: "No", percentage: 75 },
      ],
      image: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400",
      rules:
        "This market resolves to YES if GTA VI is officially released for sale on any gaming platform in 2024.",
    },
    {
      title: "Will Kanye West release a new album in 2024?",
      description:
        "Will Kanye West officially release a new studio album in 2024?",
      subCategory: "Kanye",
      options: [
        { text: "Yes", percentage: 70 },
        { text: "No", percentage: 30 },
      ],
      image:
        "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400",
      rules:
        "This market resolves to YES if Kanye West releases a new studio album in 2024.",
    },
  ],
  World: [
    {
      title: "Will Ukraine join NATO in 2024?",
      description: "Will Ukraine officially become a member of NATO in 2024?",
      subCategory: "Ukraine",
      options: [
        { text: "Yes", percentage: 15 },
        { text: "No", percentage: 85 },
      ],
      image:
        "https://images.unsplash.com/photo-1581833971358-2c8b550f87b3?w=400",
      rules:
        "This market resolves to YES if Ukraine officially becomes a member of NATO in 2024.",
    },
    {
      title: "Will China invade Taiwan in 2024?",
      description: "Will China launch a military invasion of Taiwan in 2024?",
      subCategory: "China",
      options: [
        { text: "Yes", percentage: 5 },
        { text: "No", percentage: 95 },
      ],
      image:
        "https://images.unsplash.com/photo-1581833971358-2c8b550f87b3?w=400",
      rules:
        "This market resolves to YES if China launches a military invasion of Taiwan in 2024.",
    },
    {
      title: "Will India surpass China in GDP growth this year?",
      description: "Real GDP growth rate of India higher than China for the full year.",
      subCategory: "India",
      options: [{ text: "Yes", percentage: 62 }, { text: "No", percentage: 38 }],
      image: "https://images.unsplash.com/photo-1582571352032-448f7928eca1?w=400",
      rules: "Resolves on official annual data from World Bank/IMF.",
    },
  ],
  Economy: [
    {
      title: "Will the Federal Reserve raise interest rates in 2024?",
      description:
        "Will the Federal Reserve increase the federal funds rate at least once in 2024?",
      subCategory: "Fed Rates",
      options: [
        { text: "Yes", percentage: 45 },
        { text: "No", percentage: 55 },
      ],
      image: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400",
      rules:
        "This market resolves to YES if the Federal Reserve increases the federal funds rate at least once in 2024.",
    },
    {
      title: "Will inflation exceed 3% in 2024?",
      description: "Will the annual inflation rate exceed 3% in 2024?",
      subCategory: "Inflation",
      options: [
        { text: "Yes", percentage: 65 },
        { text: "No", percentage: 35 },
      ],
      image: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400",
      rules:
        "This market resolves to YES if the annual inflation rate exceeds 3% in 2024.",
    },
    {
      title: "Will US unemployment fall below 3% this year?",
      description: "Any monthly BLS unemployment reading below 3.0% this year.",
      subCategory: "Macro Indicators",
      options: [{ text: "Yes", percentage: 10 }, { text: "No", percentage: 90 }],
      image: "https://images.unsplash.com/photo-1521540216272-a50305cd4421?w=400",
      rules: "Resolves YES if any BLS monthly unemployment rate < 3.0%.",
    },
  ],
  Sports: [
    {
      title: "Who will win the 2024 Super Bowl?",
      description: "Which team will win Super Bowl LVIII in 2024?",
      subCategory: "Football",
      options: [
        { text: "Kansas City Chiefs", percentage: 30 },
        { text: "San Francisco 49ers", percentage: 25 },
        { text: "Baltimore Ravens", percentage: 20 },
        { text: "Other", percentage: 25 },
      ],
      image:
        "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400",
      rules:
        "This market resolves to the team that wins Super Bowl LVIII in 2024.",
    },
    {
      title: "Will Real Madrid win El Clásico next match?",
      description: "Outcome of next El Clásico between Real Madrid and Barcelona.",
      subCategory: "Basketball",
      options: [
        { text: "Real Madrid", percentage: 45 },
        { text: "Barcelona", percentage: 40 },
        { text: "Draw", percentage: 15 },
      ],
      image:
        "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400",
      rules: "Resolves to the team that wins after regulation; Draw if official draw result.",
    },
  ],
  Elections: [
    {
      title: "Who will win the 2024 US Presidential Election?",
      description:
        "Which candidate will win the 2024 US Presidential Election?",
      subCategory: "US Presidential",
      options: [
        { text: "Donald Trump", percentage: 45 },
        { text: "Joe Biden", percentage: 40 },
        { text: "Other", percentage: 15 },
      ],
      image: "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400",
      rules:
        "This market resolves to the candidate who wins the 2024 US Presidential Election.",
    },
  ],
};

// Create admin user
async function createAdminUser() {
  try {
    const adminExists = await User.findOne({ isAdmin: true });
    if (!adminExists) {
      const admin = new User({
        username: "admin",
        email: "admin@bitcoinworld.com",
        password: "admin123",
        isAdmin: true,
        balance: 10000,
      });
      await admin.save();
      console.log("Admin user created");
      return admin;
    }
    return adminExists;
  } catch (error) {
    console.error("Error creating admin user:", error);
  }
}

// Create regular users
async function createUsers() {
  const users = [];
  const userData = [
    { username: "trader1", email: "trader1@example.com", balance: 5000 },
    { username: "trader2", email: "trader2@example.com", balance: 3000 },
    { username: "trader3", email: "trader3@example.com", balance: 7500 },
    { username: "crypto_whale", email: "whale@example.com", balance: 25000 },
    {
      username: "political_expert",
      email: "politics@example.com",
      balance: 4000,
    },
  ];

  for (const data of userData) {
    try {
      let user = await User.findOne({ email: data.email });
      if (!user) {
        user = new User({
          ...data,
          password: "password123",
        });
        await user.save();
        console.log(`User ${data.username} created`);
      }
      users.push(user);
    } catch (error) {
      console.error(`Error creating user ${data.username}:`, error);
    }
  }
  return users;
}

// Create polls
async function createPolls(users) {
  const polls = [];
  const admin = await User.findOne({ isAdmin: true });
  const creators = [admin, ...users];

  for (const [category, categoryPolls] of Object.entries(sampleData)) {
    for (const pollData of categoryPolls) {
      try {
        const creator = creators[Math.floor(Math.random() * creators.length)];
        const endDate = new Date();
        endDate.setFullYear(endDate.getFullYear() + 1);

        const poll = new Poll({
          ...pollData,
          category,
          createdBy: creator._id,
          endDate,
          totalVolume: Math.floor(Math.random() * 10000) + 1000,
          totalTrades: Math.floor(Math.random() * 500) + 50,
          uniqueTraders: Math.floor(Math.random() * 100) + 10,
          trending: Math.random() > 0.7,
          featured: Math.random() > 0.8,
          tags: [category, pollData.subCategory, "prediction", "market"],
        });

        await poll.save();
        polls.push(poll);
        console.log(`Poll "${pollData.title}" created`);

        // Update option percentages based on volume
        await poll.updatePercentages();
      } catch (error) {
        console.error(`Error creating poll "${pollData.title}":`, error);
      }
    }
  }
  return polls;
}

// Create trades
async function createTrades(polls, users) {
  const tradeTypes = ["buy", "sell"];
  const allUsers = [await User.findOne({ isAdmin: true }), ...users];

  for (const poll of polls) {
    const numTrades = Math.floor(Math.random() * 50) + 10;

    for (let i = 0; i < numTrades; i++) {
      try {
        const user = allUsers[Math.floor(Math.random() * allUsers.length)];
        const optionIndex = Math.floor(Math.random() * poll.options.length);
        const type = tradeTypes[Math.floor(Math.random() * tradeTypes.length)];
        const amount = Math.floor(Math.random() * 100) + 10;
        const price = Math.random() * 0.8 + 0.1; // Price between 0.1 and 0.9

        const trade = new Trade({
          poll: poll._id,
          user: user._id,
          type,
          optionIndex,
          amount,
          price,
          totalValue: amount * price,
          status: "completed",
          orderType: "market",
        });

        await trade.save();

        // Update poll statistics
        poll.options[optionIndex].totalVolume += amount;
        poll.options[optionIndex].totalTrades += 1;
      } catch (error) {
        console.error("Error creating trade:", error);
      }
    }

    // Update poll percentages after all trades
    await poll.updatePercentages();
    console.log(`Trades created for poll "${poll.title}"`);
  }
}

// Main population function
async function populateData() {
  try {
    console.log("Starting data population...");

    // Clear existing data
    await Trade.deleteMany({});
    await Poll.deleteMany({});
    await User.deleteMany({ isAdmin: false });

    console.log("Cleared existing data");

    // Create users
    const users = await createUsers();
    console.log(`Created ${users.length} users`);

    // Create polls
    const polls = await createPolls(users);
    console.log(`Created ${polls.length} polls`);

    // Create trades
    await createTrades(polls, users);
    console.log("Created trades");

    console.log("Data population completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Error populating data:", error);
    process.exit(1);
  }
}

// Run the population script
populateData();

const fs = require("fs");
const express = require("express");
const bodyParser = require("body-parser");
const multer = require("multer");
const path = require("path");
const cookieParser = require('cookie-parser');
const session = require('express-session');
const { spawnSync } = require("child_process");

const admin = require("firebase-admin");
const serviceAccount = require("./firebase_cred.json");


// Initialize Firebase Admin
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://detoxdroid-95fbb-default-rtdb.firebaseio.com/"
});

const db = admin.database();
const screenTimeFilePath = path.join(__dirname, "data", "screenTime.json");
let screenTime = {};

// Load screen time data
function loadScreenTime() {
    try {
        const data = fs.readFileSync(screenTimeFilePath);
        screenTime = JSON.parse(data);
    } catch (err) {
        console.error("Error loading screen time:", err);
        screenTime = {};
    }
}

// Save screen time data
function saveScreenTime() {
    fs.writeFileSync(screenTimeFilePath, JSON.stringify(screenTime, null, 2));
}

// Update screen time
function updateScreenTime(userId) {
    if (!screenTime[userId]) {
        screenTime[userId] = { totalSeconds: 0 };
    }
    screenTime[userId].totalSeconds += 1; // Increment by 1 minute
    saveScreenTime();
}
const checkAuth = async (req, res, next) => {
    if (!req.session || !req.session.uid) {
        return res.redirect('/login');
    }
    next();
};

// Load initial data
loadScreenTime();

// File paths
const postsFilePath = path.join(__dirname, "data", "posts.json");
const profilesFilePath = path.join(__dirname, "data", "profiles.json");

// Initialize Express app
const app = express();

// Middleware setup
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(session({
    secret: 'your-secret-key', // Change this to a secure secret
    resave: false,
    saveUninitialized: true,
    cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// Multer storage configuration
const postStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "public/uploads");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    },
});

const profilePicStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "public/profilePics");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    },
});

const uploadPostImage = multer({ storage: postStorage });
const uploadProfilePic = multer({ storage: profilePicStorage });

// Data storage
let posts = [];
let profiles = [];
let postIdCounter = 1;

// Firebase functions
function pushToFirebase() {
    db.ref('posts').set(posts);
    db.ref('profiles').set(profiles);
}

// Data loading functions
function loadPosts() {
    try {
        const data = fs.readFileSync(postsFilePath);
        posts = JSON.parse(data);
        postIdCounter = posts.length ? posts[posts.length - 1].id + 1 : 1;
    } catch (err) {
        console.error("Error loading posts:", err);
        posts = [];
    }
}

function loadProfiles() {
    try {
        const data = fs.readFileSync(profilesFilePath);
        profiles = JSON.parse(data);
    } catch (err) {
        console.error("Error loading profiles:", err);
        profiles = [];
    }
}

// Save functions
function savePosts() {
    fs.writeFileSync(postsFilePath, JSON.stringify(posts, null, 2));
}

function saveProfiles() {
    fs.writeFileSync(profilesFilePath, JSON.stringify(profiles, null, 2));
}



// Load initial data
loadPosts();
loadProfiles();

// Routes

// Auth routes
app.get('/', (req, res) => {
    if (req.session && req.session.uid) {
        const userId = req.session.uid;
        const totalSeconds = screenTime[userId]?.totalSeconds || 0; // Get total minutes for logged-in user
        res.render('main', {
            user: req.session,
            totalSeconds,
            pages: [
                { name: 'Dashboard', url: '/dashboard' },
                { name: 'Focus Mode', url: '/focusMode' },
                { name: 'Mood Board', url: '/mood-board' },
                { name: 'Profiles', url: '/profiles' },
                { name: 'Explore', url: '/explore' }, // Add Explore page link
                { name: 'Users of App', url: '/users-of-app' } // Add Users of App link
            ]
        });
    } else {
        res.render('index', { error: null });
    }
});

// Update Screen Time Endpoint
app.post('/update-screen-time', checkAuth, (req, res) => {
    const userId = req.session.uid;
    updateScreenTime(userId);
    res.sendStatus(200);
});
// Reset Screen Time Endpoint
app.post('/reset-screen-time', checkAuth, (req, res) => {
    const userId = req.session.uid;
    if (screenTime[userId]) {
        screenTime[userId].totalSeconds = 0; // Reset total minutes
        saveScreenTime(); // Save updated screen time
    }
    res.sendStatus(200);
});

app.post("/delete-post", checkAuth, (req, res) => {
    const { postId } = req.body;
    const userId = req.session.uid;
    
    // Find post index
    const postIndex = posts.findIndex(post => 
        post.id === parseInt(postId) && post.userId === userId
    );
    
    if (postIndex !== -1) {
        // Remove from local array
        const deletedPost = posts.splice(postIndex, 1)[0];
        
        // Remove from Firebase
        db.ref(`users/${userId}/posts`)
            .orderByChild('id')
            .equalTo(parseInt(postId))
            .once('value')
            .then((snapshot) => {
                snapshot.forEach((child) => {
                    child.ref.remove();
                });
            });
        
        // Delete associated image if exists
        if (deletedPost.image) {
            const imagePath = path.join(__dirname, 'public', deletedPost.image);
            fs.unlink(imagePath, (err) => {
                if (err) console.error("Error deleting image:", err);
            });
        }
        
        savePosts();
    }
    
    res.redirect("/dashboard");
});


app.get('/login', (req, res) => {
    res.render('index', { error: null });
});

app.post('/login', async (req, res) => {
    const { email } = req.body;
    
    try {
        const userRecord = await admin.auth().getUserByEmail(email);
        req.session.uid = userRecord.uid;
        req.session.email = userRecord.email;
        await loadUserData(req.session.uid);
        res.redirect('/');
    } catch (error) {
        console.error('Error logging in:', error);
        if (error.code === 'auth/user-not-found') {
            res.render('index', { error: 'No user found with this email.' });
        } else {
            res.render('index', { error: 'Invalid credentials!' });
        }
    }
});
async function loadUserData(userId) {
    const userPostsRef = db.ref(`users/${userId}/posts`);
    const userProfilesRef = db.ref(`users/${userId}/profiles`);

    const postsSnapshot = await userPostsRef.once('value');
    const profilesSnapshot = await userProfilesRef.once('value');

    postsSnapshot.forEach(post => {
        posts.push(post.val());
    });

    profilesSnapshot.forEach(profile => {
        profiles.push(profile.val());
    });
}
function pushToFirebase() {
    const userId = req.session.uid; // Get the current user's ID

    // Push posts and profiles to Firebase under the user's node
    db.ref(`users/${userId}/posts`).set(posts);
    db.ref(`users/${userId}/profiles`).set(profiles);
}


app.post("/signup", async (req, res) => {
    const { email, password } = req.body;

    try {
        const userRecord = await admin.auth().createUser({
            email,
            password,
            emailVerified: false
        });
        console.log(`User created successfully: ${userRecord.uid}`);
        res.redirect("/login");
    } catch (error) {
        console.error("Error creating new user:", error);
        res.render('index', { 
            error: error.code === 'auth/email-already-exists' 
                ? 'Email already exists' 
                : 'Error creating user'
        });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// Protected routes
app.get("/dashboard", checkAuth, (req, res) => {
    res.render("dashboard", { posts, user: req.session });
});

app.get("/focusMode", checkAuth, (req, res) => {
    res.render("focusMode", { focusTime: 1, user: req.session });
});
const pythonProcess = spawnSync('python', ['analyze_sentiment.py', posts.content]);
console.log("Python output:", pythonProcess.stdout.toString()); // Log output
const output = pythonProcess.stdout.toString();
if (!output) {
    console.error("Empty output from Python script");
    return res.status(500).json({ error: "No data returned from sentiment analysis" });
}

try {
    const sentiment = JSON.parse(output);
    // Process sentiment data...
} catch (error) {
    console.error("Error parsing JSON:", error);
    return res.status(500).json({ error: "Error parsing sentiment data" });
}


app.get("/mood-board", checkAuth, async (req, res) => {
    const moodData = [];
    let negativeCount = 0;

    for (const post of posts) {
        const pythonProcess = spawnSync('python', ['analyze_sentiment.py', post.content]);
        const output = pythonProcess.stdout.toString();

        if (!output) {
            console.error("Empty output from Python script");
            return res.status(500).json({ error: "No data returned from sentiment analysis" });
        }

        try {
            const sentiment = JSON.parse(output);
            moodData.push({
                title: post.title,
                mood: sentiment.polarity > 0 ? "Positive" : sentiment.polarity < 0 ? "Negative" : "Neutral",
                polarity: sentiment.polarity,
                subjectivity: sentiment.subjectivity,
            });

            if (sentiment.polarity < 0) {
                negativeCount++;
            }
        } catch (error) {
            console.error("Error parsing JSON:", error);
            return res.status(500).json({ error: "Error parsing sentiment data" });
        }
    }

    // Check user screen time
    const userId = req.session.uid;
    const totalMinutes = screenTime[userId]?.totalMinutes || 0;

    // Prompt logic
    const promptBreak = totalMinutes > 60 || negativeCount > 0; // Example thresholds
    res.render('mood-board', { moodData, user: req.session, promptBreak });

    // Push mood board data to Firebase
    pushMoodBoardToFirebase(moodData);
});

// Function to push mood board data to Firebase
function pushMoodBoardToFirebase(moodData) {
    db.ref('moodBoard').set(moodData);
}


// Post routes
app.post("/add-post", checkAuth, uploadPostImage.single("image"), (req, res) => {
    const { title, content, category } = req.body; // Include category in the request
    const image = req.file ? `/uploads/${req.file.filename}` : null;
    const newPost = {
        id: postIdCounter++,
        title,
        content,
        image,
        comments: [],
        likes: 0,
        dislikes: 0,
        dislikeReasons: [],
        userId: req.session.uid,
        category // Add category to the post
    };
    posts.push(newPost);
    savePosts(); // Ensure to save the posts after adding
    res.redirect("/dashboard");
});
app.get('/posts/:category', (req, res) => {
    const { category } = req.params;
    const filteredPosts = posts.filter(post => post.category === category);
    
    res.render('postsByCategory', { 
        posts: filteredPosts, 
        user: req.session 
    });
});
app.get('/posts/:category', (req, res) => {
    const { category } = req.params;
    const filteredPosts = posts.filter(post => post.category === category);
    
    res.render('postsByCategory', { 
        posts: filteredPosts, 
        user: req.session 
    });
});


app.post("/add-comment", checkAuth, (req, res) => {
    const { postId, comment } = req.body;
    const userId = req.session.uid;
    
    const post = posts.find(post => post.id === parseInt(postId));
    if (post) {
        const newComment = {
            text: comment,
            userId: userId,
            timestamp: Date.now()
        };
        
        // Add to local array
        if (!post.comments) {
            post.comments = [];
        }
        post.comments.push(newComment);
        
        // Add to Firebase
        db.ref(`users/${post.userId}/posts`)
            .orderByChild('id')
            .equalTo(parseInt(postId))
            .once('value')
            .then((snapshot) => {
                snapshot.forEach((child) => {
                    child.ref.child('comments').push(newComment);
                });
            });
        
        savePosts();
    }
    res.redirect("/dashboard");
});


app.post("/like-post", checkAuth, (req, res) => {
    const { postId } = req.body;
    const userId = req.session.uid;
    
    const post = posts.find(post => post.id === parseInt(postId));
    if (post) {
        // Update local array
        if (!post.likes) post.likes = 0;
        post.likes++;
        
        // Update in Firebase
        db.ref(`users/${post.userId}/posts`)
            .orderByChild('id')
            .equalTo(parseInt(postId))
            .once('value')
            .then((snapshot) => {
                snapshot.forEach((child) => {
                    child.ref.update({
                        likes: post.likes
                    });
                });
            });
        
        savePosts();
    }
    res.redirect("/dashboard");
});

app.post("/dislike-post", checkAuth, (req, res) => {
    const { postId, reasons } = req.body;
    const userId = req.session.uid;
    
    const post = posts.find(post => post.id === parseInt(postId));
    if (post) {
        // Update local array
        if (!post.dislikes) post.dislikes = 0;
        if (!post.dislikeReasons) post.dislikeReasons = [];
        
        post.dislikes++;
        const reasonsArray = Array.isArray(reasons) ? reasons : [reasons];
        post.dislikeReasons.push(...reasonsArray);
        
        // Update in Firebase
        db.ref(`users/${post.userId}/posts`)
            .orderByChild('id')
            .equalTo(parseInt(postId))
            .once('value')
            .then((snapshot) => {
                snapshot.forEach((child) => {
                    child.ref.update({
                        dislikes: post.dislikes,
                        dislikeReasons: post.dislikeReasons
                    });
                });
            });
        
        savePosts();
    }
    res.redirect("/dashboard");
});
// Profile routes
app.get("/profiles", checkAuth, (req, res) => {
    res.render("profiles", { profiles, user: req.session });
});

app.post("/search", checkAuth, (req, res) => {
    const searchTerm = req.body.searchTerm.toLowerCase();
    const results = profiles.filter(profile => 
        profile.name.toLowerCase().includes(searchTerm)
    );
    res.render("searchResults", { 
        profiles: results, 
        searchTerm, 
        user: req.session 
    });
});

app.get("/create-profile", checkAuth, (req, res) => {
    res.render("createProfile", { user: req.session });
});

app.post("/create-profile", checkAuth, uploadProfilePic.single("profilePic"), (req, res) => {
    const { name, email, bio } = req.body;
    const profilePic = req.file ? `/profilePics/${req.file.filename}` : null;
    const newProfile = {
        id: profiles.length + 1,
        name,
        email,
        bio: bio || "",
        profilePic,
        userId: req.session.uid,
        followers: [] // Initialize followers array
    };
    profiles.push(newProfile);
    saveProfiles();
    pushToFirebase();
    res.redirect("/profiles");
});


app.post("/follow/:id", checkAuth, (req, res) => {
    const profile = profiles.find(p => p.id === parseInt(req.params.id));
    if (profile && !profile.followers.includes(req.session.uid)) {
        profile.followers.push(req.session.uid); // Add user ID to followers
        saveProfiles(); // Save updated profiles
    }
    res.redirect("/profiles");
});

app.post("/unfollow/:id", checkAuth, (req, res) => {
    const profile = profiles.find(p => p.id === parseInt(req.params.id));
    if (profile) {
        const index = profile.followers.indexOf(req.session.uid);
        if (index !== -1) {
            profile.followers.splice(index, 1); // Remove user ID from followers
            saveProfiles(); // Save updated profiles
        }
    }
    res.redirect("/profiles");
});

//const path = require('path');

// Load local posts from JSON file
const axios = require('axios');

// Function to fetch external posts
const SUBREDDIT_MAPPING = {
    technology: 'technology',
    education: 'education',
    sports: 'sports'
};

// Function to fetch posts from Reddit
async function getRedditPosts(category) {
    const subreddit = SUBREDDIT_MAPPING[category];
    try {
        const response = await axios.get(
            `https://www.reddit.com/r/${subreddit}/top.json?limit=10&t=day`,
            {
                headers: {
                    'User-Agent': 'DetoxDroid/1.0.0'
                }
            }
        );

        // Transform Reddit posts to match your post structure
        return response.data.data.children.map(child => ({
            id: `reddit-${category}-${child.data.id}`,
            title: child.data.title,
            content: child.data.selftext || child.data.url,
            category: category,
            source: `r/${subreddit}`,
            url: `https://reddit.com${child.data.permalink}`,
            image: child.data.thumbnail !== 'self' && child.data.thumbnail !== '' ? 
                   child.data.thumbnail : null,
            score: child.data.score,
            author: child.data.author,
            created: new Date(child.data.created_utc * 1000)
        }));
    } catch (error) {
        console.error(`Error fetching ${category} posts from Reddit:`, error.message);
        return [];
    }
}

// Function to get local posts
function getLocalPosts() {
    const filePath = path.join(__dirname, './data/posts.json');
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading local posts:', error);
        return [];
    }
}

// Function to combine local posts with Reddit posts
async function getCombinedPosts() {
    try {
        const localPosts = getLocalPosts();
        
        // Fetch posts from Reddit for each category
        const redditPromises = Object.keys(SUBREDDIT_MAPPING).map(category => 
            getRedditPosts(category)
        );
        
        const redditResults = await Promise.all(redditPromises);
        const allRedditPosts = redditResults.flat();
        
        // Combine and cache the posts
        const combinedPosts = [...localPosts, ...allRedditPosts];
        const outputFilePath = path.join(__dirname, 'data', 'combinedPosts.json');
        fs.writeFileSync(outputFilePath, JSON.stringify(combinedPosts, null, 2));
        
        // Cache timestamp
        const cacheTimestamp = new Date().toISOString();
        fs.writeFileSync(
            path.join(__dirname, 'data', 'lastUpdate.json'),
            JSON.stringify({ lastUpdate: cacheTimestamp })
        );
        
        return combinedPosts;
    } catch (error) {
        console.error('Error combining posts:', error);
        return [];
    }
}

// Cache duration in milliseconds (1 hour)
const CACHE_DURATION = 60 * 60 * 1000;

// Function to check if cache is valid
function isCacheValid() {
    try {
        const timestampPath = path.join(__dirname, 'data', 'lastUpdate.json');
        const { lastUpdate } = JSON.parse(fs.readFileSync(timestampPath));
        const timeDiff = new Date() - new Date(lastUpdate);
        return timeDiff < CACHE_DURATION;
    } catch {
        return false;
    }
}
app.get('/explore', checkAuth, async (req, res) => {
    try {
        let posts;
        const combinedPostsPath = path.join(__dirname, 'data', 'combinedPosts.json');

        // Check cache validity
        if (isCacheValid() && fs.existsSync(combinedPostsPath)) {
            posts = JSON.parse(fs.readFileSync(combinedPostsPath));
        } else {
            posts = await getCombinedPosts();
        }
        
        // Group posts by category
        const categorizedPosts = {
            sports: posts.filter(post => post.category === 'sports'),
            education: posts.filter(post => post.category === 'education'),
            technology: posts.filter(post => post.category === 'technology')
        };
        
        res.render('explore', { 
            categorizedPosts, 
            user: req.session,
            moment: require('moment') // For time formatting
        });
    } catch (error) {
        console.error('Error in explore route:', error);
        res.status(500).send('Error loading content');
    }
});


app.get('/users-of-app', checkAuth, (req, res) => {
    const usersRef = db.ref('users'); // Reference to users in Firebase
    usersRef.once('value').then(snapshot => {
        const users = [];
        snapshot.forEach(childSnapshot => {
            const userData = childSnapshot.val();
            users.push(userData);
        });
        res.render('usersOfApp', { 
            users, 
            user: req.session,
            pages: [
                { name: 'Dashboard', url: '/dashboard' },
                { name: 'Focus Mode', url: '/focusMode' },
                { name: 'Mood Board', url: '/mood-board' },
                { name: 'Profiles', url: '/profiles' },
                { name: 'Explore', url: '/explore' },
                { name: 'Users of App', url: '/users-of-app' }
            ]
        });
    }).catch(err => {
        console.error("Error fetching users:", err);
        res.status(500).send("Error loading users.");
    });
});


// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
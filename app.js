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
function pushToFirebase(req) {
    const userId = req.session.uid; // Get the current user's ID
    // Push posts and profiles to Firebase under the user's node
    db.ref(`users/${userId}/posts`).set(posts);
    db.ref(`users/${userId}/profiles`).set(profiles);
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
                { name: 'Explore', url: '/explore' },
                { name: 'Users of App', url: '/users-of-app' }
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

app.post("/delete-post", checkAuth, async (req, res) => {
    const { postId } = req.body;
    const userId = req.session.uid;

    try {
        const postRef = db.ref(`users/${userId}/posts/${postId}`);
        const snapshot = await postRef.once('value');
        const post = snapshot.val();

        if (!post) {
            return res.status(404).send("Post not found");
        }

        // Delete the image if it exists
        if (post.image) {
            const imagePath = path.join(__dirname, 'public', post.image);
            try {
                fs.unlinkSync(imagePath);
            } catch (err) {
                console.error("Error deleting image:", err);
            }
        }

        // Delete the post
        await postRef.remove();
        res.redirect("/dashboard");
    } catch (error) {
        console.error("Error deleting post:", error);
        res.status(500).send("Error deleting post");
    }
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

        // Verify user profile exists
        const hasProfile = await verifyUserData(userRecord.uid);
        if (!hasProfile) {
            // Create profile if it doesn't exist
            const initialProfile = {
                name: email.split('@')[0],
                email: email,
                bio: '',
                profilePic: null,
                followers: [],
                following: [],
                createdAt: admin.database.ServerValue.TIMESTAMP
            };
            await db.ref(`users/${userRecord.uid}/profile`).set(initialProfile);
            console.log(`Created missing profile for user: ${userRecord.uid}`);
        }

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
    const userProfileRef = db.ref(`users/${userId}/profile`); // Fetch profile instead of profiles

    const postsSnapshot = await userPostsRef.once('value');
    const profileSnapshot = await userProfileRef.once('value');

    postsSnapshot.forEach(post => {
        posts.push(post.val());
    });

    // Load profile
    const profileData = profileSnapshot.val();
    if (profileData) {
        profiles.push(profileData); // Add to profiles array if needed
    }
}

function pushToFirebase(req) {
    const userId = req.session.uid; // Get the current user's ID

    // Push posts and profiles to Firebase under the user's node
    db.ref(`users/${userId}/posts`).set(posts);
    db.ref(`users/${userId}/profiles`).set(profiles);
}


app.post("/signup", async (req, res) => {
    const { email, password } = req.body;
    try {
        const userRecord = await admin.auth().createUser({ email, password });
        const initialProfile = {
            name: email.split('@')[0],
            email: email,
            bio: '',
            profilePic: null,
            followers: [],
            following: [],
            createdAt: admin.database.ServerValue.TIMESTAMP
        };
        await db.ref(`users/${userRecord.uid}/profile`).set(initialProfile);
        console.log(`Profile created for user: ${userRecord.uid}`);
        res.redirect("/login");
    } catch (error) {
        console.error("Error in signup process:", error);
        res.render('index', { error: 'Error creating user' });
    }
});

async function verifyUserData(userId) {
    try {
        const userRef = db.ref(`users/${userId}`);
        const snapshot = await userRef.once('value');
        console.log(`Verifying data for user ${userId}:`, snapshot.val());
        return snapshot.exists();
    } catch (error) {
        console.error(`Error verifying user data for ${userId}:`, error);
        return false;
    }
}
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.get("/dashboard", checkAuth, async (req, res) => {
    try {
        const userId = req.session.uid;
        const userPostsRef = db.ref(`users/${userId}/posts`);
        const snapshot = await userPostsRef.once('value');
        
        const posts = [];
        snapshot.forEach(childSnapshot => {
            const post = childSnapshot.val();
            if (post && post.title) { // Basic validation
                posts.push({
                    id: childSnapshot.key,
                    ...post,
                    likes: post.likes || 0,
                    dislikes: post.dislikes || 0,
                    comments: post.comments || [],
                    dislikeReasons: post.dislikeReasons || []
                });
            }
        });
        
        // Sort posts by creation date (newest first)
        const sortedPosts = posts.sort((a, b) => {
            return (b.createdAt || 0) - (a.createdAt || 0);
        });

        res.render("dashboard", { 
            posts: sortedPosts,
            user: req.session 
        });
    } catch (error) {
        console.error("Error fetching posts:", error);
        res.status(500).send("Error loading dashboard");
    }
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
    const userId = req.session.uid;
    const moodData = [];
    
    // Fetch user's posts
    const userPostsRef = db.ref(`users/${userId}/posts`);
    const postsSnapshot = await userPostsRef.once('value');

    let negativeCount = 0;

    postsSnapshot.forEach(post => {
        const postData = post.val();
        const pythonProcess = spawnSync('python', ['analyze_sentiment.py', postData.content]);
        const output = pythonProcess.stdout.toString();

        if (!output) {
            console.error("Empty output from Python script");
            return res.status(500).json({ error: "No data returned from sentiment analysis" });
        }

        try {
            const sentiment = JSON.parse(output);
            moodData.push({
                title: postData.title,
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
    });

    // Check user screen time
    const totalMinutes = screenTime[userId]?.totalMinutes || 0;

    // Determine if a prompt should be shown
    const promptBreak = totalMinutes > 60 || negativeCount > 0; // Example thresholds

    res.render("mood-board", { moodData, negativeCount, promptBreak });
});



    // Check user screen time
    //const userId = req.session.uid;
    //const totalMinutes = screenTime[userId]?.totalMinutes || 0;

    // Prompt logic
    //const promptBreak = totalMinutes > 60 || negativeCount > 0; // Example thresholds
    


// Function to push mood board data to Firebase
function pushMoodBoardToFirebase(moodData) {
    db.ref('moodBoard').set(moodData);
}


// Post routes
app.post("/add-post", uploadPostImage.single("image"), checkAuth, async (req, res) => {
    const { title, content, category } = req.body;
    const userId = req.session.uid;
    const image = req.file ? `/uploads/${req.file.filename}` : null;

    const newPost = {
        //id: generateUniqueId(),
        title,
        content,
        image,
        category,
        createdAt: Date.now(),
        userId,
        dislikeReasons: [],
        likes: 0,
        dislikes: 0,
        comments: []
    };

    // Add to Firebase directly
    await db.ref(`users/${userId}/posts/${newPost.id}`).set(newPost);
    res.redirect("/dashboard");
});;


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

app.post("/add-comment", checkAuth, async (req, res) => {
    const { postId, comment } = req.body;
    const userId = req.session.uid;

    if (!comment || !comment.trim()) {
        return res.status(400).send("Comment cannot be empty");
    }

    try {
        const postRef = db.ref(`users/${userId}/posts/${postId}`);
        const snapshot = await postRef.once('value');
        const post = snapshot.val();

        if (!post) {
            return res.status(404).send("Post not found");
        }

        const newComment = {
            id: Date.now().toString(),
            text: comment.trim(),
            userId,
            createdAt: Date.now()
        };

        const updatedPost = {
            ...post,
            comments: [...(post.comments || []), newComment]
        };

        await postRef.set(updatedPost);
        res.redirect("/dashboard");
    } catch (error) {
        console.error("Error adding comment:", error);
        res.status(500).send("Error adding comment");
    }
});



app.post("/like-post", checkAuth, async (req, res) => {
    const { postId, postAuthorId } = req.body;
    const userId = req.session.uid;

    try {
        const postRef = db.ref(`users/${postAuthorId}/posts/${postId}`);
        const snapshot = await postRef.once('value');
        const post = snapshot.val();

        if (!post) {
            return res.status(404).send("Post not found");
        }

        // Update the post data
        const updatedPost = {
            ...post,
            likes: (post.likes || 0) + 1,
            likedBy: post.likedBy || []
        };

        if (!updatedPost.likedBy.includes(userId)) {
            updatedPost.likedBy.push(userId);
        }

        await postRef.set(updatedPost);
        res.redirect("/dashboard");
    } catch (error) {
        console.error("Error liking post:", error);
        res.status(500).send("Error liking post");
    }
});

app.post("/dislike-post", checkAuth, async (req, res) => {
    const { postId, postAuthorId, reasons } = req.body;
    const userId = req.session.uid;

    try {
        const postRef = db.ref(`users/${postAuthorId}/posts/${postId}`);
        const snapshot = await postRef.once('value');
        const post = snapshot.val();

        if (!post) {
            return res.status(404).send("Post not found");
        }

        // Ensure reasons is not undefined
        const reasonsArray = reasons ? (Array.isArray(reasons) ? reasons : [reasons]) : [];
        
        // Filter out any undefined values
        const validReasons = reasonsArray.filter(reason => reason !== undefined);

        // Update the post data
        const updatedPost = {
            ...post,
            dislikes: (post.dislikes || 0) + 1,
            dislikeReasons: [...(post.dislikeReasons || []), ...validReasons],
            dislikedBy: post.dislikedBy || []
        };

        if (!updatedPost.dislikedBy.includes(userId)) {
            updatedPost.dislikedBy.push(userId);
        }

        await postRef.set(updatedPost);
        res.redirect("/dashboard");
    } catch (error) {
        console.error("Error disliking post:", error);
        res.status(500).send("Error disliking post");
    }
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

app.post("/create-profile", checkAuth, uploadProfilePic.single("profilePic"), async (req, res) => {
    try {
        const { name, email, bio } = req.body;
        const userId = req.session.uid;
        const profilePic = req.file ? `/profilePics/${req.file.filename}` : null;
        
        const profileData = {
            name,
            email,
            bio: bio || "",
            profilePic,
            followers: [],
            following: [],
            createdAt: admin.database.ServerValue.TIMESTAMP
        };
        
        await db.ref(`users/${userId}/profile`).set(profileData);
        
        res.redirect("/profiles");
    } catch (error) {
        console.error('Error creating profile:', error);
        res.status(500).send('Error creating profile');
    }
})


app.post('/follow/:userId', checkAuth, async (req, res) => {
    try {
        const currentUserId = req.session.uid;
        const targetUserId = req.params.userId;
        
        // Get both user profiles
        const currentUserRef = db.ref(`users/${currentUserId}/profile`);
        const targetUserRef = db.ref(`users/${targetUserId}/profile`);
        
        // Update following for current user
        await currentUserRef.child('following').transaction(following => {
            following = following || [];
            if (!following.includes(targetUserId)) {
                following.push(targetUserId);
            }
            return following;
        });
        
        // Update followers for target user
        await targetUserRef.child('followers').transaction(followers => {
            followers = followers || [];
            if (!followers.includes(currentUserId)) {
                followers.push(currentUserId);
            }
            return followers;
        });
        
        res.redirect('/users-of-app');
    } catch (error) {
        console.error('Error following user:', error);
        res.redirect('/users-of-app?error=Failed to follow user');
    }
});

// Unfollow user route
app.post('/unfollow/:userId', checkAuth, async (req, res) => {
    try {
        const currentUserId = req.session.uid;
        const targetUserId = req.params.userId;
        
        // Get both user profiles
        const currentUserRef = db.ref(`users/${currentUserId}/profile`);
        const targetUserRef = db.ref(`users/${targetUserId}/profile`);
        
        // Remove from following list
        await currentUserRef.child('following').transaction(following => {
            following = following || [];
            const index = following.indexOf(targetUserId);
            if (index > -1) {
                following.splice(index, 1);
            }
            return following;
        });
        
        // Remove from followers list
        await targetUserRef.child('followers').transaction(followers => {
            followers = followers || [];
            const index = followers.indexOf(currentUserId);
            if (index > -1) {
                followers.splice(index, 1);
            }
            return followers;
        });
        
        res.redirect('/users-of-app');
    } catch (error) {
        console.error('Error unfollowing user:', error);
        res.redirect('/users-of-app?error=Failed to unfollow user');
    }
});
//const path = require('path');

// Load local posts from JSON file
const axios = require('axios');

// Function to fetch external posts
const SUBREDDIT_MAPPING = {
    technology: 'technology',
    education: 'education',
    sports: 'sports',
    health: 'health',
    entertainment: 'entertainment'
};

app.get('/posts/:category', async (req, res) => {
    const { category } = req.params;
    const filteredPosts = await getRedditPosts(category); // Fetch posts from Reddit
    res.render('postsByCategory', { posts: filteredPosts, user: req.session });
});


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
const getUserProfile = async (userId) => {
    try {
        const snapshot = await db.ref(`users/${userId}/profile`).once('value');
        return snapshot.val();
    } catch (error) {
        console.error('Error fetching user profile:', error);
        return null;
    }
};
// Function to update user profile in Firebase
async function updateUserProfile(userId, profileData) {
    try {
        await db.ref(`users/${userId}/profile`).update(profileData);
        return true;
    } catch (error) {
        console.error('Error updating user profile:', error);
        return false;
    }
}

// Function to get all active users
const getAllProfiles = async () => {
    try {
        const snapshot = await db.ref('users').once('value');
        const users = [];
        
        snapshot.forEach((childSnapshot) => {
            const userId = childSnapshot.key;
            const userData = childSnapshot.val();
            
            if (userData && userData.profile) {
                users.push({
                    id: userId,
                    ...userData.profile,
                    followers: userData.profile.followers || [],
                    following: userData.profile.following || []
                });
            }
        });
        
        return users;
    } catch (error) {
        console.error('Error fetching all profiles:', error);
        return [];
    }
};

// Updated users of app route with better error handling
app.get('/users-of-app', checkAuth, async (req, res) => {
    try {
        // Get current user's ID from session
        const currentUserId = req.session.uid;
        
        // Verify current user exists
        const currentUser = await getUserProfile(currentUserId);
        if (!currentUser) {
            throw new Error('Current user profile not found');
        }
        
        // Get all users
        const allUsers = await getAllProfiles();
        
        // Filter out current user and format data
        const users = allUsers
            .filter(user => user.id !== currentUserId)
            .map(user => ({
                ...user,
                followers: user.followers || [],
                following: user.following || []
            }));

        res.render('usersOfApp', {
            users,
            currentUserId,
            user: req.session,
            error: null,
            pages: [
                { name: 'Dashboard', url: '/dashboard' },
                { name: 'Focus Mode', url: '/focusMode' },
                { name: 'Mood Board', url: '/mood-board' },
                { name: 'Profiles', url: '/profiles' },
                { name: 'Explore', url: '/explore' },
                { name: 'Users of App', url: '/users-of-app' }
            ]
        });
    } catch (error) {
        console.error('Error in users-of-app route:', error);
        res.render('usersOfApp', {
            users: [],
            currentUserId: req.session.uid,
            user: req.session,
            error: 'Unable to load users. Please try again later.',
            pages: [
                { name: 'Dashboard', url: '/dashboard' },
                { name: 'Focus Mode', url: '/focusMode' },
                { name: 'Mood Board', url: '/mood-board' },
                { name: 'Profiles', url: '/profiles' },
                { name: 'Explore', url: '/explore' },
                { name: 'Users of App', url: '/users-of-app' }
            ]
        });
    }
});
// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
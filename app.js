const express = require("express");
const bodyParser = require("body-parser");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { spawnSync } = require("child_process");

const app = express();
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
//app.use(bodyParser.urlencoded({ extended: true }));

// Set storage for post images
const postStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/uploads");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

// Set storage for profile pictures
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

// Routes

// Homepage
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Serve static files (like JavaScript and CSS) from the 'public' directory
app.use(express.static(path.join(__dirname, "public")));

// Route to render the index page
app.get("/", (req, res) => {
  res.render("index"); // Will look for views/index.ejs or views/index.html
});

// Dashboard: Display posts and comments
app.get("/dashboard", (req, res) => {
  res.render("dashboard", { posts });
});


let postIdCounter = 1;
// Add a new post
app.post("/add-post", uploadPostImage.single("image"), (req, res) => {
  const { title, content } = req.body;
  const image = req.file ? `/uploads/${req.file.filename}` : null;

  posts.push({
    id: postIdCounter++, // Auto-increment ID
    title,
    content,
    image,
    comments: [],
    likes: 0,
    dislikes: 0,
    dislikeReasons: [],
  });
  res.redirect("/dashboard");
});

app.post("/add-comment", (req, res) => {
  const { postId, comment } = req.body;

  // Find the post by ID and add the comment
  const post = posts.find((post) => post.id === parseInt(postId));
  if (post) {
    post.comments.push(comment);
  }

  res.redirect("/dashboard");
});

app.post("/like-post", (req, res) => {
  const { postId } = req.body;

  // Find the post and increment the likes count
  const post = posts.find((post) => post.id === parseInt(postId));
  if (post) {
    post.likes++;
  }

  res.redirect("/dashboard");
});

 
app.post("/dislike-post", (req, res) => {
  const { postId, reasons } = req.body;

  // Find the post
  const post = posts.find((post) => post.id === parseInt(postId));
  if (post) {
    post.dislikes++;

    // If `reasons` is a single value, convert it to an array
    const reasonsArray = Array.isArray(reasons) ? reasons : [reasons];
    post.dislikeReasons.push(...reasonsArray);
  }

  res.redirect("/dashboard");
});



// Delete a post
app.post("/delete-post", (req, res) => {
  const { index } = req.body;
  posts.splice(index, 1);
  res.redirect("/dashboard");
});

//FOLLOWERS
let profiles = [
  {
    id: 1,
    name: "John Doe",
    email: "john@example.com",
    bio: "Bio of John",
    followers: [],
    profilePic: "https://randomuser.me/api/portraits/men/1.jpg",
  },
  {
    id: 2,
    name: "Jane Smith",
    email: "jane@example.com",
    bio: "Bio of Jane",
    followers: [],
    profilePic: "https://randomuser.me/api/portraits/women/2.jpg",
  },
  {
    id: 3,
    name: "Sam Brown",
    email: "sam@example.com",
    bio: "Bio of Sam",
    followers: [],
    profilePic: "https://randomuser.me/api/portraits/men/3.jpg",
  },
  {
    id: 4,
    name: "Emily White",
    email: "emily@example.com",
    bio: "Bio of Emily",
    followers: [],
    profilePic: "https://randomuser.me/api/portraits/women/4.jpg",
  },
  {
    id: 5,
    name: "Michael Green",
    email: "michael@example.com",
    bio: "Bio of Michael",
    followers: [],
    profilePic: "https://randomuser.me/api/portraits/men/5.jpg",
  },
  {
    id: 6,
    name: "Laura Black",
    email: "laura@example.com",
    bio: "Bio of Laura",
    followers: [],
    profilePic: "https://randomuser.me/api/portraits/women/6.jpg",
  },
  {
    id: 7,
    name: "David Clark",
    email: "david@example.com",
    bio: "Bio of David",
    followers: [],
    profilePic: "https://randomuser.me/api/portraits/men/7.jpg",
  },
  {
    id: 8,
    name: "Sara Davis",
    email: "sara@example.com",
    bio: "Bio of Sara",
    followers: [],
    profilePic: "https://randomuser.me/api/portraits/women/8.jpg",
  },
  {
    id: 9,
    name: "James Johnson",
    email: "james@example.com",
    bio: "Bio of James",
    followers: [],
    profilePic: "https://randomuser.me/api/portraits/men/9.jpg",
  },
  {
    id: 10,
    name: "Natalie Williams",
    email: "natalie@example.com",
    bio: "Bio of Natalie",
    followers: [],
    profilePic: "https://randomuser.me/api/portraits/women/10.jpg",
  },
  {
    id: 11,
    name: "Chris Martinez",
    email: "chris@example.com",
    bio: "Bio of Chris",
    followers: [],
    profilePic: "https://randomuser.me/api/portraits/men/11.jpg",
  },
  {
    id: 12,
    name: "Anna Taylor",
    email: "anna@example.com",
    bio: "Bio of Anna",
    followers: [],
    profilePic: "https://randomuser.me/api/portraits/women/12.jpg",
  },
  {
    id: 13,
    name: "Robert Anderson",
    email: "robert@example.com",
    bio: "Bio of Robert",
    followers: [],
    profilePic: "https://randomuser.me/api/portraits/men/13.jpg",
  },
  {
    id: 14,
    name: "Megan Thomas",
    email: "megan@example.com",
    bio: "Bio of Megan",
    followers: [],
    profilePic: "https://randomuser.me/api/portraits/women/14.jpg",
  },
  {
    id: 15,
    name: "Daniel Lee",
    email: "daniel@example.com",
    bio: "Bio of Daniel",
    followers: [],
    profilePic: "https://randomuser.me/api/portraits/men/15.jpg",
  },
  {
    id: 16,
    name: "Lisa Walker",
    email: "lisa@example.com",
    bio: "Bio of Lisa",
    followers: [],
    profilePic: "https://randomuser.me/api/portraits/women/16.jpg",
  },
  {
    id: 17,
    name: "Matthew Hall",
    email: "matthew@example.com",
    bio: "Bio of Matthew",
    followers: [],
    profilePic: "https://randomuser.me/api/portraits/men/17.jpg",
  },
  {
    id: 18,
    name: "Olivia Lewis",
    email: "olivia@example.com",
    bio: "Bio of Olivia",
    followers: [],
    profilePic: "https://randomuser.me/api/portraits/women/18.jpg",
  },
  {
    id: 19,
    name: "Joshua Young",
    email: "joshua@example.com",
    bio: "Bio of Joshua",
    followers: [],
    profilePic: "https://randomuser.me/api/portraits/men/19.jpg",
  },
  {
    id: 20,
    name: "Sophia King",
    email: "sophia@example.com",
    bio: "Bio of Sophia",
    followers: [],
    profilePic: "https://randomuser.me/api/portraits/women/20.jpg",
  },
  {
    id: 21,
    name: "Andrew Wright",
    email: "andrew@example.com",
    bio: "Bio of Andrew",
    followers: [],
    profilePic: "https://randomuser.me/api/portraits/men/21.jpg",
  },
];

// Route to display profiles
app.get("/profiles", (req, res) => {
  res.render("profiles", { profiles });
});

// Route to search profiles
app.post("/search", (req, res) => {
  const searchTerm = req.body.searchTerm.toLowerCase();
  const results = profiles.filter((profile) =>
    profile.name.toLowerCase().includes(searchTerm)
  );
  res.render("searchResults", { profiles: results, searchTerm });
});

// Route to follow a user
app.post("/follow/:id", (req, res) => {
  const profile = profiles.find((p) => p.id === parseInt(req.params.id));
  const followerId = parseInt(req.body.followerId);

  if (profile && followerId) {
    const followerProfile = profiles.find((p) => p.id === followerId);
    if (followerProfile && !profile.followers.includes(followerId)) {
      profile.followers.push(followerId);
    }
    res.redirect("/profiles");
  } else {
    res.status(404).send("Profile or follower not found");
  }
});

// Route to unfollow a user
app.post("/unfollow/:id", (req, res) => {
  const profile = profiles.find((p) => p.id === parseInt(req.params.id));
  const followerId = parseInt(req.body.followerId);

  if (profile && followerId) {
    const index = profile.followers.indexOf(followerId);
    if (index !== -1) {
      profile.followers.splice(index, 1);
    }
    res.redirect("/profiles");
  } else {
    res.status(404).send("Profile or follower not found");
  }
});

// Profiles Page
app.get("/profiles", (req, res) => {
  res.render("profiles", { profiles });
});

// Create a profile
app.get("/create-profile", (req, res) => {
  res.render("createProfile");
});

app.post(
  "/create-profile",
  uploadProfilePic.single("profilePic"),
  (req, res) => {
    const { name, email, bio } = req.body;
    const profilePic = req.file ? '/profilePics/${req.file.filename}' : null;
    const newProfile = {
      id: profiles.length + 1,
      name,
      email,
      bio: bio || "",
      profilePic,
    };
    profiles.push(newProfile);
    res.redirect("/profiles");
  }
);

app.get("/view-profile/:id", (req, res) => {
  const profile = profiles.find((p) => p.id === parseInt(req.params.id));
  if (profile) res.render("viewProfile", { profile });
  else res.status(404).send("Profile not found");
});

// Edit a profile
app.get("/edit-profile/:id", (req, res) => {
  const profile = profiles.find((p) => p.id === parseInt(req.params.id));
  if (profile) {
    res.render("editProfile", { profile });
  } else {
    res.status(404).send("Profile not found");
  }
});

app.post(
  "/edit-profile/:id",
  uploadProfilePic.single("profilePic"),
  (req, res) => {
    const profile = profiles.find((p) => p.id === parseInt(req.params.id));
    if (profile) {
      const { name, email, bio } = req.body;
      profile.name = name;
      profile.email = email;
      profile.bio = bio;
      if (req.file) {
        profile.profilePic = '/profilePics/${req.file.filename}';
      }
      res.redirect("/profiles");
    } else {
      res.status(404).send("Profile not found");
    }
  }
);

// Delete a profile
app.post("/delete-profile/:id", (req, res) => {
  const profileId = parseInt(req.params.id);
  const profile = profiles.find((p) => p.id === profileId);
  if (profile && profile.profilePic) {
    const filePath = path.join(__dirname, "public", profile.profilePic);
    fs.unlink(filePath, (err) => {
      if (err) console.error("Error deleting profile picture:", err);
    });
  }
  profiles = profiles.filter((p) => p.id !== profileId);
  res.redirect("/profiles");
});

app.use(bodyParser.json());
app.use(express.static("public"));

app.get("/focusMode", (req, res) => {
  // Define the initial value for focusTime
  const focusTime = 1; // This can be set dynamically as per your requirements
  res.render("focusMode", { focusTime }); // Pass focusTime to the EJS view
});

app.post("/analyze-sentiment", (req, res) => {
  const text = req.body.text;

  const pythonProcess = spawn("python", ["analyze_sentiment.py", text]);

  pythonProcess.stdout.on("data", (data) => {
    const sentiment = JSON.parse(data.toString());
    res.json(sentiment);
  });

  pythonProcess.stderr.on("data", (data) => {
    console.error("Error analyzing sentiment:", data.toString());
    res.status(500).send("Error analyzing sentiment");
  });
});


app.get('/mood-board', async (req, res) => {
  const moodData = []; // Initialize an array to store mood data

  // Use the posts array defined above
  for (const post of posts) {
      const pythonProcess = spawnSync('python', ['analyze_sentiment.py', post.content]);
      
      // Check for errors in the Python process
      if (pythonProcess.error) {
          console.error("Error from Python script:", pythonProcess.error);
          return res.status(500).json({ error: "Error analyzing sentiment" });
      }

      const output = pythonProcess.stdout.toString();

      try {
          const sentiment = JSON.parse(output);

          moodData.push({
              mood: sentiment.polarity > 0 ? "Positive" : sentiment.polarity < 0 ? "Negative" : "Neutral",
              polarity: sentiment.polarity,
              subjectivity: sentiment.subjectivity,
          });
      } catch (error) {
          console.error("Error parsing JSON:", error);
          return res.status(500).json({ error: "Error parsing sentiment data" });
      }
  }

  res.render('mood-board', { moodData });
});


app.use(bodyParser.urlencoded({ extended: true }));

// In-memory store for users (For demo purposes)
let users = [];

// Render the main page
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

// Handle Sign-Up (POST request)
app.post("/signup", (req, res) => {
  const { email, password } = req.body;

  // Check if user already exists
  if (users.find(user => user.email === email)) {
    return res.status(400).send("User already exists!");
  }

  // Save the user
  users.push({ email, password });

  // Send a success message
  res.send("User registered successfully!");
});

// Handle Login (POST request)
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  // Find user
  const user = users.find(user => user.email === email && user.password === password);

  if (!user) {
    return res.status(400).send("Invalid credentials!");
  }

  res.send("Login successful!");
});


// Start server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
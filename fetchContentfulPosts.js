const axios = require('axios');

// Function to fetch blog posts from JSONPlaceholder
async function fetchExternalPosts() {
  try {
    console.log("Fetching posts from JSONPlaceholder...");
    const response = await axios.get('https://jsonplaceholder.typicode.com/posts');
    console.log("Response received:", response.data); // Log the response data

    // Mapping the response to a simpler format
    const posts = response.data.map(item => ({
      id: item.id,
      title: item.title,
      content: item.body,
      date: new Date().toISOString() // Fake date for demonstration
    }));

    return posts;
  } catch (error) {
    console.error('Error fetching posts from JSONPlaceholder:', error.message);
    return [];
  }
}

module.exports = fetchExternalPosts;

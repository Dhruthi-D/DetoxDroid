async function analyzeSentiment(text) {
    const response = await fetch('/analyze-sentiment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });
  
    const data = await response.json();
    return data;
  }
  
  async function submitPost() {
    const text = document.getElementById('userPost').value;
  
    const result = await analyzeSentiment(text);
    const score = result.polarity;
    updateMoodBoard(score, text);
  
    document.getElementById('userPost').value = ''; // Clear the post textarea
  }
  
  async function submitComment() {
    const text = document.getElementById('userComment').value;
  
    const result = await analyzeSentiment(text);
    const score = result.polarity;
    updateMoodBoard(score, text);
  
    document.getElementById('userComment').value = ''; // Clear the comment textarea
  }
  
  function updateMoodBoard(score, text) {
    const emotionStatus = document.getElementById('emotionStatus');
    
    const moodEntry = document.createElement('div');
    moodEntry.classList.add('mood-entry');
    moodEntry.textContent = `${text} - ${score > 0 ? 'Positive' : 'Negative'}`;
  
    if (score < 0) {
      moodEntry.classList.add('negative');
      promptUser();
    } else {
      moodEntry.classList.add('positive');
    }
  
    emotionStatus.appendChild(moodEntry);
  }
  
  function promptUser() {
    const userChoice = confirm("You seem to be feeling sad or down. Would you like to take a break or exit the website?");
    
    if (userChoice) {
      alert("Take care and rest for a while!");
    } else {
      window.close(); // Close the website if the user chooses to exit
    }
  }
  
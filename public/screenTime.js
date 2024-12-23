// Set the screen time limit in seconds
const SCREEN_TIME_LIMIT = 60 * 1; // 60 seconds

let screenTime = 0;
let screenTimeInterval;
let promptDisplayed = false; // Track if the prompt has been displayed

// Function to start tracking screen time
function startScreenTimeTracking() {
  screenTimeInterval = setInterval(() => {
    screenTime += 1;
    console.log(`Screen time: ${screenTime} seconds`);

    if (screenTime >= SCREEN_TIME_LIMIT && !promptDisplayed) {
      promptDisplayed = true; // Mark that the prompt has been displayed
      clearInterval(screenTimeInterval);
      promptUser();
    }
  }, 1000); // Increase the time every second
}

// Function to prompt the user
function promptUser() {
  const userChoice = confirm(
    "You have been on this page for a while. Would you like to take a break or exit the app?"
  );

  if (userChoice) {
    alert("Please take a break!");
    screenTime = 0; // Reset screen time if the user chooses to take a break
    startScreenTimeTracking(); // Restart screen time tracking after break
  } else {
    // If the window is opened by JavaScript, it can be closed
    if (window.opener) {
      window.close(); // Close the window if it was opened by JS (e.g., using window.open())
    } else {
      // If window.close() doesn't work, we could display a message or take other actions
      alert("You chose to exit. Please close the browser tab manually.");
    }
  }
}

// Start tracking screen time when the page loads
window.onload = startScreenTimeTracking;

let startTime = Date.now(); // Get the current time when the page loads
let elapsedTime = 0; // Initialize elapsed time in seconds

// Function to update the elapsed time every second
function updateTime() {
  // Calculate the time difference between now and the start time
  elapsedTime = Math.floor((Date.now() - startTime) / 1000); // Time in seconds

  // Update the displayed time on the page
  document.getElementById(
    "timeSpent"
  ).innerText = `Time Spent: ${elapsedTime} seconds`;

  // If the time exceeds a certain limit, show a prompt
  if (elapsedTime >= 60 && !promptDisplayed) { // Only show prompt once
    alert(
      "You have spent more than 1 minute on this page. Do you want to take a break?"
    );
    promptDisplayed = true; // Mark that the prompt has been displayed
  }
}

// Update the time every second
setInterval(updateTime, 1000);

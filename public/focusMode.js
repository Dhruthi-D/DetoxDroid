let focusTime = parseInt(document.getElementById('focus-time').value);
let timerDisplay = document.getElementById('timer-display');
let stopFocusBtn = document.getElementById('stop-focus-btn');
let startFocusBtn = document.getElementById('start-focus-btn');

let remainingTime = focusTime * 60; // Convert minutes to seconds
let focusInterval;

function formatTime(seconds) {
  let minutes = Math.floor(seconds / 60);
  let secondsRemaining = seconds % 60;
  return `${minutes < 10 ? '0' + minutes : minutes}:${secondsRemaining < 10 ? '0' + secondsRemaining : secondsRemaining}`;
}

function startFocusMode() {
  focusInterval = setInterval(() => {
    remainingTime -= 1;
    timerDisplay.textContent = formatTime(remainingTime);
    
    if (remainingTime <= 0) {
      clearInterval(focusInterval);
      stopFocusBtn.disabled = true;
      // Call function to reset notifications or apps here
      alert("Focus Mode Ended!");
    }
  }, 1000);
}

document.getElementById('start-focus-btn').addEventListener('click', (event) => {
  event.preventDefault();
  startFocusMode();
  stopFocusBtn.disabled = false;

  // Send POST request to activate Focus Mode on server-side
  fetch('/focusMode/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ focusTime: focusTime })
  });
});

stopFocusBtn.addEventListener('click', (event) => {
  event.preventDefault();
  clearInterval(focusInterval);
  stopFocusBtn.disabled = true;
  timerDisplay.textContent = formatTime(focusTime * 60); // Reset timer
  
  // Send POST request to stop Focus Mode on server-side
  fetch('/focusMode/stop', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
});

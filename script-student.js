import {
  readData,
  writeData,
  appState,
  listenToData,
  showScreen,
} from "./app.js";

function getAllQuestions(quizData) {
  const questions = [];
  quizData.sections.forEach((section) => {
    section.questions.forEach((question, index) => {
      questions.push({
        ...question,
        sectionName: section.name,
        globalIndex: questions.length,
      });
    });
  });
  return questions;
}

function getCurrentQuestion(quizData, questionIndex) {
  const allQuestions = getAllQuestions(quizData);
  return allQuestions[questionIndex] || null;
}

function calculateScore(quizData, answers) {
  const scores = {};
  let totalScore = 0;

  quizData.sections.forEach((section) => {
    let sectionScore = 0;
    let questionIndex = 0;

    // Calculate starting index for this section
    for (let s = 0; s < quizData.sections.indexOf(section); s++) {
      questionIndex += quizData.sections[s].questions.length;
    }

    section.questions.forEach((question, localIndex) => {
      const globalIndex = questionIndex + localIndex;
      const answer = answers[globalIndex];

      if (
        answer !== undefined &&
        isAnswerCorrect(question, answer.answer || answer)
      ) {
        sectionScore++;
      }
    });

    scores[section.name] = sectionScore;
    totalScore += sectionScore;
  });

  return { scores, totalScore };
}

function isAnswerCorrect(question, answer) {
  if (question.type === "single") {
    if (typeof answer === "object" && answer !== null) {
      return answer.answer === question.correct[0];
    } else {
      return answer === question.correct[0];
    }
  } else if (question.type === "multiple") {
    if (!Array.isArray(answer) || !Array.isArray(question.correct))
      return false;
    return (
      answer.length === question.correct.length &&
      answer.every((a) => question.correct.includes(a))
    );
  } else if (question.type === "text") {
    return (
      answer &&
      answer.toLowerCase().trim() === question.correct.toLowerCase().trim()
    );
  }
  return false;
}

function handlePlayerSetup() {
  document
    .getElementById("join-quiz-btn")
    .addEventListener("click", async () => {
      const sessionCode = document
        .getElementById("session-code")
        .value.trim()
        .toUpperCase();
      const playerName = document.getElementById("player-name").value.trim();

      if (!sessionCode || !playerName) {
        alert("Please enter both session code and your name");
        return;
      }

      try {
        const sessionData = await readData(`sessions/${sessionCode}`);
        if (!sessionData) {
          alert("Session not found. Please check the session code.");
          return;
        }
        if (!appState.playerId) {
          alert("User is not logged in.");
          return;
        }

        // Generate unique player ID
        const playerId = appState.playerId;
        const playerData = {
          id: playerId,
          name: playerName,
          scores: {},
          totalScore: 0,
          answers: {},
          joinedAt: Date.now(),
          currentQuestionIndex: 0,
          isFinished: false,
        };

        await writeData(
          `sessions/${sessionCode}/players/${playerId}`,
          playerData
        );

        appState.sessionId = sessionCode;
        appState.playerName = playerName;
        appState.isAdmin = false;
        appState.quizData = sessionData.quizData;

        localStorage.setItem("playerId", playerId);
        setupWaitingRoom();
        showScreen("waiting-room-screen");
      } catch (error) {
        alert("Error joining session: " + error.message);
      }
    });
}

function setupWaitingRoom() {
  // Save session
  localStorage.setItem("currentSession", appState.sessionId);
  // Setup Waiting Room
  document.getElementById("waiting-session-code").textContent =
    appState.sessionId;
  document.getElementById("player-name-display").textContent =
    appState.playerName;

  const connectionIcon = document.getElementById("connection-icon");
  const connectionText = document.getElementById("connection-text");
  connectionIcon.className = "fas fa-wifi";
  connectionText.textContent = "Connected";
  connectionIcon.parentElement.className = "connection-status connected";

  listenToData(`sessions/${appState.sessionId}/players`, (playersData) => {
    if (playersData) {
      const count = Object.keys(playersData).length;
      document.getElementById("connected-count").textContent = count;
    }
  });

  // Listen for game state changes
  listenToData(`sessions/${appState.sessionId}/gameState`, (gameState) => {
    if (gameState === "playing") {
      appState.currentQuestionIndex = 0;
      setupQuizGame();
      showScreen("quiz-game-screen");
    }
  });
}

function setupQuizGame() {
  const allQuestions = getAllQuestions(appState.quizData);
  const totalQuestions = allQuestions.length;

  document.getElementById("total-questions").textContent = totalQuestions;

  if (appState.isAdmin) {
    setupAdminDashboard();
    showScreen("admin-dashboard-screen");
  } else {
    displayQuestion();
  }
}

function displayQuestion() {
  const currentQuestion = getCurrentQuestion(
    appState.quizData,
    appState.currentQuestionIndex
  );
  if (!currentQuestion) {
    // Player finished - show their results
    showPlayerResults();
    return;
  }

  // Update progress
  const totalQuestions = getAllQuestions(appState.quizData).length;
  const progressPercent = Math.round(
    ((appState.currentQuestionIndex + 1) / totalQuestions) * 100
  );

  document.getElementById("current-question-num").textContent =
    appState.currentQuestionIndex + 1;
  document.getElementById("progress-percent").textContent = progressPercent;
  document.getElementById("progress-fill").style.width = progressPercent + "%";

  // Update section and question
  document.getElementById("current-section").textContent =
    currentQuestion.sectionName;
  document.getElementById("question-text").textContent =
    currentQuestion.question;

  // Reset answer state
  appState.selectedAnswer = null;
  appState.hasAnswered = false;
  document.getElementById("answer-submitted").classList.add("hidden");
  document.getElementById("submit-answer-btn").classList.remove("hidden");

  // Setup timer
  appState.timeLeft =
    currentQuestion.timeLimit || appState.quizData.defaultTimeLimit || 60;
  document.getElementById("time-left").textContent = appState.timeLeft;
  startTimer();

  // Display answer options
  displayAnswerOptions(currentQuestion);
}

async function showPlayerResults() {
  appState.isQuizFinished = true;

  // Calculate final scores
  const { scores, totalScore } = calculateScore(
    appState.quizData,
    appState.playerAnswers
  );

  // Update player data in database
  const playerData = await readData(
    `sessions/${appState.sessionId}/players/${appState.playerId}`
  );
  playerData.scores = scores;
  playerData.totalScore = totalScore;
  playerData.isFinished = true;
  writeData(
    `sessions/${appState.sessionId}/players/${appState.playerId}`,
    playerData
  );

  // Show results screen
  let resultsScreen = document.getElementById("player-results-screen");
  if (!resultsScreen) {
    resultsScreen = document.createElement("div");
    resultsScreen.id = "player-results-screen";
    resultsScreen.className = "screen active";
    resultsScreen.innerHTML = `
            <div class="quiz-container">
                <div class="quiz-header">
                    <h2>🎉 Quiz Complete!</h2>
                    <p>Great job, ${appState.playerName}!</p>
                </div>
                <div class="quiz-content">
                    <div class="score-summary">
                        <div class="total-score">
                            <h3>Total Score: ${totalScore}</h3>
                        </div>
                        <div class="section-scores">
                            <h4>Section Breakdown:</h4>
                            ${Object.entries(scores)
                              .map(
                                ([section, score]) =>
                                  `<div class="section-score">
                                    <span class="section-name">${section}:</span> 
                                    <span class="section-points">${score} points</span>
                                </div>`
                              )
                              .join("")}
                        </div>
                    </div>
                    <div class="ranking-info">
                        <p>Your ranking will update as other players finish...</p>
                        <div id="current-ranking"></div>
                    </div>
                </div>
            </div>
        `;
    document.body.appendChild(resultsScreen);
  }

  showScreen("player-results-screen");

  // Listen for other players finishing to update ranking
  listenToData(`sessions/${appState.sessionId}/players`, (playersData) => {
    if (playersData) {
      updatePlayerRanking(playersData);
    }
  });
}

function updatePlayerRanking(playersData) {
  const finishedPlayers = Object.values(playersData).filter(
    (p) => p.isFinished
  );
  finishedPlayers.sort((a, b) => b.totalScore - a.totalScore);

  const playerRank =
    finishedPlayers.findIndex((p) => p.name === appState.playerName) + 1;
  const totalFinished = finishedPlayers.length;

  const rankingDiv = document.getElementById("current-ranking");
  if (rankingDiv) {
    rankingDiv.innerHTML = `
            <div class="current-rank">
                <strong>Current Ranking: #${playerRank} out of ${totalFinished} finished players</strong>
            </div>
            <div class="top-players">
                <h5>Top Players:</h5>
                ${finishedPlayers
                  .slice(0, 3)
                  .map(
                    (player, index) =>
                      `<div class="top-player ${
                        player.name === appState.playerName
                          ? "current-player"
                          : ""
                      }">
                        ${index + 1}. ${player.name} - ${
                        player.totalScore
                      } points
                    </div>`
                  )
                  .join("")}
            </div>
        `;
  }
}

function displayAnswerOptions(question) {
  const optionsContainer = document.getElementById("answer-options");
  optionsContainer.innerHTML = "";

  if (question.type === "single" && question.options) {
    question.options.forEach((option, index) => {
      const optionDiv = document.createElement("div");
      optionDiv.className = "answer-option";
      optionDiv.innerHTML = `
                <div class="option-indicator"></div>
                <div class="option-text">${option}</div>
            `;
      optionDiv.addEventListener("click", () => selectSingleAnswer(index));
      optionsContainer.appendChild(optionDiv);
    });
  } else if (question.type === "multiple" && question.options) {
    question.options.forEach((option, index) => {
      const optionDiv = document.createElement("div");
      optionDiv.className = "answer-option";
      optionDiv.innerHTML = `
                <div class="option-indicator square"></div>
                <div class="option-text">${option}</div>
            `;
      optionDiv.addEventListener("click", () => selectMultipleAnswer(index));
      optionsContainer.appendChild(optionDiv);
    });
  } else if (question.type === "text") {
    const textArea = document.createElement("textarea");
    textArea.className = "text-answer";
    textArea.placeholder = "Type your answer here...";
    textArea.addEventListener("input", (e) => {
      appState.selectedAnswer = e.target.value;
      updateSubmitButton();
    });
    optionsContainer.appendChild(textArea);
  }

  updateSubmitButton();
}

function selectSingleAnswer(index) {
  if (appState.hasAnswered) return;

  appState.selectedAnswer = index;

  // Update visual selection
  document.querySelectorAll(".answer-option").forEach((option, i) => {
    const indicator = option.querySelector(".option-indicator");
    if (i === index) {
      option.classList.add("selected");
      indicator.classList.add("selected");
    } else {
      option.classList.remove("selected");
      indicator.classList.remove("selected");
    }
  });

  updateSubmitButton();
}

function selectMultipleAnswer(index) {
  if (appState.hasAnswered) return;

  if (!Array.isArray(appState.selectedAnswer)) {
    appState.selectedAnswer = [];
  }

  const currentAnswers = [...appState.selectedAnswer];
  const answerIndex = currentAnswers.indexOf(index);

  if (answerIndex > -1) {
    currentAnswers.splice(answerIndex, 1);
  } else {
    currentAnswers.push(index);
  }

  appState.selectedAnswer = currentAnswers;

  // Update visual selection
  document.querySelectorAll(".answer-option").forEach((option, i) => {
    const indicator = option.querySelector(".option-indicator");
    if (currentAnswers.includes(i)) {
      option.classList.add("selected-multiple");
      indicator.classList.add("selected-multiple");
    } else {
      option.classList.remove("selected-multiple");
      indicator.classList.remove("selected-multiple");
    }
  });

  updateSubmitButton();
}

function updateSubmitButton() {
  const submitBtn = document.getElementById("submit-answer-btn");
  const hasValidAnswer =
    appState.selectedAnswer !== null &&
    appState.selectedAnswer !== "" &&
    (!Array.isArray(appState.selectedAnswer) ||
      appState.selectedAnswer.length > 0);

  submitBtn.disabled = !hasValidAnswer || appState.hasAnswered;
}

function startTimer() {
  if (appState.timer) {
    clearInterval(appState.timer);
  }

  const updateTimer = () => {
    document.getElementById("time-left").textContent = appState.timeLeft;

    const currentQuestion = getCurrentQuestion(
      appState.quizData,
      appState.currentQuestionIndex
    );
    const totalTime =
      currentQuestion?.timeLimit || appState.quizData.defaultTimeLimit || 60;
    const timePercent = (appState.timeLeft / totalTime) * 100;

    const timeFill = document.getElementById("time-fill");
    const timerDisplay = document.querySelector(".timer-display");

    timeFill.style.width = timePercent + "%";

    if (appState.timeLeft <= 10) {
      timeFill.classList.add("warning");
      timerDisplay.classList.add("warning");
    } else {
      timeFill.classList.remove("warning");
      timerDisplay.classList.remove("warning");
    }

    if (appState.timeLeft <= 0) {
      clearInterval(appState.timer);
      if (!appState.hasAnswered) {
        submitAnswer();
      }
    } else {
      appState.timeLeft--;
    }
  };

  updateTimer();
  appState.timer = setInterval(updateTimer, 1000);
}

function submitAnswer() {
  if (appState.hasAnswered) return;

  appState.hasAnswered = true;
  clearInterval(appState.timer);

  // Save answer
  const currentQuestion = getCurrentQuestion(
    appState.quizData,
    appState.currentQuestionIndex
  );
  const timeUsed = (currentQuestion?.timeLimit || 60) - appState.timeLeft - 1;

  appState.playerAnswers[appState.currentQuestionIndex] = {
    answer: appState.selectedAnswer,
    timeUsed: timeUsed,
  };

  // Update player progress in database
  writeData(
    `sessions/${appState.sessionId}/players/${appState.playerId}/currentQuestionIndex`,
    appState.currentQuestionIndex + 1
  );
  writeData(
    `sessions/${appState.sessionId}/players/${appState.playerId}/answers/${appState.currentQuestionIndex}`,
    {
      answer: appState.selectedAnswer,
      timeUsed: timeUsed,
    }
  );

  // Show submitted state briefly then move to next question
  document.getElementById("submit-answer-btn").classList.add("hidden");
  document.getElementById("answer-submitted").classList.remove("hidden");

  setTimeout(() => {
    appState.currentQuestionIndex++;
    displayQuestion();
  }, 1500);
}

// Initialize the application
async function initApp() {
  console.log("Initializing app...");

  const savedSession = localStorage.getItem("currentSession");
  if (savedSession) {
    const sessionData = await readData(`sessions/${savedSession}`);
    const savedPlayerId = localStorage.getItem("playerId");
    if (
      sessionData &&
      savedPlayerId &&
      Object.values(sessionData.players || {}).some(
        (e) => e.id === savedPlayerId
      ) &&
      (sessionData.gameState === "waiting" ||
        sessionData.gameState === "playing")
    ) {
      appState.sessionId = savedSession;
      appState.playerId = savedPlayerId;
      appState.playerName = sessionData.playerName;
      appState.isAdmin = localStorage.getItem("isAdmin") || false;
      appState.quizData = sessionData.quizData;
      if (sessionData.gameState === "waiting") {
        setupWaitingRoom();
        showScreen("waiting-room-screen");
      } else {
        appState.currentQuestionIndex = 0;
        setupQuizGame();
        showScreen("quiz-game-screen");
      }
    } else {
      localStorage.removeItem("currentSession");
      localStorage.removeItem("playerId");
      handlePlayerSetup();
    }
  } else {
    // Setup initial event listeners
    handlePlayerSetup();
  }

  // Setup submit answer button
  const submitBtn = document.getElementById("submit-answer-btn");
  if (submitBtn) {
    submitBtn.addEventListener("click", submitAnswer);
  }

  console.log("Quiz app initialized");
}

// Start the app when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM loaded, initializing app...");
  initApp();
});

// Cleanup listeners when page unloads
window.addEventListener("beforeunload", () => {
  appState.listeners.forEach((cleanup) => cleanup());
  if (appState.timer) {
    clearInterval(appState.timer);
  }
});

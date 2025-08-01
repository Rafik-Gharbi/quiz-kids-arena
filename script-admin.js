import * as bootstrap from "bootstrap";
import {
  auth,
  hideError,
  showError,
  generateSessionId,
  writeData,
  readData,
  appState,
  listenToData,
  showScreen,
  sanitizeKey,
} from "./app.js";

// Quiz logic functions
function validateQuizData(jsonString) {
  try {
    const data = JSON.parse(jsonString);
    if (!data.sections || !Array.isArray(data.sections)) {
      throw new Error("Quiz data must have a sections array");
    }

    for (const section of data.sections) {
      if (
        !section.name ||
        !section.questions ||
        !Array.isArray(section.questions)
      ) {
        throw new Error("Each section must have a name and questions array");
      }

      for (const question of section.questions) {
        if (
          !question.question ||
          !question.type ||
          question.correct === undefined
        ) {
          throw new Error(
            "Each question must have question, type, and correct properties"
          );
        }
      }
    }

    return data;
  } catch (error) {
    throw new Error("Invalid JSON format: " + error.message);
  }
}

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

function handleAdminSetup() {
  document
    .getElementById("create-session-btn")
    .addEventListener("click", async () => {
      const jsonInput = document.getElementById("quiz-json").value.trim();
      hideError("json-error");

      if (!jsonInput) {
        showError("json-error", "Please enter quiz JSON data");
        return;
      }

      try {
        const quizData = validateQuizData(jsonInput);
        const sessionId = generateSessionId();
        // Initialize session
        await writeData(`sessions/${sessionId}`, {
          id: sessionId,
          admin: auth.currentUser.uid, // 👈 Include the admin
          created: new Date().toISOString(),
          password: sessionId,
          quizData,
          started: false,
          players: [],
          gameState: "waiting",
        });

        appState.sessionId = sessionId;
        appState.isAdmin = true;
        appState.quizData = quizData;

        setupAdminPanel();
        showScreen("admin-panel-screen");
      } catch (error) {
        showError("json-error", error.message);
      }
    });
}

function setupAdminPanel() {
  // Save session info in localStorage
  localStorage.setItem("currentSession", appState.sessionId);
  localStorage.setItem("isAdmin", true);
  // Display session info
  document.getElementById("display-session-code").textContent =
    appState.sessionId;

  // Update quiz stats
  const sectionsCount = appState.quizData.sections.length;
  const questionsCount = appState.quizData.sections.reduce(
    (total, section) => total + section.questions.length,
    0
  );

  document.getElementById("sections-count").textContent = sectionsCount;
  document.getElementById("questions-count").textContent = questionsCount;

  // Display quiz sections
  const sectionsContainer = document.getElementById("quiz-sections");
  sectionsContainer.innerHTML = "";
  appState.quizData.sections.forEach((section) => {
    const sectionDiv = document.createElement("div");
    sectionDiv.className = "section-item";
    sectionDiv.innerHTML = `
            <div class="section-name">${section.name}</div>
            <div class="section-questions">${section.questions.length} questions</div>
        `;
    sectionsContainer.appendChild(sectionDiv);
  });

  // Listen for players joining
  listenToData(`sessions/${appState.sessionId}/players`, (playersData) => {
    if (playersData) {
      appState.players = playersData;
      updatePlayersDisplay(playersData);
    }
  });

  // Copy session code functionality
  document.getElementById("copy-code-btn").addEventListener("click", () => {
    navigator.clipboard.writeText(appState.sessionId).then(() => {
      const btn = document.getElementById("copy-code-btn");
      const originalIcon = btn.innerHTML;
      btn.innerHTML = '<i class="fas fa-check"></i>';
      setTimeout(() => {
        btn.innerHTML = originalIcon;
      }, 2000);
    });
  });

  // Start game button
  document
    .getElementById("start-game-btn")
    .addEventListener("click", async () => {
      if (Object.keys(appState.players).length === 0) {
        alert("At least one player must join before starting");
        return;
      }

      await writeData(`sessions/${appState.sessionId}/gameState`, "playing");
      await writeData(`sessions/${appState.sessionId}/startedAt`, Date.now());

      setupQuizGame();
      showScreen("progress-leaderboard-screen");
    });
}

function updatePlayersDisplay(playersData) {
  const playersCount = Object.keys(playersData).length;
  document.getElementById("players-count").textContent = playersCount;

  const playersList = document.getElementById("players-list");
  playersList.innerHTML = "";

  if (playersCount === 0) {
    playersList.innerHTML = `
            <div class="no-players">
                <i class="fas fa-users"></i>
                <p>No players have joined yet</p>
                <p class="small-text">Share the session code: <strong>${appState.sessionId}</strong></p>
            </div>
        `;
  } else {
    Object.values(playersData).forEach((player) => {
      const playerDiv = document.createElement("div");
      playerDiv.className = "player-item";
      playerDiv.innerHTML = `
                <div class="player-name">${player.name}</div>
                <div class="player-joined">Joined ${new Date(
                  player.joinedAt
                ).toLocaleTimeString()}</div>
            `;
      playersList.appendChild(playerDiv);
    });
  }

  // Update start button state
  const startBtn = document.getElementById("start-game-btn");
  startBtn.disabled = playersCount === 0;
  startBtn.innerHTML = `
        <i class="fas fa-play"></i>
        Start Quiz (${playersCount} players)
    `;
}

function setupQuizGame() {
  listenToData(`sessions/${appState.sessionId}/players`, (playersData) => {
    if (!playersData) return;
    appState.players = playersData;
    updateAdminDashboard(playersData);
  });

  // Check if all players are finished
  listenToData(
    `sessions/${appState.sessionId}/players`,
    async (playersData) => {
      if (playersData) {
        const playersList = Object.values(playersData);
        if (
          playersList.length > 0 &&
          playersList.every((p) => p.isFinished) &&
          appState.gameState !== "Finished"
        ) {
          await writeData(
            `sessions/${appState.sessionId}/gameState`,
            "Finished"
          );
          appState.gameState = "Finished";
          appState.players = playersData;
          summarizeQuizResult();
          showScreen("leaderboard-screen");
        }
      }
    }
  );
}

function updateAdminDashboard(playersData) {
  if (!playersData) return;

  const allQuestions = getAllQuestions(appState.quizData);
  const totalQuestions = allQuestions.length;
  const playersList = Object.values(playersData);
  const finishedPlayers = playersList.filter((p) => p.isFinished).length;

  // Update stats
  document.getElementById("admin-total-questions").textContent = totalQuestions;
  document.getElementById("total-players-count").textContent =
    playersList.length;
  document.getElementById("players-finished-count").textContent =
    finishedPlayers;

  // Sort players by questions answered (descending), then by name
  playersList.sort((a, b) => {
    if (b.currentQuestionIndex !== a.currentQuestionIndex) {
      return b.currentQuestionIndex - a.currentQuestionIndex;
    }
    return a.name.localeCompare(b.name);
  });

  // Update player progress list
  const tbody = document.getElementById("progress-leaderboard-body");
  tbody.innerHTML = "";
  Object.values(playersData).forEach((player) => {
    const tr = document.createElement("tr");

    // Player name
    const nameTd = document.createElement("td");
    nameTd.textContent = player.name;
    tr.appendChild(nameTd);

    // Current question
    const currentQuestionTd = document.createElement("td");
    if (player.isFinished) {
      currentQuestionTd.innerHTML = `<span class="badge bg-success">Finished</span>`;
    } else {
      currentQuestionTd.textContent = `Q${
        (player.currentQuestionIndex || 0) + 1
      }`;
    }
    tr.appendChild(currentQuestionTd);

    // Progress bar
    const progressTd = document.createElement("td");
    const progress =
      ((player.currentQuestionIndex || 0) / totalQuestions) * 100;
    progressTd.innerHTML = `
        <div class="progress" style="height: 18px;">
          <div class="progress-bar" role="progressbar" style="height: 100%; width: ${progress}%; min-width: 30px;">
            ${player.currentQuestionIndex || 0}/${totalQuestions}
          </div>
        </div>
      `;
    tr.appendChild(progressTd);

    tbody.appendChild(tr);
  });
}

function summarizeQuizResult() {
  // Gather all players and compute their total and per-section scores
  const playersList = Object.values(appState.players);

  // // Compute totalScore and per-section scores for each player
  // playersList.forEach((player) => {
  //   player.totalScore = 0;
  //   player.scores = {};
  //   appState.quizData.sections.forEach((section) => {
  //     let sectionScore = 0;
  //     if (player.answers && player.answers[section.name]) {
  //       sectionScore = player.answers[section.name].reduce(
  //         (sum, ans) => sum + (ans.isCorrect ? 1 : 0),
  //         0
  //       );
  //     }
  //     player.scores[section.name] = sectionScore;
  //     player.totalScore += sectionScore;
  //   });
  // });

  // Sort players by totalScore descending, then by name
  playersList.sort((a, b) => {
    if (b.totalScore !== a.totalScore) {
      return b.totalScore - a.totalScore;
    }
    return a.name.localeCompare(b.name);
  });

  // Setup section filters and detailed leaderboard
  setupDetailedResults();

  // Optionally, show section performance stats for admin
  const sectionStats = document.getElementById("section-stats");
  if (sectionStats) {
    sectionStats.innerHTML = "";
    appState.quizData.sections.forEach((section) => {
      const bestScore = Math.max(
        ...playersList.map((p) => p.scores[sanitizeKey(section.name)] || 0)
      );
      const avgScore =
        playersList.reduce(
          (sum, p) => sum + (p.scores[sanitizeKey(section.name)] || 0),
          0
        ) / playersList.length;
      const div = document.createElement("div");
      div.className = "section-stat";
      div.innerHTML = `
        <strong>${section.name}</strong> — 
        Best: <span class="stat-best">${bestScore}</span> /
        Avg: <span class="stat-avg">${avgScore.toFixed(2)}</span>
      `;
      sectionStats.appendChild(div);
    });
  }
}

function setupDetailedResults() {
  // Setup section filters
  const filtersContainer = document.getElementById("section-filters");
  filtersContainer.innerHTML = "";

  // Overall button
  const overallBtn = document.createElement("button");
  overallBtn.className = "btn btn-primary";
  overallBtn.textContent = "Overall";
  overallBtn.addEventListener("click", () => {
    setActiveFilter(overallBtn);
    updateDetailedLeaderboard("overall");
  });
  filtersContainer.appendChild(overallBtn);

  // Section buttons
  appState.quizData.sections.forEach((section) => {
    const sectionBtn = document.createElement("button");
    sectionBtn.className = "btn btn-outline";
    sectionBtn.textContent = section.name;
    sectionBtn.addEventListener("click", () => {
      setActiveFilter(sectionBtn);
      updateDetailedLeaderboard(section.name);
    });
    filtersContainer.appendChild(sectionBtn);
  });

  // Show overall by default
  updateDetailedLeaderboard("overall");
}

function setActiveFilter(activeBtn) {
  document.querySelectorAll("#section-filters .btn").forEach((btn) => {
    btn.className = "btn btn-outline";
  });
  activeBtn.className = "btn btn-primary";
}

function updateDetailedLeaderboard(section) {
  const playersList = Object.values(appState.players);

  // Sort players based on section
  if (section === "overall") {
    playersList.sort((a, b) => {
      if (b.totalScore !== a.totalScore) {
        return b.totalScore - a.totalScore;
      }
      return a.name.localeCompare(b.name);
    });
  } else {
    playersList.sort((a, b) => {
      const aScore = (a.scores && a.scores[section]) || 0;
      const bScore = (b.scores && b.scores[section]) || 0;
      if (bScore !== aScore) {
        return bScore - aScore;
      }
      return a.name.localeCompare(b.name);
    });
  }

  const leaderboardContainer = document.getElementById("detailed-leaderboard");
  leaderboardContainer.innerHTML = "";

  playersList.forEach((player, index) => {
    const position = index + 1;
    console.log("Player", player.name, "Score", player.totalScore);
    const score =
      section === "overall"
        ? player.totalScore || 0
        : (player.scores && player.scores[section]) || 0;

    const itemDiv = document.createElement("div");
    itemDiv.className = "leaderboard-item";

    const rankDisplay =
      position <= 3
        ? `<i class="fas fa-${
            position === 1 ? "trophy" : position === 2 ? "medal" : "award"
          } rank-icon"></i>`
        : `<span class="rank-number">#${position}</span>`;

    itemDiv.innerHTML = `
            <div class="player-info">
                <div class="rank-display">${rankDisplay}</div>
                <div class="player-details">
                    <div class="player-name-large">${player.name}</div>
                </div>
            </div>
            <div class="score-display">
                <div class="score-number">${score}</div>
                <div class="score-label">points</div>
            </div>
        `;

    leaderboardContainer.appendChild(itemDiv);
  });
}

// Initialize the application
async function initApp() {
  console.log("Initializing app...");

  let savedSession = localStorage.getItem("currentSession");
  if (savedSession) {
    const sessionData = await readData(`sessions/${savedSession}`);
    if (
      sessionData &&
      (sessionData.gameState === "waiting" ||
        sessionData.gameState === "playing")
    ) {
      appState.sessionId = sessionData.id;
      appState.isAdmin = localStorage.getItem("isAdmin") || false;
      appState.quizData = sessionData.quizData;

      if (sessionData.gameState === "waiting") {
        setupAdminPanel();
        showScreen("admin-panel-screen");
      } else {
        setupQuizGame();
        showScreen("progress-leaderboard-screen");
      }
    } else {
      localStorage.removeItem("currentSession");
      handleAdminSetup();
    }
  } else {
    // Setup initial event listeners
    handleAdminSetup();
  }

  console.log("Quiz app initialized");
}

// Start the app when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM loaded, initializing app...");
  document
    .getElementById("quiz-json-file")
    .addEventListener("change", function (e) {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function (event) {
        document.getElementById("quiz-json").value = event.target.result;
      };
      reader.readAsText(file);
    });
  const popoverTriggerEl = document.getElementById("popoverJsonInfo");
  const jsonExample = {
    sections: [
      {
        name: "HTML",
        questions: [
          {
            question: "What does HTML stand for?",
            type: "single",
            options: [
              "Hyper Text Markup Language",
              "High Text Markdown Language",
              "Home Tool Markup Language",
            ],
            correct: [0],
            timeLimit: 30,
          },
        ],
      },
    ],
  };
  const popover = new bootstrap.Popover(popoverTriggerEl, {
    html: true,
    sanitize: false,
    trigger: "manual",
    placement: "right",
    container: "body",
    customClass: "wide-popover",
    content: `
      <div>
        <div class="d-flex flex-row justify-content-between align-items-center">
          <span><p style="margin-bottom: 0 !important;"><strong>Your JSON data should follow this format:</strong></p></span>
          <span><button id="copyJsonBtn" class="btn btn-sm btn-outline-primary mt-2"><i class="bi bi-copy"></i></button></span>
        </div>
        <pre id="popoverJsonBlock" style="font-size: 0.75rem; white-space: pre-wrap;">${JSON.stringify(
          jsonExample,
          null,
          2
        )}</pre>
        <p class="mt-2 text-muted">PS: <code>timeLimit</code> is optional (default is 60s).</p>
      </div>
    `,
  });
  let popoverOpen = false;
  // Toggle popover manually
  popoverTriggerEl.addEventListener("click", (e) => {
    e.stopPropagation();

    if (popoverOpen) {
      popover.hide();
      popoverOpen = false;
    } else {
      popover.show();
      popoverOpen = true;

      setTimeout(() => {
        // Copy button logic
        const copyBtn = document.getElementById("copyJsonBtn");
        const jsonBlock = document.getElementById("popoverJsonBlock");

        if (copyBtn && jsonBlock) {
          copyBtn.addEventListener("click", (e) => {
            e.stopPropagation(); // ✅ Prevents this click from closing the popover

            navigator.clipboard
              .writeText(jsonBlock.textContent)
              .then(() => {
                copyBtn.textContent = "Copied!";
                setTimeout(
                  () => (copyBtn.innerHTML = '<i class="bi bi-copy"></i>'),
                  1500
                );
              })
              .catch(() => {
                copyBtn.textContent = "Failed to copy";
              });
          });
        }
      }, 50); // wait for DOM insertion
    }
  });

  // Close popover on outside click
  document.addEventListener("click", (event) => {
    const popoverEl = document.querySelector(".popover");

    if (
      popoverOpen &&
      popoverEl &&
      !popoverEl.contains(event.target) &&
      event.target !== popoverTriggerEl
    ) {
      popover.hide();
      popoverOpen = false;
    }
  });

  initApp();
});

// Cleanup listeners when page unloads
window.addEventListener("beforeunload", () => {
  appState.listeners.forEach((cleanup) => cleanup());
  if (appState.timer) {
    clearInterval(appState.timer);
  }
});

// Firebase configuration (you'll need to replace with your actual config)
const firebaseConfig = {
    // Replace with your Firebase config
    apiKey: "your-api-key",
    authDomain: "your-project.firebaseapp.com",
    databaseURL: "https://your-project-default-rtdb.firebaseio.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "your-app-id"
};

// Initialize Firebase (fallback to localStorage if not configured)
let database = null;
let isFirebaseEnabled = false;

try {
    if (typeof firebase !== 'undefined' && firebaseConfig.apiKey !== 'your-api-key') {
        firebase.initializeApp(firebaseConfig);
        database = firebase.database();
        isFirebaseEnabled = true;
        console.log('Firebase initialized successfully');
    } else {
        console.log('Firebase not configured, using localStorage fallback');
    }
} catch (error) {
    console.log('Firebase initialization failed, using localStorage fallback:', error);
}

// Application state
let appState = {
    gameState: 'setup',
    isAdmin: false,
    sessionId: '',
    playerName: '',
    quizData: null,
    players: {},
    currentQuestionIndex: 0,
    selectedAnswer: null,
    hasAnswered: false,
    timeLeft: 60,
    timer: null,
    listeners: []
};

// Utility functions
function generateSessionId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function showScreen(screenId) {
    console.log('Switching to screen:', screenId);
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
    } else {
        console.error('Screen not found:', screenId);
    }
}

function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.classList.remove('hidden');
    }
}

function hideError(elementId) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.classList.add('hidden');
    }
}

// Firebase/LocalStorage data functions
function writeData(path, data) {
    return new Promise((resolve, reject) => {
        if (isFirebaseEnabled) {
            database.ref(path).set(data)
                .then(() => resolve())
                .catch(error => reject(error));
        } else {
            // LocalStorage fallback
            try {
                const key = `quiz_${path.replace(/\//g, '_')}`;
                localStorage.setItem(key, JSON.stringify(data));
                resolve();
            } catch (error) {
                reject(error);
            }
        }
    });
}

function readData(path) {
    return new Promise((resolve, reject) => {
        if (isFirebaseEnabled) {
            database.ref(path).once('value')
                .then(snapshot => resolve(snapshot.val()))
                .catch(error => reject(error));
        } else {
            // LocalStorage fallback
            try {
                const key = `quiz_${path.replace(/\//g, '_')}`;
                const data = localStorage.getItem(key);
                resolve(data ? JSON.parse(data) : null);
            } catch (error) {
                reject(error);
            }
        }
    });
}

function listenToData(path, callback) {
    if (isFirebaseEnabled) {
        const ref = database.ref(path);
        ref.on('value', snapshot => callback(snapshot.val()));
        appState.listeners.push(() => ref.off());
    } else {
        // LocalStorage fallback - simulate real-time updates with polling
        const pollInterval = setInterval(() => {
            readData(path).then(data => callback(data));
        }, 1000);
        appState.listeners.push(() => clearInterval(pollInterval));
    }
}

// Quiz logic functions
function validateQuizData(jsonString) {
    try {
        const data = JSON.parse(jsonString);
        if (!data.sections || !Array.isArray(data.sections)) {
            throw new Error('Quiz data must have a sections array');
        }
        
        for (const section of data.sections) {
            if (!section.name || !section.questions || !Array.isArray(section.questions)) {
                throw new Error('Each section must have a name and questions array');
            }
            
            for (const question of section.questions) {
                if (!question.question || !question.type || question.correct === undefined) {
                    throw new Error('Each question must have question, type, and correct properties');
                }
            }
        }
        
        return data;
    } catch (error) {
        throw new Error('Invalid JSON format: ' + error.message);
    }
}

function getAllQuestions(quizData) {
    const questions = [];
    quizData.sections.forEach(section => {
        section.questions.forEach((question, index) => {
            questions.push({
                ...question,
                sectionName: section.name,
                globalIndex: questions.length
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
    
    quizData.sections.forEach(section => {
        let sectionScore = 0;
        section.questions.forEach((question, qIndex) => {
            const globalIndex = Object.keys(answers).find(key => {
                const allQuestions = getAllQuestions(quizData);
                return allQuestions[parseInt(key)]?.question === question.question;
            });
            
            if (globalIndex !== undefined) {
                const answer = answers[globalIndex];
                if (isAnswerCorrect(question, answer)) {
                    sectionScore++;
                }
            }
        });
        scores[section.name] = sectionScore;
        totalScore += sectionScore;
    });
    
    return { scores, totalScore };
}

function isAnswerCorrect(question, answer) {
    if (question.type === 'single') {
        return answer === question.correct;
    } else if (question.type === 'multiple') {
        if (!Array.isArray(answer) || !Array.isArray(question.correct)) return false;
        return answer.length === question.correct.length && 
               answer.every(a => question.correct.includes(a));
    } else if (question.type === 'text') {
        return answer && answer.toLowerCase().trim() === question.correct.toLowerCase().trim();
    }
    return false;
}

// Event handlers
function handleSetupChoice() {
    const adminBtn = document.getElementById('admin-btn');
    const playerBtn = document.getElementById('player-btn');
    
    if (adminBtn) {
        adminBtn.addEventListener('click', () => {
            console.log('Admin button clicked');
            showScreen('admin-setup-screen');
        });
    }

    if (playerBtn) {
        playerBtn.addEventListener('click', () => {
            console.log('Player button clicked');
            showScreen('player-setup-screen');
        });
    }
}

function handleAdminSetup() {
    document.getElementById('create-session-btn').addEventListener('click', async () => {
        const jsonInput = document.getElementById('quiz-json').value.trim();
        hideError('json-error');
        
        if (!jsonInput) {
            showError('json-error', 'Please enter quiz JSON data');
            return;
        }
        
        try {
            const quizData = validateQuizData(jsonInput);
            const sessionId = generateSessionId();
            
            // Initialize session
            await writeData(`sessions/${sessionId}`, {
                id: sessionId,
                quizData,
                players: {},
                currentQuestion: -1,
                gameState: 'waiting',
                createdAt: Date.now()
            });
            
            appState.sessionId = sessionId;
            appState.isAdmin = true;
            appState.quizData = quizData;
            
            setupAdminPanel();
            showScreen('admin-panel-screen');
            
        } catch (error) {
            showError('json-error', error.message);
        }
    });
}

function handlePlayerSetup() {
    document.getElementById('join-quiz-btn').addEventListener('click', async () => {
        const sessionCode = document.getElementById('session-code').value.trim().toUpperCase();
        const playerName = document.getElementById('player-name').value.trim();
        
        if (!sessionCode || !playerName) {
            alert('Please enter both session code and your name');
            return;
        }
        
        try {
            // Check if session exists
            const sessionData = await readData(`sessions/${sessionCode}`);
            if (!sessionData) {
                alert('Session not found. Please check the session code.');
                return;
            }
            
            // Add player to session
            const playerId = `${Date.now()}_${Math.random().toString(36).substring(2)}`;
            const playerData = {
                id: playerId,
                name: playerName,
                scores: {},
                totalScore: 0,
                answers: {},
                joinedAt: Date.now()
            };
            
            await writeData(`sessions/${sessionCode}/players/${playerId}`, playerData);
            
            appState.sessionId = sessionCode;
            appState.playerName = playerName;
            appState.isAdmin = false;
            
            setupWaitingRoom();
            showScreen('waiting-room-screen');
            
        } catch (error) {
            alert('Error joining session: ' + error.message);
        }
    });
}

function setupAdminPanel() {
    // Display session info
    document.getElementById('display-session-code').textContent = appState.sessionId;
    
    // Update quiz stats
    const sectionsCount = appState.quizData.sections.length;
    const questionsCount = appState.quizData.sections.reduce((total, section) => 
        total + section.questions.length, 0);
    
    document.getElementById('sections-count').textContent = sectionsCount;
    document.getElementById('questions-count').textContent = questionsCount;
    
    // Display quiz sections
    const sectionsContainer = document.getElementById('quiz-sections');
    sectionsContainer.innerHTML = '';
    appState.quizData.sections.forEach(section => {
        const sectionDiv = document.createElement('div');
        sectionDiv.className = 'section-item';
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
    document.getElementById('copy-code-btn').addEventListener('click', () => {
        navigator.clipboard.writeText(appState.sessionId).then(() => {
            const btn = document.getElementById('copy-code-btn');
            const originalIcon = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check"></i>';
            setTimeout(() => {
                btn.innerHTML = originalIcon;
            }, 2000);
        });
    });
    
    // Start game button
    document.getElementById('start-game-btn').addEventListener('click', async () => {
        if (Object.keys(appState.players).length === 0) {
            alert('At least one player must join before starting');
            return;
        }
        
        await writeData(`sessions/${appState.sessionId}/gameState`, 'playing');
        await writeData(`sessions/${appState.sessionId}/currentQuestion`, 0);
        await writeData(`sessions/${appState.sessionId}/startedAt`, Date.now());
        
        appState.currentQuestionIndex = 0;
        setupQuizGame();
        showScreen('quiz-game-screen');
    });
}

function updatePlayersDisplay(playersData) {
    const playersCount = Object.keys(playersData).length;
    document.getElementById('players-count').textContent = playersCount;
    
    const playersList = document.getElementById('players-list');
    playersList.innerHTML = '';
    
    if (playersCount === 0) {
        playersList.innerHTML = `
            <div class="no-players">
                <i class="fas fa-users"></i>
                <p>No players have joined yet</p>
                <p class="small-text">Share the session code: <strong>${appState.sessionId}</strong></p>
            </div>
        `;
    } else {
        Object.values(playersData).forEach(player => {
            const playerDiv = document.createElement('div');
            playerDiv.className = 'player-item';
            playerDiv.innerHTML = `
                <div class="player-name">${player.name}</div>
                <div class="player-joined">Joined ${new Date(player.joinedAt).toLocaleTimeString()}</div>
            `;
            playersList.appendChild(playerDiv);
        });
    }
    
    // Update start button state
    const startBtn = document.getElementById('start-game-btn');
    startBtn.disabled = playersCount === 0;
    startBtn.innerHTML = `
        <i class="fas fa-play"></i>
        Start Quiz (${playersCount} players)
    `;
}

function setupWaitingRoom() {
    document.getElementById('waiting-session-code').textContent = appState.sessionId;
    document.getElementById('player-name-display').textContent = appState.playerName;
    
    // Update connection status
    const connectionIcon = document.getElementById('connection-icon');
    const connectionText = document.getElementById('connection-text');
    connectionIcon.className = 'fas fa-wifi';
    connectionText.textContent = 'Connected';
    connectionIcon.parentElement.className = 'connection-status connected';
    
    // Listen for players count
    listenToData(`sessions/${appState.sessionId}/players`, (playersData) => {
        if (playersData) {
            const count = Object.keys(playersData).length;
            document.getElementById('connected-count').textContent = count;
        }
    });
    
    // Listen for game state changes
    listenToData(`sessions/${appState.sessionId}/gameState`, (gameState) => {
        if (gameState === 'playing') {
            readData(`sessions/${appState.sessionId}/quizData`).then(quizData => {
                appState.quizData = quizData;
                appState.currentQuestionIndex = 0;
                setupQuizGame();
                showScreen('quiz-game-screen');
            });
        }
    });
}

function setupQuizGame() {
    const allQuestions = getAllQuestions(appState.quizData);
    const totalQuestions = allQuestions.length;
    
    document.getElementById('total-questions').textContent = totalQuestions;
    
    if (!appState.isAdmin) {
        // Listen for question changes (for players)
        listenToData(`sessions/${appState.sessionId}/currentQuestion`, (questionIndex) => {
            if (questionIndex !== null && questionIndex >= 0) {
                appState.currentQuestionIndex = questionIndex;
                displayQuestion();
            } else if (questionIndex === -1) {
                // Quiz ended
                setupLeaderboard();
                showScreen('leaderboard-screen');
            }
        });
    }
    
    displayQuestion();
}

function displayQuestion() {
    const currentQuestion = getCurrentQuestion(appState.quizData, appState.currentQuestionIndex);
    if (!currentQuestion) {
        endQuiz();
        return;
    }
    
    // Update progress
    const totalQuestions = getAllQuestions(appState.quizData).length;
    const progressPercent = Math.round(((appState.currentQuestionIndex + 1) / totalQuestions) * 100);
    
    document.getElementById('current-question-num').textContent = appState.currentQuestionIndex + 1;
    document.getElementById('progress-percent').textContent = progressPercent;
    document.getElementById('progress-fill').style.width = progressPercent + '%';
    
    // Update section and question
    document.getElementById('current-section').textContent = currentQuestion.sectionName;
    document.getElementById('question-text').textContent = currentQuestion.question;
    
    // Reset answer state
    appState.selectedAnswer = null;
    appState.hasAnswered = false;
    document.getElementById('answer-submitted').classList.add('hidden');
    document.getElementById('submit-answer-btn').classList.remove('hidden');
    
    // Setup timer
    appState.timeLeft = currentQuestion.timeLimit || appState.quizData.defaultTimeLimit || 60;
    document.getElementById('time-left').textContent = appState.timeLeft;
    startTimer();
    
    // Display answer options
    displayAnswerOptions(currentQuestion);
}

function displayAnswerOptions(question) {
    const optionsContainer = document.getElementById('answer-options');
    optionsContainer.innerHTML = '';
    
    if (question.type === 'single' && question.options) {
        question.options.forEach((option, index) => {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'answer-option';
            optionDiv.innerHTML = `
                <div class="option-indicator"></div>
                <div class="option-text">${option}</div>
            `;
            optionDiv.addEventListener('click', () => selectSingleAnswer(index));
            optionsContainer.appendChild(optionDiv);
        });
    } else if (question.type === 'multiple' && question.options) {
        question.options.forEach((option, index) => {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'answer-option';
            optionDiv.innerHTML = `
                <div class="option-indicator square"></div>
                <div class="option-text">${option}</div>
            `;
            optionDiv.addEventListener('click', () => selectMultipleAnswer(index));
            optionsContainer.appendChild(optionDiv);
        });
    } else if (question.type === 'text') {
        const textArea = document.createElement('textarea');
        textArea.className = 'text-answer';
        textArea.placeholder = 'Type your answer here...';
        textArea.addEventListener('input', (e) => {
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
    document.querySelectorAll('.answer-option').forEach((option, i) => {
        const indicator = option.querySelector('.option-indicator');
        if (i === index) {
            option.classList.add('selected');
            indicator.classList.add('selected');
        } else {
            option.classList.remove('selected');
            indicator.classList.remove('selected');
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
    document.querySelectorAll('.answer-option').forEach((option, i) => {
        const indicator = option.querySelector('.option-indicator');
        if (currentAnswers.includes(i)) {
            option.classList.add('selected-multiple');
            indicator.classList.add('selected-multiple');
        } else {
            option.classList.remove('selected-multiple');
            indicator.classList.remove('selected-multiple');
        }
    });
    
    updateSubmitButton();
}

function updateSubmitButton() {
    const submitBtn = document.getElementById('submit-answer-btn');
    const hasValidAnswer = appState.selectedAnswer !== null && 
                          appState.selectedAnswer !== '' && 
                          (!Array.isArray(appState.selectedAnswer) || appState.selectedAnswer.length > 0);
    
    submitBtn.disabled = !hasValidAnswer || appState.hasAnswered;
}

function startTimer() {
    if (appState.timer) {
        clearInterval(appState.timer);
    }
    
    const updateTimer = () => {
        document.getElementById('time-left').textContent = appState.timeLeft;
        
        const currentQuestion = getCurrentQuestion(appState.quizData, appState.currentQuestionIndex);
        const totalTime = currentQuestion?.timeLimit || appState.quizData.defaultTimeLimit || 60;
        const timePercent = (appState.timeLeft / totalTime) * 100;
        
        const timeFill = document.getElementById('time-fill');
        const timerDisplay = document.querySelector('.timer-display');
        
        timeFill.style.width = timePercent + '%';
        
        if (appState.timeLeft <= 10) {
            timeFill.classList.add('warning');
            timerDisplay.classList.add('warning');
        } else {
            timeFill.classList.remove('warning');
            timerDisplay.classList.remove('warning');
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
    
    // Disable all options
    document.querySelectorAll('.answer-option').forEach(option => {
        option.classList.add('disabled');
    });
    
    const textAnswer = document.querySelector('.text-answer');
    if (textAnswer) {
        textAnswer.disabled = true;
    }
    
    // Show submitted state
    document.getElementById('submit-answer-btn').classList.add('hidden');
    document.getElementById('answer-submitted').classList.remove('hidden');
    
    // Save answer
    if (!appState.isAdmin) {
        const currentQuestion = getCurrentQuestion(appState.quizData, appState.currentQuestionIndex);
        const timeUsed = (currentQuestion?.timeLimit || 60) - appState.timeLeft - 1;
        
        writeData(`sessions/${appState.sessionId}/answers/${appState.playerName}/${appState.currentQuestionIndex}`, {
            answer: appState.selectedAnswer,
            timeUsed: timeUsed
        });
    }
    
    // Auto advance
    setTimeout(() => {
        if (appState.isAdmin) {
            nextQuestion();
        }
    }, appState.isAdmin ? 1000 : 3000);
}

function nextQuestion() {
    const totalQuestions = getAllQuestions(appState.quizData).length;
    
    if (appState.currentQuestionIndex + 1 >= totalQuestions) {
        endQuiz();
    } else {
        appState.currentQuestionIndex++;
        if (appState.isAdmin) {
            writeData(`sessions/${appState.sessionId}/currentQuestion`, appState.currentQuestionIndex);
        }
        displayQuestion();
    }
}

function endQuiz() {
    if (appState.isAdmin) {
        writeData(`sessions/${appState.sessionId}/gameState`, 'ended');
        writeData(`sessions/${appState.sessionId}/currentQuestion`, -1);
        writeData(`sessions/${appState.sessionId}/endedAt`, Date.now());
    }
    
    setupLeaderboard();
    showScreen('leaderboard-screen');
}

function setupLeaderboard() {
    // Show admin-only elements if admin
    if (appState.isAdmin) {
        document.querySelectorAll('.admin-only').forEach(el => {
            el.classList.add('show');
        });
    }
    
    // Setup section filters
    setupSectionFilters();
    
    // Listen for final scores
    listenToData(`sessions/${appState.sessionId}/players`, (playersData) => {
        if (playersData) {
            updateLeaderboard(playersData, 'overall');
        }
    });
    
    // Setup event listeners
    document.getElementById('toggle-detailed-btn').addEventListener('click', toggleDetailedView);
    document.getElementById('new-quiz-btn').addEventListener('click', () => {
        location.reload();
    });
}

function setupSectionFilters() {
    const filtersContainer = document.getElementById('section-filters');
    filtersContainer.innerHTML = '';
    
    // Overall button
    const overallBtn = document.createElement('button');
    overallBtn.className = 'btn btn-primary';
    overallBtn.textContent = 'Overall';
    overallBtn.addEventListener('click', () => {
        setActiveFilter(overallBtn);
        updateLeaderboard(appState.players, 'overall');
        document.getElementById('leaderboard-title').textContent = 'Overall Leaderboard';
    });
    filtersContainer.appendChild(overallBtn);
    
    // Section buttons
    if (appState.quizData) {
        appState.quizData.sections.forEach(section => {
            const sectionBtn = document.createElement('button');
            sectionBtn.className = 'btn btn-outline';
            sectionBtn.textContent = section.name;
            sectionBtn.addEventListener('click', () => {
                setActiveFilter(sectionBtn);
                updateLeaderboard(appState.players, section.name);
                document.getElementById('leaderboard-title').textContent = `${section.name} Leaderboard`;
            });
            filtersContainer.appendChild(sectionBtn);
        });
    }
}

function setActiveFilter(activeBtn) {
    document.querySelectorAll('#section-filters .btn').forEach(btn => {
        btn.className = 'btn btn-outline';
    });
    activeBtn.className = 'btn btn-primary';
}

function updateLeaderboard(playersData, section) {
    if (!playersData) return;
    
    const playersList = Object.values(playersData);
    
    // Sort players
    if (section === 'overall') {
        playersList.sort((a, b) => b.totalScore - a.totalScore);
    } else {
        playersList.sort((a, b) => (b.scores[section] || 0) - (a.scores[section] || 0));
    }
    
    const leaderboardList = document.getElementById('leaderboard-list');
    leaderboardList.innerHTML = '';
    
    if (playersList.length === 0) {
        leaderboardList.innerHTML = `
            <div class="no-players">
                <i class="fas fa-users"></i>
                <p>No results available yet</p>
            </div>
        `;
        return;
    }
    
    playersList.forEach((player, index) => {
        const position = index + 1;
        const score = section === 'overall' ? player.totalScore : (player.scores[section] || 0);
        
        const itemDiv = document.createElement('div');
        itemDiv.className = `leaderboard-item rank-${position <= 3 ? position : 'other'}`;
        
        const rankDisplay = position <= 3 
            ? `<i class="fas fa-${position === 1 ? 'trophy' : position === 2 ? 'medal' : 'award'} rank-icon"></i>`
            : `<span class="rank-number">#${position}</span>`;
        
        const sectionScores = section === 'overall' && document.getElementById('toggle-detailed-btn').textContent.includes('Simple')
            ? Object.entries(player.scores || {}).map(([sec, score]) => `${sec}: ${score}`).join(' | ')
            : '';
        
        itemDiv.innerHTML = `
            <div class="player-info">
                <div class="rank-display">${rankDisplay}</div>
                <div class="player-details">
                    <div class="player-name-large">${player.name}</div>
                    ${sectionScores ? `<div class="player-sections">${sectionScores}</div>` : ''}
                </div>
            </div>
            <div class="score-display">
                <div class="score-number">${score}</div>
                <div class="score-label">points</div>
            </div>
        `;
        
        leaderboardList.appendChild(itemDiv);
    });
    
    // Update section performance for admin
    if (appState.isAdmin && section === 'overall') {
        updateSectionPerformance(playersList);
    }
}

function updateSectionPerformance(playersList) {
    const sectionStats = document.getElementById('section-stats');
    sectionStats.innerHTML = '';
    
    if (appState.quizData) {
        appState.quizData.sections.forEach(section => {
            // Find top performer for this section
            const sectionLeaderboard = [...playersList].sort((a, b) => 
                (b.scores[section.name] || 0) - (a.scores[section.name] || 0)
            );
            const topPlayer = sectionLeaderboard[0];
            
            const statDiv = document.createElement('div');
            statDiv.className = 'section-stat';
            statDiv.innerHTML = `
                <h4>${section.name}</h4>
                <div><strong>Top Performer:</strong></div>
                <div>${topPlayer?.name || 'N/A'}</div>
                <div>${topPlayer?.scores[section.name] || 0} points</div>
            `;
            sectionStats.appendChild(statDiv);
        });
    }
}

function toggleDetailedView() {
    const btn = document.getElementById('toggle-detailed-btn');
    const isDetailed = btn.textContent.includes('Simple');
    
    btn.innerHTML = isDetailed 
        ? '<i class="fas fa-filter"></i> Detailed View'
        : '<i class="fas fa-filter"></i> Simple View';
    
    // Re-render leaderboard with current section
    const currentSection = document.querySelector('#section-filters .btn-primary').textContent.toLowerCase();
    updateLeaderboard(appState.players, currentSection === 'overall' ? 'overall' : currentSection);
}

// Initialize the application
function initApp() {
    console.log('Initializing app...');
    
    // Setup initial event listeners
    handleSetupChoice();
    handleAdminSetup();
    handlePlayerSetup();
    
    // Setup submit answer button
    const submitBtn = document.getElementById('submit-answer-btn');
    if (submitBtn) {
        submitBtn.addEventListener('click', submitAnswer);
    }
    
    console.log('Quiz app initialized');
}

// Start the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing app...');
    initApp();
});

// Cleanup listeners when page unloads
window.addEventListener('beforeunload', () => {
    appState.listeners.forEach(cleanup => cleanup());
    if (appState.timer) {
        clearInterval(appState.timer);
    }
});

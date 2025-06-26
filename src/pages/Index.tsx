
import React, { useState, useEffect } from 'react';
import AdminPanel from '../components/AdminPanel';
import PlayerPanel from '../components/PlayerPanel';
import WaitingRoom from '../components/WaitingRoom';
import QuizGame from '../components/QuizGame';
import Leaderboard from '../components/Leaderboard';
import { initializeFirebase } from '../utils/firebase';
import { QuizData, GameState, Player } from '../types/quiz';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Trophy, Users, BookOpen } from 'lucide-react';

const Index = () => {
  const [gameState, setGameState] = useState<GameState>('setup');
  const [isAdmin, setIsAdmin] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [playerName, setPlayerName] = useState<string>('');
  const [quizData, setQuizData] = useState<QuizData | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  useEffect(() => {
    initializeFirebase();
  }, []);

  const handleSetupComplete = (data: { sessionId: string; isAdmin: boolean; quizData?: QuizData; playerName?: string }) => {
    setSessionId(data.sessionId);
    setIsAdmin(data.isAdmin);
    if (data.quizData) setQuizData(data.quizData);
    if (data.playerName) setPlayerName(data.playerName);
    setGameState(data.isAdmin ? 'admin' : 'waiting');
  };

  const handleGameStart = () => {
    setGameState('playing');
    setCurrentQuestionIndex(0);
  };

  const handleGameEnd = () => {
    setGameState('results');
  };

  const renderContent = () => {
    switch (gameState) {
      case 'setup':
        return <SetupScreen onSetupComplete={handleSetupComplete} />;
      case 'admin':
        return (
          <AdminPanel
            sessionId={sessionId}
            players={players}
            onGameStart={handleGameStart}
            quizData={quizData}
          />
        );
      case 'waiting':
        return <WaitingRoom sessionId={sessionId} playerName={playerName} />;
      case 'playing':
        return (
          <QuizGame
            sessionId={sessionId}
            playerName={playerName}
            isAdmin={isAdmin}
            quizData={quizData}
            currentQuestionIndex={currentQuestionIndex}
            onGameEnd={handleGameEnd}
            onNextQuestion={() => setCurrentQuestionIndex(prev => prev + 1)}
          />
        );
      case 'results':
        return (
          <Leaderboard
            sessionId={sessionId}
            isAdmin={isAdmin}
            quizData={quizData}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-3 rounded-xl">
              <BookOpen className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Web Training Quiz
            </h1>
          </div>
          <p className="text-gray-600 text-lg">Test your HTML, CSS, and JavaScript knowledge!</p>
        </header>
        
        {renderContent()}
      </div>
    </div>
  );
};

const SetupScreen = ({ onSetupComplete }: { onSetupComplete: (data: any) => void }) => {
  const [mode, setMode] = useState<'admin' | 'player' | null>(null);

  if (!mode) {
    return (
      <div className="max-w-md mx-auto">
        <Card className="p-8 text-center bg-white/80 backdrop-blur-sm border-0 shadow-xl">
          <h2 className="text-2xl font-bold mb-6 text-gray-800">Choose Your Role</h2>
          <div className="space-y-4">
            <Button
              onClick={() => setMode('admin')}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-4 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all"
            >
              <Users className="h-5 w-5 mr-2" />
              I'm the Instructor (Admin)
            </Button>
            <Button
              onClick={() => setMode('player')}
              className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white py-4 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all"
            >
              <Trophy className="h-5 w-5 mr-2" />
              I'm a Student (Player)
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return mode === 'admin' ? (
    <AdminSetup onSetupComplete={onSetupComplete} />
  ) : (
    <PlayerSetup onSetupComplete={onSetupComplete} />
  );
};

const AdminSetup = ({ onSetupComplete }: { onSetupComplete: (data: any) => void }) => {
  const [jsonInput, setJsonInput] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    try {
      const quizData = JSON.parse(jsonInput);
      // Validate quiz data structure
      if (!quizData.sections || !Array.isArray(quizData.sections)) {
        throw new Error('Quiz data must have a sections array');
      }
      
      const sessionId = Math.random().toString(36).substring(2, 8).toUpperCase();
      onSetupComplete({
        sessionId,
        isAdmin: true,
        quizData,
      });
    } catch (err) {
      setError('Invalid JSON format. Please check your quiz data.');
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="p-8 bg-white/80 backdrop-blur-sm border-0 shadow-xl">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Admin Setup</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700">
              Paste your quiz JSON data:
            </label>
            <textarea
              value={jsonInput}
              onChange={(e) => {
                setJsonInput(e.target.value);
                setError('');
              }}
              placeholder={`{
  "sections": [
    {
      "name": "HTML",
      "questions": [
        {
          "question": "What does HTML stand for?",
          "type": "single",
          "options": ["HyperText Markup Language", "Home Tool Markup Language"],
          "correct": 0,
          "timeLimit": 30
        }
      ]
    }
  ]
}`}
              className="w-full h-64 p-4 border rounded-xl resize-none font-mono text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
          {error && (
            <p className="text-red-600 text-sm">{error}</p>
          )}
          <Button
            onClick={handleSubmit}
            disabled={!jsonInput.trim()}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-3 font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all"
          >
            Create Quiz Session
          </Button>
        </div>
      </Card>
    </div>
  );
};

const PlayerSetup = ({ onSetupComplete }: { onSetupComplete: (data: any) => void }) => {
  const [sessionId, setSessionId] = useState('');
  const [playerName, setPlayerName] = useState('');

  const handleSubmit = () => {
    if (sessionId.trim() && playerName.trim()) {
      onSetupComplete({
        sessionId: sessionId.toUpperCase(),
        isAdmin: false,
        playerName: playerName.trim(),
      });
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <Card className="p-8 bg-white/80 backdrop-blur-sm border-0 shadow-xl">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Join Quiz</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700">
              Session Code:
            </label>
            <input
              type="text"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value.toUpperCase())}
              placeholder="Enter session code"
              className="w-full p-3 border rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-center text-lg font-mono"
              maxLength={6}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700">
              Your Name:
            </label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter your name"
              className="w-full p-3 border rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
            />
          </div>
          <Button
            onClick={handleSubmit}
            disabled={!sessionId.trim() || !playerName.trim()}
            className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white py-3 font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all"
          >
            Join Quiz
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default Index;

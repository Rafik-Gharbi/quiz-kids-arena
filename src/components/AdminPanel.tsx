
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Play, Eye, Copy, Check } from 'lucide-react';
import { QuizData, Player } from '../types/quiz';
import { listenToData, writeData } from '../utils/firebase';

interface AdminPanelProps {
  sessionId: string;
  players: Player[];
  onGameStart: () => void;
  quizData: QuizData | null;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ sessionId, players, onGameStart, quizData }) => {
  const [connectedPlayers, setConnectedPlayers] = useState<Player[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Initialize session in database
    if (quizData) {
      writeData(`sessions/${sessionId}`, {
        id: sessionId,
        quizData,
        players: {},
        currentQuestion: -1,
        gameState: 'waiting',
        createdAt: Date.now(),
      });
    }

    // Listen for players joining
    listenToData(`sessions/${sessionId}/players`, (playersData) => {
      if (playersData) {
        const playersList = Object.values(playersData) as Player[];
        setConnectedPlayers(playersList);
      }
    });
  }, [sessionId, quizData]);

  const handleStartGame = () => {
    writeData(`sessions/${sessionId}/gameState`, 'playing');
    writeData(`sessions/${sessionId}/currentQuestion`, 0);
    writeData(`sessions/${sessionId}/startedAt`, Date.now());
    onGameStart();
  };

  const copySessionId = () => {
    navigator.clipboard.writeText(sessionId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const totalQuestions = quizData?.sections.reduce((total, section) => total + section.questions.length, 0) || 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Session Info */}
      <Card className="p-6 bg-white/80 backdrop-blur-sm border-0 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Admin Panel</h2>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">Session Code:</span>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-mono font-bold text-blue-600 bg-blue-50 px-4 py-2 rounded-lg">
                {sessionId}
              </span>
              <Button
                onClick={copySessionId}
                variant="outline"
                size="sm"
                className="h-10 w-10 p-0"
              >
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Quiz Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-xl">
            <div className="text-2xl font-bold text-blue-600">{quizData?.sections.length || 0}</div>
            <div className="text-sm text-blue-700">Sections</div>
          </div>
          <div className="bg-green-50 p-4 rounded-xl">
            <div className="text-2xl font-bold text-green-600">{totalQuestions}</div>
            <div className="text-sm text-green-700">Questions</div>
          </div>
          <div className="bg-purple-50 p-4 rounded-xl">
            <div className="text-2xl font-bold text-purple-600">{connectedPlayers.length}</div>
            <div className="text-sm text-purple-700">Players</div>
          </div>
        </div>

        {/* Quiz Sections */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3 text-gray-800">Quiz Sections</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {quizData?.sections.map((section, index) => (
              <div key={index} className="bg-gray-50 p-3 rounded-lg">
                <div className="font-medium text-gray-800">{section.name}</div>
                <div className="text-sm text-gray-600">{section.questions.length} questions</div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Connected Players */}
      <Card className="p-6 bg-white/80 backdrop-blur-sm border-0 shadow-xl">
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-5 w-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-800">Connected Players ({connectedPlayers.length})</h3>
        </div>
        
        {connectedPlayers.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No players have joined yet</p>
            <p className="text-sm">Share the session code: <span className="font-mono font-bold">{sessionId}</span></p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {connectedPlayers.map((player) => (
              <div key={player.id} className="bg-green-50 p-4 rounded-lg border border-green-200">
                <div className="font-medium text-green-800">{player.name}</div>
                <div className="text-sm text-green-600">
                  Joined {new Date(player.joinedAt).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Start Game */}
      <Card className="p-6 bg-white/80 backdrop-blur-sm border-0 shadow-xl">
        <div className="text-center">
          <Button
            onClick={handleStartGame}
            disabled={connectedPlayers.length === 0}
            className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white px-8 py-4 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play className="h-5 w-5 mr-2" />
            Start Quiz ({connectedPlayers.length} players)
          </Button>
          {connectedPlayers.length === 0 && (
            <p className="text-sm text-gray-500 mt-2">
              At least one player must join before starting
            </p>
          )}
        </div>
      </Card>
    </div>
  );
};

export default AdminPanel;

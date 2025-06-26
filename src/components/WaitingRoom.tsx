
import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Clock, Users, Wifi } from 'lucide-react';
import { listenToData, writeData } from '../utils/firebase';

interface WaitingRoomProps {
  sessionId: string;
  playerName: string;
}

const WaitingRoom: React.FC<WaitingRoomProps> = ({ sessionId, playerName }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [playersCount, setPlayersCount] = useState(0);

  useEffect(() => {
    // Add player to session
    const playerId = `${Date.now()}_${Math.random().toString(36).substring(2)}`;
    const playerData = {
      id: playerId,
      name: playerName,
      scores: {},
      totalScore: 0,
      answers: {},
      joinedAt: Date.now(),
    };

    writeData(`sessions/${sessionId}/players/${playerId}`, playerData)
      .then(() => setIsConnected(true))
      .catch(() => setIsConnected(false));

    // Listen for players count
    listenToData(`sessions/${sessionId}/players`, (playersData) => {
      if (playersData) {
        setPlayersCount(Object.keys(playersData).length);
      }
    });

    // Listen for game state changes
    listenToData(`sessions/${sessionId}/gameState`, (gameState) => {
      if (gameState === 'playing') {
        window.location.reload(); // Simple way to trigger game start
      }
    });
  }, [sessionId, playerName]);

  return (
    <div className="max-w-md mx-auto">
      <Card className="p-8 text-center bg-white/80 backdrop-blur-sm border-0 shadow-xl">
        <div className="mb-6">
          <div className="bg-gradient-to-r from-blue-500 to-purple-500 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="h-8 w-8 text-white animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Waiting Room</h2>
          <p className="text-gray-600">Get ready for the quiz!</p>
        </div>

        <div className="space-y-6">
          <div className="bg-blue-50 p-4 rounded-xl">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Wifi className={`h-5 w-5 ${isConnected ? 'text-green-600' : 'text-red-600'}`} />
              <span className="text-sm font-medium">
                {isConnected ? 'Connected' : 'Connecting...'}
              </span>
            </div>
            <div className="text-lg font-bold text-blue-600">Session: {sessionId}</div>
          </div>

          <div className="bg-green-50 p-4 rounded-xl">
            <div className="text-2xl font-bold text-green-600 mb-1">Welcome!</div>
            <div className="text-green-700 font-medium">{playerName}</div>
          </div>

          <div className="bg-purple-50 p-4 rounded-xl">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Users className="h-5 w-5 text-purple-600" />
              <span className="text-sm font-medium text-purple-700">Players Connected</span>
            </div>
            <div className="text-2xl font-bold text-purple-600">{playersCount}</div>
          </div>

          <div className="bg-yellow-50 p-4 rounded-xl">
            <div className="text-yellow-700 text-sm">
              <div className="font-medium mb-1">⏳ Waiting for instructor to start the quiz</div>
              <div>Make sure you're ready to answer questions!</div>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="flex justify-center">
            <div className="animate-bounce">🎯</div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            The quiz will start automatically when the instructor begins
          </p>
        </div>
      </Card>
    </div>
  );
};

export default WaitingRoom;

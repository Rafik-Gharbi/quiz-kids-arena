
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy, Medal, Award, Users, Filter, RotateCcw } from 'lucide-react';
import { QuizData, Player } from '../types/quiz';
import { listenToData } from '../utils/firebase';

interface LeaderboardProps {
  sessionId: string;
  isAdmin: boolean;
  quizData: QuizData | null;
}

const Leaderboard: React.FC<LeaderboardProps> = ({ sessionId, isAdmin, quizData }) => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedSection, setSelectedSection] = useState<string>('overall');
  const [showDetailed, setShowDetailed] = useState(false);

  useEffect(() => {
    // Listen for final scores
    listenToData(`sessions/${sessionId}/players`, (playersData) => {
      if (playersData) {
        const playersList = Object.values(playersData) as Player[];
        // Sort by total score
        playersList.sort((a, b) => b.totalScore - a.totalScore);
        setPlayers(playersList);
      }
    });
  }, [sessionId]);

  const getRankIcon = (position: number) => {
    switch (position) {
      case 1:
        return <Trophy className="h-6 w-6 text-yellow-500" />;
      case 2:
        return <Medal className="h-6 w-6 text-gray-400" />;
      case 3:
        return <Award className="h-6 w-6 text-amber-600" />;
      default:
        return <span className="text-lg font-bold text-gray-600">#{position}</span>;
    }
  };

  const getRankColor = (position: number) => {
    switch (position) {
      case 1:
        return 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-white';
      case 2:
        return 'bg-gradient-to-r from-gray-300 to-gray-400 text-white';
      case 3:
        return 'bg-gradient-to-r from-amber-400 to-amber-500 text-white';
      default:
        return 'bg-white border border-gray-200';
    }
  };

  const getSectionLeaderboard = (sectionName: string) => {
    return [...players].sort((a, b) => (b.scores[sectionName] || 0) - (a.scores[sectionName] || 0));
  };

  const restartQuiz = () => {
    window.location.reload();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <Card className="p-6 bg-white/80 backdrop-blur-sm border-0 shadow-xl text-center">
        <div className="mb-4">
          <div className="bg-gradient-to-r from-yellow-400 to-yellow-500 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Trophy className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-gray-800 mb-2">Quiz Complete!</h2>
          <p className="text-gray-600">Here are the final results</p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap justify-center gap-4 mb-6">
          <div className="flex gap-2">
            <Button
              onClick={() => setSelectedSection('overall')}
              variant={selectedSection === 'overall' ? 'default' : 'outline'}
              size="sm"
            >
              Overall
            </Button>
            {quizData?.sections.map((section) => (
              <Button
                key={section.name}
                onClick={() => setSelectedSection(section.name)}
                variant={selectedSection === section.name ? 'default' : 'outline'}
                size="sm"
              >
                {section.name}
              </Button>
            ))}
          </div>
          
          <Button
            onClick={() => setShowDetailed(!showDetailed)}
            variant="outline"
            size="sm"
          >
            <Filter className="h-4 w-4 mr-1" />
            {showDetailed ? 'Simple View' : 'Detailed View'}
          </Button>

          {isAdmin && (
            <Button
              onClick={restartQuiz}
              variant="outline"
              size="sm"
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              New Quiz
            </Button>
          )}
        </div>
      </Card>

      {/* Leaderboard */}
      <Card className="p-6 bg-white/80 backdrop-blur-sm border-0 shadow-xl">
        <div className="flex items-center gap-2 mb-6">
          <Users className="h-5 w-5 text-gray-600" />
          <h3 className="text-xl font-semibold text-gray-800">
            {selectedSection === 'overall' ? 'Overall Leaderboard' : `${selectedSection} Leaderboard`}
          </h3>
        </div>

        <div className="space-y-3">
          {(selectedSection === 'overall' ? players : getSectionLeaderboard(selectedSection)).map((player, index) => {
            const position = index + 1;
            const score = selectedSection === 'overall' ? player.totalScore : (player.scores[selectedSection] || 0);
            
            return (
              <div
                key={player.id}
                className={`p-4 rounded-xl ${getRankColor(position)} ${position <= 3 ? 'shadow-lg' : 'shadow-sm'} transition-all hover:shadow-md`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-12 h-12">
                      {getRankIcon(position)}
                    </div>
                    <div>
                      <div className={`font-bold text-lg ${position <= 3 ? 'text-white' : 'text-gray-800'}`}>
                        {player.name}
                      </div>
                      {showDetailed && selectedSection === 'overall' && (
                        <div className={`text-sm ${position <= 3 ? 'text-white/80' : 'text-gray-600'}`}>
                          {Object.entries(player.scores).map(([section, sectionScore]) => (
                            <span key={section} className="mr-3">
                              {section}: {sectionScore}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className={`text-right ${position <= 3 ? 'text-white' : 'text-gray-800'}`}>
                    <div className="text-2xl font-bold">{score}</div>
                    <div className={`text-sm ${position <= 3 ? 'text-white/80' : 'text-gray-600'}`}>
                      points
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {players.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No results available yet</p>
          </div>
        )}
      </Card>

      {/* Section Breakdown (Admin only) */}
      {isAdmin && showDetailed && (
        <Card className="p-6 bg-white/80 backdrop-blur-sm border-0 shadow-xl">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">Section Performance</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {quizData?.sections.map((section) => {
              const sectionLeaderboard = getSectionLeaderboard(section.name);
              const topPlayer = sectionLeaderboard[0];
              
              return (
                <div key={section.name} className="bg-blue-50 p-4 rounded-xl">
                  <h4 className="font-bold text-blue-800 mb-2">{section.name}</h4>
                  <div className="text-sm text-blue-700">
                    <div className="font-semibold">Top Performer:</div>
                    <div>{topPlayer?.name || 'N/A'}</div>
                    <div>{topPlayer?.scores[section.name] || 0} points</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
};

export default Leaderboard;

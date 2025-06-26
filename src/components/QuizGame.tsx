
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Clock, CheckCircle, Users } from 'lucide-react';
import { QuizData, Question } from '../types/quiz';
import { listenToData, writeData } from '../utils/firebase';

interface QuizGameProps {
  sessionId: string;
  playerName: string;
  isAdmin: boolean;
  quizData: QuizData | null;
  currentQuestionIndex: number;
  onGameEnd: () => void;
  onNextQuestion: () => void;
}

const QuizGame: React.FC<QuizGameProps> = ({
  sessionId,
  playerName,
  isAdmin,
  quizData,
  currentQuestionIndex,
  onGameEnd,
  onNextQuestion,
}) => {
  const [timeLeft, setTimeLeft] = useState(60);
  const [selectedAnswer, setSelectedAnswer] = useState<any>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [currentSection, setCurrentSection] = useState<string>('');
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);

  useEffect(() => {
    if (!quizData) return;

    // Calculate total questions and find current question
    let totalQ = 0;
    let currentQ: Question | null = null;
    let currentSec = '';
    let questionIndex = 0;

    for (const section of quizData.sections) {
      for (const question of section.questions) {
        if (questionIndex === currentQuestionIndex) {
          currentQ = question;
          currentSec = section.name;
        }
        totalQ++;
        questionIndex++;
      }
    }

    setTotalQuestions(totalQ);
    setCurrentQuestion(currentQ);
    setCurrentSection(currentSec);
    setSelectedAnswer(null);
    setHasAnswered(false);
    setTimeLeft(currentQ?.timeLimit || quizData.defaultTimeLimit || 60);
  }, [currentQuestionIndex, quizData]);

  useEffect(() => {
    if (timeLeft > 0 && !hasAnswered) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && !hasAnswered) {
      handleSubmitAnswer();
    }
  }, [timeLeft, hasAnswered]);

  const handleSubmitAnswer = () => {
    if (hasAnswered) return;

    setHasAnswered(true);
    setAnsweredCount(prev => prev + 1);

    // Save answer to database
    const playerId = `${playerName}_${Date.now()}`;
    writeData(`sessions/${sessionId}/answers/${playerId}/${currentQuestionIndex}`, {
      answer: selectedAnswer,
      timeUsed: (currentQuestion?.timeLimit || 60) - timeLeft,
    });

    // Auto-advance after 3 seconds or if admin
    setTimeout(() => {
      if (currentQuestionIndex + 1 >= totalQuestions) {
        onGameEnd();
      } else {
        onNextQuestion();
      }
    }, isAdmin ? 1000 : 3000);
  };

  if (!currentQuestion) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="p-8 text-center bg-white/80 backdrop-blur-sm border-0 shadow-xl">
          <div className="text-xl font-semibold text-gray-800">Loading question...</div>
        </Card>
      </div>
    );
  }

  const progressPercentage = ((currentQuestionIndex + 1) / totalQuestions) * 100;
  const timePercentage = (timeLeft / (currentQuestion.timeLimit || 60)) * 100;

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="p-8 bg-white/80 backdrop-blur-sm border-0 shadow-xl">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-blue-100 px-3 py-1 rounded-full">
              <span className="text-sm font-medium text-blue-700">{currentSection}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <Clock className="h-4 w-4" />
              <span className="font-mono font-bold text-lg">{timeLeft}s</span>
            </div>
          </div>

          <div className="mb-2">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Question {currentQuestionIndex + 1} of {totalQuestions}</span>
              <span>{Math.round(progressPercentage)}% Complete</span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>

          <div className="mb-4">
            <Progress 
              value={timePercentage} 
              className={`h-1 ${timeLeft <= 10 ? 'bg-red-100' : 'bg-blue-100'}`}
            />
          </div>
        </div>

        {/* Question */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-800 mb-6 leading-relaxed">
            {currentQuestion.question}
          </h2>

          {/* Answer Options */}
          <div className="space-y-3">
            {currentQuestion.type === 'single' && currentQuestion.options && (
              currentQuestion.options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => !hasAnswered && setSelectedAnswer(index)}
                  disabled={hasAnswered}
                  className={`w-full p-4 text-left rounded-xl border-2 transition-all ${
                    selectedAnswer === index
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                  } ${hasAnswered ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      selectedAnswer === index ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                    }`}>
                      {selectedAnswer === index && <div className="w-2 h-2 bg-white rounded-full"></div>}
                    </div>
                    <span className="font-medium">{option}</span>
                  </div>
                </button>
              ))
            )}

            {currentQuestion.type === 'multiple' && currentQuestion.options && (
              currentQuestion.options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => {
                    if (hasAnswered) return;
                    const currentAnswers = selectedAnswer || [];
                    if (currentAnswers.includes(index)) {
                      setSelectedAnswer(currentAnswers.filter((i: number) => i !== index));
                    } else {
                      setSelectedAnswer([...currentAnswers, index]);
                    }
                  }}
                  disabled={hasAnswered}
                  className={`w-full p-4 text-left rounded-xl border-2 transition-all ${
                    selectedAnswer && selectedAnswer.includes(index)
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                  } ${hasAnswered ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                      selectedAnswer && selectedAnswer.includes(index) ? 'border-green-500 bg-green-500' : 'border-gray-300'
                    }`}>
                      {selectedAnswer && selectedAnswer.includes(index) && (
                        <CheckCircle className="w-4 h-4 text-white" />
                      )}
                    </div>
                    <span className="font-medium">{option}</span>
                  </div>
                </button>
              ))
            )}

            {currentQuestion.type === 'text' && (
              <textarea
                value={selectedAnswer || ''}
                onChange={(e) => !hasAnswered && setSelectedAnswer(e.target.value)}
                disabled={hasAnswered}
                placeholder="Type your answer here..."
                className="w-full p-4 border-2 border-gray-200 rounded-xl resize-none h-32 focus:border-blue-500 focus:outline-none disabled:opacity-75 disabled:cursor-not-allowed"
              />
            )}
          </div>
        </div>

        {/* Submit Button */}
        <div className="text-center">
          {!hasAnswered ? (
            <Button
              onClick={handleSubmitAnswer}
              disabled={selectedAnswer === null || selectedAnswer === '' || (Array.isArray(selectedAnswer) && selectedAnswer.length === 0)}
              className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white px-8 py-3 font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
            >
              Submit Answer
            </Button>
          ) : (
            <div className="text-green-600 font-semibold flex items-center justify-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Answer Submitted!
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default QuizGame;

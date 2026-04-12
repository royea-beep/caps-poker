# 🎉 Quizly - AI-Powered Quiz Game 

Welcome to **Quizly**, the ultimate AI-powered quiz platform! 🧠 Challenge your friends, test your knowledge, and have fun with real-time gameplay and AI-generated explanations. Whether you're here to learn, compete, or just enjoy a good quiz, Quizly has you covered! 💡✨

## 🌟 Features

- 🤖 **AI-Generated Questions**: Sit back and let the AI whip up questions tailored to your skill level.
- ⚡ **Real-Time Gameplay**: Play live with your friends using smooth WebSocket updates.
- 📊 **Score Tracker**: See how you're doing with live tracking of correct and incorrect answers.
- ⏱️ **Dynamic Timer**: Race against the clock to keep things exciting!
- 💬 **AI Explanations**: Learn something new with detailed AI-generated explanations when you miss a question.
- 📱 **Responsive Design**: Looks amazing on your phone, tablet, or computer. Play anywhere, anytime!

## 🚀 Getting Started

### 🛠️ Setup (The Easy Way)

1. **Clone the Repo** 🧑‍💻  
   Get the code onto your machine:  
   ```bash
   git clone https://github.com/liamstamper/quizly.git
   cd quizly

2. **Add .env files** ⚙️  
   Check out ``frontend/.env.example`` and ``backend/.env.example``

4. **Run with Docker** 🐳  
   Let Docker do all the heavy lifting for you:
      ```bash
      docker compose build
      ```
      ```bash
      docker compose up
      ```

6. **🎉 You're Ready to Play!**
   
    Open your browser and head over to:
   
    **Frontend:** ```http://localhost:5173```
   
    **Backend:** ```http://localhost:8000/docs``` (for API)

## 🔗 Tech Stack

### 🌐 Frontend 
- React
- TypeScript
- Tailwind CSS
- WebSockets

### 🛠 Backend 
- FastAPI
- Python
- Redis
  
## 🙌 Acknowledgments
Quizly was built by Liam Stamper and Allen Wolf [(GitHub:aaw3)](https://github.com/aaw3) during the Iowa State University Hackathon. 🎉
Thank you to everyone at Iowa State for hosting the event.
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { GameProvider } from "./components/GameContext"; 
import Home from "./pages/Home";
import JoinGame from "./pages/JoinGame";
import CreateGame from "./pages/CreateGame";
import GamePlay from "./pages/GamePlay";
import ProtectedRoute from "./components/ProtectedRoute";
import GameNotFound from "./pages/GameNotFound";
import About from "./pages/About";

export default function App() {
  return (
    <GameProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/joingame" element={<JoinGame />} />
          <Route path="/creategame" element={<CreateGame />} />
          <Route
            path="/gameplay"
            element={
              <ProtectedRoute>
                <GamePlay />
              </ProtectedRoute>
            }
          />
          <Route path="/gamenotfound" element={<GameNotFound />} />
          <Route path="/about" element={<About />} />
        </Routes>
      </Router>
    </GameProvider>
  );
}
import React, { useState, useRef, useEffect } from "react";

interface ContextMenuProps {
  onLogout: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ onLogout }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const toggleMenu = () => setIsOpen((prev) => !prev);

  // Close the menu if clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="relative inline-block z-10" ref={menuRef}>
      {/* Icon */}
      <div
        className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center cursor-pointer hover:shadow-lg"
        onClick={toggleMenu}
      >
        <span className="text-gray-800">LS</span>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg">
          <ul className="py-2">
            <li className="px-4 py-2 text-gray-700 hover:bg-gray-100 cursor-pointer">
              Profile
            </li>
            <li className="px-4 py-2 text-gray-700 hover:bg-gray-100 cursor-pointer">
              Settings
            </li>
            <li
              className="px-4 py-2 text-red-500 hover:bg-red-100 cursor-pointer"
              onClick={onLogout}
            >
              Logout
            </li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default ContextMenu;
import React, { createContext, useContext, useState } from "react";

interface GameContextType {
  gameCode: string | null;
  playerName: string | null;
  isGameActive: boolean;
  setGameCode: (code: string | null) => void;
  setPlayerName: (name: string | null) => void;
  setIsGameActive: (active: boolean) => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [gameCode, setGameCode] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState<string | null>(null);
  const [isGameActive, setIsGameActive] = useState(false);

  return (
    <GameContext.Provider
      value={{ gameCode, playerName, isGameActive, setGameCode, setPlayerName, setIsGameActive }}
    >
      {children}
    </GameContext.Provider>
  );
};

export const useGameContext = (): GameContextType => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error("useGameContext must be used within a GameProvider");
  }
  return context;
};
import React from "react";
import { useLocation } from "react-router-dom";
import { Link } from "react-router-dom";
import { FaUser } from "react-icons/fa";
import ContextMenu from "./ContextMenu";

const Header: React.FC = () => {
  const location = useLocation();
  const handleLogout = () => {
    console.log("User logged out");
  };
  return (
    <header className="bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-md">
      <div className="container mx-auto flex justify-between items-center py-3 px-6 lg:px-10">
        {/* Logo and Conditional Badge */}
        <div className="flex items-center space-x-4">
          <Link
            to="/"
            className="text-3xl font-extrabold tracking-wide hover:opacity-90 transition duration-200"
          >
            Quizly
          </Link>
          {location.pathname === "/creategame" && (
            <div className="text-xs font-semibold bg-white text-blue-600 px-3 py-1 rounded-lg shadow-sm">
              TEACHER
            </div>
          )}
        </div>

        {/* Navigation Links */}
        <div className="hidden sm:flex items-center space-x-6">
          <Link
            to="/about"
            className="text-base hover:underline underline-offset-4 transition duration-200"
          >
            About
          </Link>
          <Link
            to="/"
            className="text-base hover:underline underline-offset-4 transition duration-200"
          >
            My Games
          </Link>
          <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
            <span className="text-sm font-medium text-gray-700">
              <FaUser size={20} className="text-grey-500" />
            </span>
          </div>
        </div>

        {/* Mobile Menu Icon */}
        <div className="sm:hidden">
          <ContextMenu onLogout={handleLogout} />
        </div>
      </div>
    </header>
  );
};

export default Header;
import { Link } from "react-router-dom";

const Hero = () => {
  return (
    <section className="relative bg-gradient-to-b from-blue-50 via-gray-100 to-gray-50">
      <div className="container mx-auto flex flex-col items-center px-4 text-center md:py-20 md:px-10 lg:px-32 xl:max-w-4xl">
        {/* Headline */}
        <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl text-gray-800">
          Quiz and Compete with{" "}
          <span className="text-violet-600">AI-Powered Learning</span>.
        </h1>

        {/* Subheading */}
        <p className="px-6 mt-6 mb-8 text-lg text-gray-700 sm:px-12 lg:px-20">
          Challenge your friends, master new topics, and level up your skills
          with <span className="text-violet-600">AI-driven quizzes</span> that
          adapt to you.
        </p>

        {/* Buttons */}
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            to="/joingame"
            className="px-8 py-3 text-lg font-medium rounded-lg bg-violet-600 text-white shadow-lg hover:bg-violet-700 transition duration-200"
          >
            Join Game
          </Link>
          <Link
            to="/creategame"
            className="px-8 py-3 text-lg font-medium rounded-lg bg-blue-500 text-white shadow-lg hover:bg-blue-600 transition duration-200"
          >
            Create Game
          </Link>
        </div>
      </div>

      {/* Decorative Background */}
      <div className="absolute inset-0 pointer-events-none lg:block hidden">
        <svg
          className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-10 w-full"
          width="1440"
          height="320"
          viewBox="0 0 1440 320"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M0,288L80,272C160,256,320,224,480,224C640,224,800,256,960,256C1120,256,1280,224,1360,208L1440,192L1440,320L1360,320C1280,320,1120,320,960,320C800,320,640,320,480,320C320,320,160,320,80,320L0,320Z"
            fill="#e5e7eb"
          />
        </svg>
      </div>
    </section>
  );
};

export default Hero;
import { useState, useEffect } from "react";
import Header from "../components/Header";
import { IoCopy } from "react-icons/io5";
import QuizPromptInput from "../components/QuizPromptInput";

interface PlayerMetric {
  score: number;
  avg_score: number;
  correct_questions: number[];
  incorrect_questions: number[];
  remaining_questions: number[];
  github_avatar?: string;
}

interface GameMetrics {
  game_data: {
    code: string;
    start_time: number | null;
  };
  player_metrics: Record<string, PlayerMetric>;
}

const CreateGame = () => {
  const [gameCode, setGameCode] = useState<string | null>(null);
  const [error, setError] = useState<boolean>(false);
  const [players, setPlayers] = useState<string[]>([]);
  const [metrics, setMetrics] = useState<GameMetrics | null>(null);
  const [copied, setCopied] = useState(false);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [gameStarted, setGameStarted] = useState<boolean>(false);
  const [gamePaused, setGamePaused] = useState<boolean>(false);
  const [gameEnded, setGameEnded] = useState<boolean>(false);
  const [quizMade, setQuizMade] = useState<boolean>(false);

  const copyToClipboard = () => {
    if (gameCode) {
      navigator.clipboard.writeText(gameCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1000); // Reset after 1 second
    }
  };

  useEffect(() => {
    if (gameCode) {
      const newSocket = new WebSocket(
        `${import.meta.env.VITE_WS_PROTOCOL}://${import.meta.env.VITE_HOST}:${
          import.meta.env.VITE_PORT
        }/ws/host/${gameCode}`
      );

      newSocket.onopen = () => {
        console.log("WebSocket connection established for game:", gameCode);
        setSocket(newSocket);
      };

      newSocket.onmessage = (event) => {
        console.log("WebSocket message received:", event.data);
        try {
          const data = JSON.parse(event.data);

          if (data.metrics) {
            setMetrics(data.metrics);
            const playerNames = Object.keys(data.metrics.player_metrics);
            setPlayers(playerNames);
          } else if (data.type === "info" && data.message === "[START]") {
            setGameStarted(true);
          } else {
            console.error("Unexpected message format:", data);
          }
        } catch (error) {
          console.warn("Non-JSON WebSocket message:", event.data);
        }
      };

      newSocket.onclose = () => {
        console.log("WebSocket connection closed");
      };

      return () => {
        newSocket.close();
      };
    }
  }, [gameCode]);

  const sendMessage = (message: string) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      if (message === "start" && (!players || players.length === 0)) {
        setError(true);
        setTimeout(() => setError(false), 2000);
      } else {
        socket.send(message);
        console.log("Message sent:", message);
        if (message === "start") {
          setGameStarted(true);
        }
        if (message === "end") {
          setGameEnded(true);
        }
        if (message === "pause") {
          setGamePaused(true);
        }
      }
    } else {
      console.error("WebSocket is not open");
    }
  };

  // Scroll to top
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Get initials
  const getPlayerInitials = (name: string): string => {
    const initials = name
      .split(" ")
      .map((word) => word[0]?.toUpperCase())
      .join("");
    return initials || "?"; // Fallback to '?' if no initials can be derived
  };

  // Helper to generate a consistent color based on the player's name
  const getPlayerColor = (name: string): string => {
    const hash = name
      .split("")
      .reduce((acc, char) => char.charCodeAt(0) + acc, 0);
    const colors = [
      "bg-red-500",
      "bg-green-500",
      "bg-blue-500",
      "bg-yellow-500",
      "bg-purple-500",
    ];
    return colors[hash % colors.length];
  };

  return (
    <section className="relative bg-gradient-to-b from-violet-50 to-gray-50 min-h-screen pb-[340px]">
      <Header />
      <div className="container mx-auto flex flex-col items-center px-4 text-center py-20 md:px-10 lg:px-32 xl:max-w-6xl">
        {!gameCode ? (
          <QuizPromptInput
            setGameCode={setGameCode}
            setQuizMade={setQuizMade}
          />
        ) : (
          <>
            {" "}
            {!gameEnded ? (
              <>
                <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl text-gray-800 mb-8">
                  Game <span className="text-blue-600">Created</span>{" "}
                  Successfully!
                </h1>
                <div className="bg-white shadow-lg rounded-xl px-8 py-6 w-full max-w-lg text-left">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-lg text-gray-700 font-medium">
                        <span className="font-bold">Game Code: </span>
                        <span className="font-mono text-blue-600">
                          {gameCode}
                        </span>
                      </p>
                      <div className="flex flex-row space-x-1">
                        {copied && (
                          <p className="text-gray-600 text-xs pt-[3px]">
                            Copied to clipboard!
                          </p>
                        )}
                        <button
                          onClick={copyToClipboard}
                          className="flex items-center justify-center text-blue-600 hover:text-blue-800 transition duration-200"
                          title="Copy to clipboard"
                        >
                          <IoCopy size={20} />
                        </button>
                      </div>
                    </div>

                    <p className="text-lg text-gray-700">
                      <a
                        className="underline font-bold text-blue-500 hover:text-blue-700"
                        href={`http://localhost:5173/joingame`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        http://{import.meta.env.VITE_HOST}:
                        {import.meta.env.VITE_PORT}/joingame
                      </a>
                    </p>
                    <div className="flex justify-center mt-6">
                      {gameStarted === false ? (
                        <button
                          onClick={() => sendMessage("start")}
                          className="px-6 py-3 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition duration-200"
                        >
                          Start Game
                        </button>
                      ) : (
                        <div className="flex flex-row space-x-4">
                          <button
                            onClick={() => {
                              sendMessage(gamePaused ? "resume" : "pause");
                              setGamePaused(!gamePaused);
                            }}
                            className={`px-6 py-3 ${
                              gamePaused
                                ? "bg-blue-600 hover:bg-blue-700"
                                : "bg-blue-600 hover:bg-blue-700"
                            } text-white rounded-lg shadow transition duration-200`}
                          >
                            {gamePaused ? "Resume Game" : "Pause Game"}
                          </button>

                          <button
                            onClick={() => sendMessage("end")}
                            className="px-6 py-3 bg-red-600 text-white rounded-lg shadow hover:bg-red-700 transition duration-200"
                          >
                            End Game
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-white shadow-lg rounded-xl px-8 py-6 w-full max-w-lg mt-8">
                  {!gameStarted ? (
                    <>
                      <h3 className="text-2xl font-bold text-gray-800 mb-4">
                        Players in Game
                      </h3>
                      {players.length > 0 ? (
                        <ul className="space-y-2">
                          {players.map((player, index) => (
                            <li
                              key={index}
                              className="flex items-center text-lg text-gray-700 border-b border-gray-300 pb-2"
                            >
                              {/* Show GitHub avatar if available, otherwise placeholder */}
                              {metrics?.player_metrics[player]
                                ?.github_avatar ? (
                                <img
                                  src={
                                    metrics.player_metrics[player].github_avatar
                                  }
                                  alt={`${player}'s avatar`}
                                  className="w-8 h-8 rounded-full mr-4"
                                />
                              ) : (
                                <div
                                  className={`w-8 h-8 rounded-full mr-4 flex items-center justify-center text-white font-bold ${getPlayerColor(
                                    player
                                  )}`}
                                >
                                  {getPlayerInitials(player)}
                                </div>
                              )}
                              {player}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-gray-500 mt-4">
                          No players have joined yet. Share the link to invite
                          friends!
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <h3 className="text-2xl font-bold text-gray-800 mb-4">
                        Leaderboard
                      </h3>
                      {metrics ? (
                        <div className="space-y-4">
                          {Object.entries(metrics.player_metrics).map(
                            ([name, data], index) => (
                              <div
                                key={index}
                                className="flex justify-between items-center bg-gray-100 px-6 py-4 rounded-lg shadow"
                              >
                                <div className="flex items-center">
                                  {/* Show GitHub avatar if available, otherwise initials */}
                                  {data.github_avatar ? (
                                    <img
                                      src={data.github_avatar}
                                      alt={`${name}'s avatar`}
                                      className="w-8 h-8 rounded-full mr-4"
                                    />
                                  ) : (
                                    <div
                                      className={`w-8 h-8 rounded-full mr-4 flex items-center justify-center text-white font-bold ${getPlayerColor(
                                        name
                                      )}`}
                                    >
                                      {getPlayerInitials(name)}
                                    </div>
                                  )}
                                  <span className="font-medium text-gray-700">
                                    {name}
                                  </span>
                                </div>
                                <span className="font-bold text-blue-600">
                                  {data.score} pts
                                </span>
                              </div>
                            )
                          )}
                        </div>
                      ) : (
                        <p className="text-gray-500">
                          Waiting for game metrics...
                        </p>
                      )}
                    </>
                  )}
                </div>
                {error && (
                  <p className="text-red-500 mt-4">
                    You cannot start the game without players!
                  </p>
                )}
              </>
            ) : (
              <div className="bg-white shadow-lg rounded-xl px-8 py-6 w-full max-w-2xl text-center">
                <h2 className="text-4xl font-bold text-gray-800 mb-4">
                  Game Over
                </h2>
                <p className="text-lg text-gray-700 mb-6">
                  Thanks for playing!
                </p>
                <p className="text-2xl font-bold text-blue-600 mb-6">
                  Final Scores:
                </p>
                <ul className="space-y-2">
                  {metrics &&
                    Object.entries(metrics.player_metrics)
                      .sort(([, a], [, b]) => b.score - a.score) // Sort by score in descending order
                      .map(([name, data], index) => (
                        <li
                          key={index}
                          className="flex items-center justify-between text-lg text-gray-700 border-b border-gray-300 pb-2"
                        >
                          <div className="flex items-center">
                            {/* Show GitHub avatar if available, otherwise fallback to initials */}
                            {data.github_avatar ? (
                              <img
                                src={data.github_avatar}
                                alt={`${name}'s avatar`}
                                className="w-8 h-8 rounded-full mr-4"
                              />
                            ) : (
                              <div
                                className={`w-8 h-8 rounded-full mr-4 flex items-center justify-center text-white font-bold ${getPlayerColor(
                                  name
                                )}`}
                              >
                                {getPlayerInitials(name)}
                              </div>
                            )}
                            {name}
                          </div>
                          <div>{data.score}</div>
                        </li>
                      ))}
                </ul>

                <button
                  onClick={() => window.location.reload()} // Reload page to restart
                  className="px-6 py-3 bg-violet-600 text-white rounded-lg shadow hover:bg-violet-700 transition duration-200 mt-6"
                >
                  Play Again
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <div className="absolute inset-0 pointer-events-none">
        <svg
          className="absolute bottom-0 left-0 w-full"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 1440 400"
        >
          <path
            fill="#e5e7eb"
            d="M0,128L48,160C96,192,192,256,288,256C384,256,480,192,576,160C672,128,768,128,864,160C960,192,1056,256,1152,272C1248,288,1344,256,1392,240L1440,224L1440,400L1392,400C1344,400,1248,400,1152,400C1056,400,960,400,864,400C768,400,672,400,576,400C480,400,384,400,288,400C192,400,96,400,48,400L0,400Z"
          />
        </svg>
      </div>
    </section>
  );
};

export default CreateGame;
import { useState, useEffect } from "react";
import { useGameContext } from "../components/GameContext";
import Header from "../components/Header";

const GamePlay = () => {
  const { gameCode, playerName } = useGameContext();
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [question, setQuestion] = useState<string | null>(null);
  const [answers, setAnswers] = useState<
    { text: string; isCorrect?: boolean }[]
  >([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [showTransition, setShowTransition] = useState<boolean>(false);
  const [questionResult, setQuestionResult] = useState<boolean | null>(null);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [timesUp, setTimesUp] = useState<boolean>(false);
  const [totalQuestions, setTotalQuestions] = useState<number | null>(null);
  const [finalScore, setFinalScore] = useState<number | null>(null);

  useEffect(() => {
    if (!gameCode || !playerName) return;

    const ws = new WebSocket(
      `${import.meta.env.VITE_WS_PROTOCOL}://${import.meta.env.VITE_HOST}:${
        import.meta.env.VITE_PORT
      }/ws/game/${gameCode}/${playerName}`
    );

    ws.onopen = () => {
      console.log("WebSocket connection established.");
      setSocket(ws);
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      ws.close();
      setSocket(null);
    };

    ws.onclose = (event) => {
      console.warn("WebSocket connection closed:", event);
      setSocket(null);
    };

    ws.onmessage = (event) => {
      console.log("Received WebSocket message:", event.data);

      if (event.data === "[END]" || event.data === "[ALL_QUESTIONS_ANSWERED]") {
        setGameOver(true);
      } else if (event.data === "[PAUSE]") {
        setIsPaused(true);
      } else if (event.data === "[RESUME]") {
        setIsPaused(false);
      }

      try {
        const data = JSON.parse(event.data);
        console.log("Parsed data:", data);

        if (data.help) {
          setExplanation(data.help);
        }
        if (data.leaderboard) {
          setFinalScore(data.leaderboard.score);
        }
        if (data.question) {
          const questionText = data.question.question;
          const options = data.question.options;
          const time = data.question.start_time;
          setTotalQuestions(data.question.total_questions);

          setStartTime(time);
          const calculatedTimeLeft = time + 30 - Math.floor(Date.now() / 1000);
          setTimeLeft(calculatedTimeLeft > 0 ? calculatedTimeLeft : 0);

          setQuestion(questionText);
          setAnswers(
            Object.entries(options).map(([key, value]) => ({
              text: `${key}: ${value}`,
            }))
          );

          setSelectedAnswer(null);
          setExplanation(null);
          setProgress((prev) => prev + 1);

          // Reset isCorrect here
          setIsCorrect(null);
        } else if (data.attempt) {
          setIsCorrect(data.attempt.correct);
          if (data.attempt.final && !data.attempt.correct) {
            setExplanation("Incorrect again.");
          }
        } else {
          console.warn("Unhandled WebSocket message format:", data);
        }
      } catch (err) {
        console.error("Error processing WebSocket message:", err);
      }
    };

    return () => {
      ws.close();
      setSocket(null);
    };
  }, [gameCode, playerName]);

  // Handle answer submission
  const handleAnswerClick = (answer: string) => {
    if (socket && !isPaused && !showTransition) {
      socket.send(answer.split(":")[0].trim().toUpperCase());
      setSelectedAnswer(answer);
    }
  };

  // Timer logic
  useEffect(() => {
    if (timeLeft !== null && timeLeft > 0 && !isPaused && !showTransition) {
      const timeoutDuration = timeLeft < 1 ? timeLeft * 1000 : 1000;

      const timer = setTimeout(() => {
        setTimeLeft((prev) => {
          if (prev !== null) {
            if (prev > 1) {
              return prev - 1;
            } else {
              return 0;
            }
          }
          return null;
        });
      }, timeoutDuration);

      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && selectedAnswer === null && !isPaused) {
      setIsCorrect(false);
      setTimesUp(true);
      setExplanation(`Incorrect`);
    }
  }, [timeLeft, selectedAnswer, isPaused, showTransition]);

  // Handle "Try Again" button click
  const handleTryAgain = () => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send("TRY_AGAIN");
      setSelectedAnswer(null);
      setIsCorrect(null);
      setExplanation(null);
    }
  };

  // Handle Transition Screen Logic
  useEffect(() => {
    if (isCorrect === true) {
      setQuestionResult(isCorrect);
      setShowTransition(true);

      const timer = setTimeout(() => {
        setShowTransition(false);
        setQuestionResult(null);

        // Send a message to get the next question
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send("NEXT_QUESTION");
        }

        // Reset isCorrect here
        setIsCorrect(null);
        setSelectedAnswer(null);
      }, 4000);

      return () => clearTimeout(timer);
    }
  }, [isCorrect, socket]);

  return (
    <section className="relative bg-gradient-to-b from-violet-50 to-gray-50 min-h-screen">
      <Header />
      {gameOver ? (
        <div className="bg-white shadow-lg rounded-xl px-8 py-6 w-full max-w-2xl mx-auto mt-20 text-center">
          <h2 className="text-4xl font-bold text-gray-800 mb-4">Game Over</h2>
          <p className="text-lg text-gray-700 mb-6">
            Thanks for playing,{" "}
            <span className="font-semibold">{playerName}</span>!
          </p>
          <p className="text-2xl font-bold text-blue-600 mb-6">
            Your Final Score: {finalScore} pts
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-violet-600 text-white rounded-lg shadow hover:bg-violet-700 transition duration-200"
          >
            Play Again
          </button>
        </div>
      ) : (
        <>
          {/* Pause Overlay */}
          {isPaused && (
            <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
              <div className="bg-white rounded-2xl px-10 py-8 text-center shadow-xl max-w-md">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">
                  Game Paused
                </h2>
                <p className="text-lg text-gray-600 mb-6">
                  The host has paused the game. Take a moment to relax.
                </p>
              </div>
            </div>
          )}
          {/* Transition Screen */}
          {showTransition && (
            <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
              <div className="bg-white rounded-2xl px-10 py-8 text-center shadow-xl max-w-md">
                <h2
                  className={`text-3xl font-bold mb-4 ${
                    questionResult ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {questionResult ? "Correct Answer!" : "Incorrect Answer!"}
                </h2>
                <p className="text-lg text-gray-700 mb-6">
                  {questionResult
                    ? "Great job! Get ready for the next question."
                    : "Don't worry! Try the next one."}
                </p>
              </div>
            </div>
          )}

          {/* Content */}
          <div className="relative z-10 container mx-auto flex flex-col items-center px-4 text-center py-20 md:px-10 lg:px-32 xl:max-w-4xl">
            <div className="flex justify-between items-center w-full max-w-2xl mb-4">
              <p className="text-lg font-medium text-gray-700">
                Question {progress}/{totalQuestions}
              </p>
              <p className="text-lg font-medium text-gray-700">
                Time Left:{" "}
                {timeLeft !== null ? Math.max(Math.floor(timeLeft), 0) : 0}
              </p>
            </div>
            <div className="w-full max-w-2xl bg-gray-200 h-2 rounded-lg overflow-hidden mb-6">
              <div
                className="bg-blue-600 h-full transition-all"
                style={{ width: `${(progress / 10) * 100}%` }}
              ></div>
            </div>

            <div className="bg-white shadow-lg rounded-xl px-8 py-6 w-full max-w-2xl min-h-64 mb-6">
              <h2 className="text-2xl font-bold text-gray-800">{question}</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl">
              {answers.map((answer, index) => (
                <button
                  key={index}
                  onClick={() => handleAnswerClick(answer.text)}
                  className={`w-full px-6 py-3 text-lg font-medium rounded-lg shadow transition duration-200 ${
                    selectedAnswer === answer.text
                      ? isCorrect
                        ? "bg-green-500 text-white"
                        : "bg-red-500 text-white"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                  disabled={
                    selectedAnswer !== null || isPaused || showTransition
                  }
                >
                  {answer.text}
                </button>
              ))}
            </div>

            {explanation && (
              <div className="bg-gray-100 shadow-lg rounded-xl px-8 py-6 w-full max-w-2xl mt-8">
                {timesUp ? (
                  <h3 className="text-xl font-bold text-gray-800 mb-2">
                    Time's Up!
                  </h3>
                ) : (
                  <h3 className="text-xl font-bold text-gray-800 mb-2">
                    AI Explanation
                  </h3>
                )}
                <p className="text-lg text-gray-700">{explanation}</p>
                {!timesUp && (
                  <button
                    onClick={handleTryAgain}
                    className="bg-blue-600 px-6 py-3 text-white rounded-lg my-4"
                  >
                    Try Again
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
};

export default GamePlay;
import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom"; // For navigation
import Header from "../components/Header";
import { useGameContext } from "../components/GameContext"; // Import GameContext

const JoinGame = () => {
  const [localGameCode, setLocalGameCode] = useState(""); // Input for game code
  const [localPlayerName, setLocalPlayerName] = useState(""); // Input for player name
  const [error, setError] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false); // Track waiting state
  const { setGameCode, setPlayerName, setIsGameActive } = useGameContext(); // Access context setters
  const navigate = useNavigate();

  // Join Game
  const joinGame = async () => {
    setError(null);
    try {
      // API Call to join game
      const response = await axios.post(
        `${import.meta.env.VITE_PROTOCOL}://${import.meta.env.VITE_HOST}:${
          import.meta.env.VITE_PORT
        }/api/joingame/${localGameCode}?player_name=${localPlayerName}`
      );

      // Update context with game data
      setGameCode(localGameCode);
      setPlayerName(localPlayerName);
      setWaiting(true); // Set waiting state to true

      // Establish WebSocket connection
      const socket = new WebSocket(
        `${import.meta.env.VITE_WS_PROTOCOL}://${import.meta.env.VITE_HOST}:${
          import.meta.env.VITE_PORT
        }/ws/game/${localGameCode}/${localPlayerName}`
      );

      socket.onopen = () => {
        console.log(
          "WebSocket connection established for player:",
          localPlayerName
        );
      };

      socket.onmessage = (event) => {
        console.log("WebSocket message received:", event.data);

        try {
          const data = event.data;

          if (data === "[START]") {
            console.log(
              "Game has started for player, navigating to GamePlay..."
            );
            setIsGameActive(true); // Update game context to active
            socket.close();
            navigate("/gameplay", { replace: true }); // Navigate to GamePlay page
          } else {
            console.log("Unhandled WebSocket message:", data);
          }
        } catch (err) {
          console.warn("Non-JSON WebSocket message or error:", event.data);
        }
      };

      socket.onclose = () => {
        console.log("WebSocket connection closed for player:", localPlayerName);
      };
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          "Error joining game. Check your game code."
      );
    }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <section className="relative bg-gradient-to-b from-violet-50 to-gray-50 min-h-screen pb-96">
      <Header />
      <div className="container mx-auto flex flex-col items-center px-4 text-center py-20 md:px-10 lg:px-32 xl:max-w-4xl">
        {!waiting ? (
          <>
            <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl text-gray-800">
              Join a <span className="text-violet-600">Game</span>
            </h1>
            <p className="px-6 mt-6 mb-12 text-lg text-gray-700 sm:px-12 lg:px-20">
              Enter a game code to join your friends and compete in fun,
              interactive quizzes powered by AI.
            </p>

            <div className="w-full max-w-md space-y-4">
              <input
                type="text"
                placeholder="Enter Game Code"
                value={localGameCode}
                onChange={(e) => setLocalGameCode(e.target.value)}
                className="w-full px-6 py-4 text-lg rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200"
              />
              <input
                type="text"
                placeholder="Enter Your Name"
                value={localPlayerName}
                onChange={(e) => setLocalPlayerName(e.target.value)}
                className="w-full px-6 py-4 text-lg rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200"
              />
              <button
                onClick={joinGame}
                disabled={!localGameCode || !localPlayerName} // Disable button if inputs are empty
                className="w-full px-6 py-3 text-lg font-medium rounded-lg bg-violet-600 text-white shadow-lg hover:bg-violet-700 transition duration-200"
              >
                Join Game
              </button>
            </div>

            {error && <p className="text-red-500 mt-4">{error}</p>}
          </>
        ) : (
          <>
            <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl text-gray-800 mb-8">
              Welcome,{" "}
              <span className="text-violet-600">{localPlayerName}</span>!
            </h1>
            <div className="bg-white shadow-lg rounded-xl px-8 py-6 w-full max-w-lg text-left">
              <div className="space-y-4">
                <p className="text-lg text-gray-700 font-medium">
                  <strong>Game Code:</strong>{" "}
                  <span className="font-mono text-blue-600">
                    {localGameCode}
                  </span>
                </p>
                <p className="text-lg text-gray-700">
                  Hang tight! The host will start the game soon.
                </p>
                <p className="text-lg text-gray-700 font-bold">How it works:</p>
                <p className="text-lg text-gray-700">
                  Answer questions, and if you get one wrong, AI provides help
                  and gives you 50% credit for learning from it.
                </p>
                <div className="flex items-center justify-center space-x-2 py-4">
                  <div
                    className="w-3 h-3 bg-purple-700 rounded-full animate-bounce"
                    style={{ animationDelay: "0s" }}
                  ></div>
                  <div
                    className="w-3 h-3 bg-purple-700 rounded-full animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  ></div>
                  <div
                    className="w-3 h-3 bg-purple-700 rounded-full animate-bounce"
                    style={{ animationDelay: "0.4s" }}
                  ></div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="absolute inset-0 pointer-events-none">
        <svg
          className="absolute bottom-0 left-0 w-full"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 1440 400"
        >
          <path
            fill="#e5e7eb"
            d="M0,128L48,160C96,192,192,256,288,256C384,256,480,192,576,160C672,128,768,128,864,160C960,192,1056,256,1152,272C1248,288,1344,256,1392,240L1440,224L1440,400L1392,400C1344,400,1248,400,1152,400C1056,400,960,400,864,400C768,400,672,400,576,400C480,400,384,400,288,400C192,400,96,400,48,400L0,400Z"
          />
        </svg>
      </div>
    </section>
  );
};

export default JoinGame;

# videojs-quiz
Interactive quiz for video.js player.<br/> <br/>
This plugin brings interactive quizzes to videos, allowing users to answer multiple-choice questions directly within the player.<br/>
It ensures active participation by requiring users to complete the quiz before continuing playback, making it ideal for e-learning, training, and interactive engagement.

## Installation
`npm i videojs-quiz`


## Getting Started

Post installation, import and use the package like shown below:-
```
import 'videojs-quiz';

var quizData = [
  {
    questionId: '1',
    time: 5, // Time (in seconds) to pause for the quiz
    question: 'What is the capital of France?',
    answers: ['Berlin', 'Madrid', 'Paris'],
    correctAnswer: 2, // Index of the correct answer
  },
  {
    questionId: '2',
    time: 10,
    question: 'Which planet is known as the Red Planet?',
    answers: ['Earth', 'Mars', 'Jupiter', 'Venus'],
    correctAnswer: 1,
  }
]; 
   
 const player = videojs(playerId,options);  //initialise videojs player

  player.on('ready', () => {
      // initialise quiz data
      player.quiz({
        quizData: quizData
      });

      // listener for answer selection
      player.on('quizAnswer', (e) => {
        console.log('Selection: ', e.detail);
      })
  })

 
```



module.exports = function (grunt) {
    // Load NPM Tasks
    require('load-grunt-tasks')(grunt);
  
    grunt.initConfig({
      // Compile SCSS to CSS
      sass: {
        options: {
          implementation: require('sass'), // Use Dart Sass
          sourceMap: false,
          includePaths: ['src/scss'] 
        },
        dist: {
          files: {
            'dist/style.css': 'src/scss/videojs-quiz.scss'
          }
        }
      },
  
      // Copy the original JS file (Unminified version)
      copy: {
        js: {
          files: [
            {
              expand: true,
              cwd: 'src/js/',
              src: ['videojs-quiz.js'], // Source file
              dest: 'dist/', // Destination folder
              rename: function (dest, src) {
                return dest + src.replace('.js', '.normal.js'); // Rename as normal.js
              }
            }
          ]
        },
        direct_files: { // Add this section
          files: [
            {
              src: 'README.md',
              dest: 'dist/README.md'
            },
            {
              src: 'package.json', // Copy package.json
              dest: 'dist/package.json'
            },
            {
              src: 'LICENSE.md', // Copy package.json
              dest: 'dist/LICENSE.md'
            }
          ]
        }
      },

  
      // Minify JavaScript
      uglify: {
        dist: {
          files: {
            'dist/videojs_quiz.min.js': ['src/js/videojs-quiz.js'] // Minified version
          }
        }
      },

      concat: {
        index: {
            options: {
                banner: 'import "./style.css";\n', // Add CSS import at the top
                footer: '\nexport { default } from "./videojs-quiz.normal.js";' // Add JS export at the bottom
            },
            src: [], // No need for actual content, just headers & footers
            dest: 'dist/index.js'
        }
    },

  
      // Watch for changes
      watch: {
        css: {
          files: 'src/scss/**/*.scss',
          tasks: ['sass']
        },
        js: {
          files: 'src/js/**/*.js',
          tasks: ['copy:js', 'uglify']
        }
      }
    });
  
    // Load plugins
    grunt.loadNpmTasks('grunt-sass');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-watch');
  
    // Register default task
    grunt.registerTask('default', ['sass', 'copy:js', 'copy:direct_files',, 'uglify','concat', 'watch']);
  };
  import videojs from "video.js";
(function (videojs) {

  var InteractiveQuizPlugin = function (options) {
    var player = this; // This refers to the Video.js player instance
    var quizData = options.quizData || []; // The quiz data passed into the plugin options
    var currentQuizIndex = 0; // Keep track of the current quiz question
    var answeredQuizzes = new Set(); // Track answered questions (to avoid repeating)

    // Create the quiz popup and make it part of the Video.js player container
    var quizPopup = document.createElement('div');
    quizPopup.className = 'vjs-quiz-popup';
    quizPopup.style.display = 'none';

    
    var quizContents = document.createElement('div');
    quizContents.className = 'vjs-quiz-contents'


    // Create a question element inside the popup
    var questionElement = document.createElement('div');
    questionElement.className = 'vjs-quiz-question'
    quizContents.appendChild(questionElement);

    var answerContainer = document.createElement('div');
    answerContainer.className = 'vjs-quiz-options';

    // Create answer buttons inside the container
    var answerButtons = [];
    for (var i = 0; i < 4; i++) {
      var button = document.createElement('button');
      button.className = 'vjs-quiz-option-btn';
      answerContainer.appendChild(button);
      answerButtons.push(button);
    }

    // Append answer container inside quiz popup
    quizContents.appendChild(answerContainer);


    quizPopup.appendChild(quizContents)
    // Append the quiz popup to the player's element (inside the player container)
    player.el().appendChild(quizPopup);


    // Function to show quiz and pause video
    function showQuizPopup(quiz) {
      player.pause(); // Pause the video
      player.controls(false);
      questionElement.textContent = quiz.question;
      answerButtons.forEach((button, index) => {
        if (quiz.answers[index] !== undefined) {
          button.textContent = `${index+1}`+". "+quiz.answers[index];
          button.style.display = 'block'; // Ensure visible if needed
          button.onclick = function () {
            handleOptionSelect(index, quiz.correctAnswer, quiz.questionId, quiz);
          };
        } else {
          button.style.display = 'none'; // Hide unused buttons properly
        }
      });

      quizPopup.style.display = 'block'; // Show the quiz popup
    }

    // Function to check the answer
    function handleOptionSelect(selectedIndex, correctIndex, questionId, quiz) {
      var isCorrect = selectedIndex === correctIndex;

      quizPopup.style.display = 'none'; // Hide the quiz popup
      player.controls(true);
      player.play(); // Resume the video

      // Mark this quiz as answered
      answeredQuizzes.add(questionId);

      // Trigger a custom event to capture user info and answer selection
      triggerUserAnswerEvent(questionId, selectedIndex, isCorrect, quiz);
    }

    // Function to trigger a custom event when the user answers a question
    function triggerUserAnswerEvent(questionId, selectedIndex, isCorrect, quiz) {
      var userAnswerData = {
        questionId: questionId,
        answer: quiz.answers[selectedIndex],
        isCorrect: isCorrect,
        timestamp: player.currentTime()
      };

      // Custom event for answering questions
      var event = new CustomEvent('quizAnswer', {
        detail: userAnswerData
      });
      // Dispatch the event globally or on a specific element
      player.el().dispatchEvent(event);
    }

    
    let lastTriggeredTime = -1; // Prevents multiple triggers within the same second
    player.on('timeupdate', function () {
      var currentTime = Math.floor(player.currentTime()); // Round time to whole seconds
      // Prevent multiple triggers within the same second
      if (currentTime === lastTriggeredTime) return;
      lastTriggeredTime = currentTime;
      quizData.forEach((quiz) => {
        if (quiz.time === currentTime && !answeredQuizzes.has(quiz.time)) {
          showQuizPopup(quiz); // Show the quiz
          answeredQuizzes.add(quiz.time); // Mark this timestamp as answered
        }
      });
    });


    // Handle user skipping to a timestamp
    player.on('seeked', function () {
      var currentTime = player.currentTime();
      for (var i = 0; i < quizData.length; i++) {
        if (quizData[i].time <= currentTime && !answeredQuizzes.has(quizData[i].questionId)) {
          showQuizPopup(quizData[i]);
          currentQuizIndex = i + 1; // Ensure we only show the first missed quiz
        }
      }
    });

  };

  // Register the plugin with Video.js
  videojs.registerPlugin('quiz', InteractiveQuizPlugin);

})(videojs);module.exports = function (grunt) {
    // Load NPM Tasks
    require('load-grunt-tasks')(grunt);
  
    grunt.initConfig({
      // Compile SCSS to CSS
      sass: {
        options: {
          implementation: require('sass'), // Use Dart Sass
          sourceMap: false,
          includePaths: ['src/scss'] 
        },
        dist: {
          files: {
            'dist/style.css': 'src/scss/videojs-quiz.scss'
          }
        }
      },
  
      // Copy the original JS file (Unminified version)
      copy: {
        js: {
          files: [
            {
              expand: true,
              cwd: 'src/js/',
              src: ['videojs-quiz.js'], // Source file
              dest: 'dist/', // Destination folder
              rename: function (dest, src) {
                return dest + src.replace('.js', '.normal.js'); // Rename as normal.js
              }
            }
          ]
        },
        direct_files: { // Add this section
          files: [
            {
              src: 'README.md',
              dest: 'dist/README.md'
            },
            {
              src: 'package.json', // Copy package.json
              dest: 'dist/package.json'
            },
            {
              src: 'LICENSE.md', // Copy package.json
              dest: 'dist/LICENSE.md'
            }
          ]
        }
      },

  
      // Minify JavaScript
      uglify: {
        dist: {
          files: {
            'dist/videojs_quiz.min.js': ['src/js/videojs-quiz.js'] // Minified version
          }
        }
      },

      concat: {
        index: {
            options: {
                banner: 'import "./style.css";\n', // Add CSS import at the top
                footer: '\nexport { default } from "./videojs-quiz.normal.js";' // Add JS export at the bottom
            },
            src: [], // No need for actual content, just headers & footers
            dest: 'dist/index.js'
        }
    },

  
      // Watch for changes
      watch: {
        css: {
          files: 'src/scss/**/*.scss',
          tasks: ['sass']
        },
        js: {
          files: 'src/js/**/*.js',
          tasks: ['copy:js', 'uglify']
        }
      }
    });
  
    // Load plugins
    grunt.loadNpmTasks('grunt-sass');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-watch');
  
    // Register default task
    grunt.registerTask('default', ['sass', 'copy:js', 'copy:direct_files',, 'uglify','concat', 'watch']);
  };
  import videojs from "video.js";
(function (videojs) {

  var InteractiveQuizPlugin = function (options) {
    var player = this; // This refers to the Video.js player instance
    var quizData = options.quizData || []; // The quiz data passed into the plugin options
    var currentQuizIndex = 0; // Keep track of the current quiz question
    var answeredQuizzes = new Set(); // Track answered questions (to avoid repeating)

    // Create the quiz popup and make it part of the Video.js player container
    var quizPopup = document.createElement('div');
    quizPopup.className = 'vjs-quiz-popup';
    quizPopup.style.display = 'none';

    
    var quizContents = document.createElement('div');
    quizContents.className = 'vjs-quiz-contents'


    // Create a question element inside the popup
    var questionElement = document.createElement('div');
    questionElement.className = 'vjs-quiz-question'
    quizContents.appendChild(questionElement);

    var answerContainer = document.createElement('div');
    answerContainer.className = 'vjs-quiz-options';

    // Create answer buttons inside the container
    var answerButtons = [];
    for (var i = 0; i < 4; i++) {
      var button = document.createElement('button');
      button.className = 'vjs-quiz-option-btn';
      answerContainer.appendChild(button);
      answerButtons.push(button);
    }

    // Append answer container inside quiz popup
    quizContents.appendChild(answerContainer);


    quizPopup.appendChild(quizContents)
    // Append the quiz popup to the player's element (inside the player container)
    player.el().appendChild(quizPopup);


    // Function to show quiz and pause video
    function showQuizPopup(quiz) {
      player.pause(); // Pause the video
      player.controls(false);
      questionElement.textContent = quiz.question;
      answerButtons.forEach((button, index) => {
        if (quiz.answers[index] !== undefined) {
          button.textContent = `${index+1}`+". "+quiz.answers[index];
          button.style.display = 'block'; // Ensure visible if needed
          button.onclick = function () {
            handleOptionSelect(index, quiz.correctAnswer, quiz.questionId, quiz);
          };
        } else {
          button.style.display = 'none'; // Hide unused buttons properly
        }
      });

      quizPopup.style.display = 'block'; // Show the quiz popup
    }

    // Function to check the answer
    function handleOptionSelect(selectedIndex, correctIndex, questionId, quiz) {
      var isCorrect = selectedIndex === correctIndex;

      quizPopup.style.display = 'none'; // Hide the quiz popup
      player.controls(true);
      player.play(); // Resume the video

      // Mark this quiz as answered
      answeredQuizzes.add(questionId);

      // Trigger a custom event to capture user info and answer selection
      triggerUserAnswerEvent(questionId, selectedIndex, isCorrect, quiz);
    }

    // Function to trigger a custom event when the user answers a question
    function triggerUserAnswerEvent(questionId, selectedIndex, isCorrect, quiz) {
      var userAnswerData = {
        questionId: questionId,
        answer: quiz.answers[selectedIndex],
        isCorrect: isCorrect,
        timestamp: player.currentTime()
      };

      // Custom event for answering questions
      var event = new CustomEvent('quizAnswer', {
        detail: userAnswerData
      });
      // Dispatch the event globally or on a specific element
      player.el().dispatchEvent(event);
    }

    
    let lastTriggeredTime = -1; // Prevents multiple triggers within the same second
    player.on('timeupdate', function () {
      var currentTime = Math.floor(player.currentTime()); // Round time to whole seconds
      // Prevent multiple triggers within the same second
      if (currentTime === lastTriggeredTime) return;
      lastTriggeredTime = currentTime;
      quizData.forEach((quiz) => {
        if (quiz.time === currentTime && !answeredQuizzes.has(quiz.time)) {
          showQuizPopup(quiz); // Show the quiz
          answeredQuizzes.add(quiz.time); // Mark this timestamp as answered
        }
      });
    });


    // Handle user skipping to a timestamp
    player.on('seeked', function () {
      var currentTime = player.currentTime();
      for (var i = 0; i < quizData.length; i++) {
        if (quizData[i].time <= currentTime && !answeredQuizzes.has(quizData[i].questionId)) {
          showQuizPopup(quizData[i]);
          currentQuizIndex = i + 1; // Ensure we only show the first missed quiz
        }
      }
    });

  };

  // Register the plugin with Video.js
  videojs.registerPlugin('quiz', InteractiveQuizPlugin);

})(videojs);{
  "name": "videojs-quiz",
  "version": "1.0.0",
  "description": "Interactive quiz for video.js",
  "main": "dist/videojs_quiz",
  "module": "dist/videojs_quiz",
  "style": "dist/style.css",
  "repository": "https://github.com/dds05/videojs-quiz",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [
		"videojs",
    "videojs-plugin",
		"videojs-quiz",
		"quiz"
	],
  "author": "Daman",
  "license": "ISC",
  "devDependencies": {
    "grunt": "^1.6.1",
    "grunt-contrib-concat": "^2.1.0",
    "grunt-contrib-copy": "^1.0.0",
    "grunt-contrib-uglify": "^5.2.2",
    "grunt-contrib-watch": "^1.1.0",
    "grunt-sass": "^4.0.0",
    "load-grunt-tasks": "^5.1.0",
    "sass": "^1.85.1"
  },
  "dependencies": {
    "global": "^4.3.2",
    "video.js": "^5 || ^6 || ^7 || ^8"
  }
}

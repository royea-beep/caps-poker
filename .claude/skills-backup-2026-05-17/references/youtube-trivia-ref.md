<img width="938" alt="youtube-trivia-logo" src="https://github.com/AriEncarnacion/youtube-trivia/assets/48712583/599df377-d5a0-4511-9a00-3f67fc4d118b">

# YoutubeTrivia - [Live Here! :)](https://youtube-trivia.vercel.app/)
A relatively simple app that creates a quiz for a user and grades it using OpenAI API. This is basically a feature set clone of https://www.fastquiz.app/.


**_Note: App is only optomized for videos ~5min or less. You can try longer ones, but Vercel's systems may time out. If you get an infinite loading screen, it's probably an unhandled `504 gateway timeout`. Try again with a shorter video._**


If you liked the app or have any questions, feel free to reach out to me on [LinkedIn](https://www.linkedin.com/in/ariel-encarnacion/)! (:

---
Here's some example videos I used during testing (copy and paste into form on YoutubeTrivia):
* [Intro to AWS Amplify | Amazon Web Services]
```
https://www.youtube.com/watch?v=wi-L_TtsqC4
```
* [React in 100 Seconds]
```
https://www.youtube.com/watch?v=Tn6-PIqc4UM
```
* [React Native in 100 Seconds]
```
https://www.youtube.com/watch?v=gvkqT_Uoahw 
```
* [Why you need cookie-based Auth for the Next.js App Router (2024)]
```
https://www.youtube.com/watch?v=w3LD0Z73vgU
```
---
### Improvements compared to fastquiz:
* FastQuiz isn't mobile friendly
  * YoutubeTrivia is! 
* FastQuiz allows the user to respond in a chat box, but it makes the interface buggy and messy. Use for the chatbox UI is unclear.
  * YoutubeTrivia provides no chatbox. All AI API calls are made purely in the backend. This keeps UX clear and intuitive.
* FastQuiz frequently returns multiple choice questions with no correct answers.
  * YoutubeTrivia leverages OpenAI Functions. This system nearly guarantees the questions will always have one correct answer
* FastQuiz occasionally evaluates a completely correct free answer question as "partially correct".
  * YoutubeTrivia isn't the best grader, but if you put in a comprehensive answer, the score is often high
* FastQuiz opts for a "correct, partially correct, incorrect" system that makes evaluations muddy and confusing
  * YoutubeTrivia uses a 0-100 score system, color coded based on the score. This gives the user more insight into how their answer performed.
---
### Known Bugs
* Request to AI API gets called twice and resolves twice. This might refresh the quiz a few seconds after its initial render.
  * **Resolution** - Likely due to an improper use of useEffect or improper strategy implemented when researching different ways to implent AI.
  
### TODOs
 * Error handling !!
 * A ton of code cleanup and standardization of TailwindCSS. I like Tailwind but it does get messy if not organized properly.
 * More transitions for CSS resizing
 * More granular styling for different screen sizes
 * Saveable sessions via DB, using a non-secure custom key (Like FastQuiz, when2meet, etc)
 * Add Youtube video embedding to give the user a chance to study before taking the quiz
 * Improvements to model response speed via streaming (when streamed objects become usable, currently they're unstable at best)
 * Fine-tuning/prompt engineering to improve model response quality
---
### Observational notes while completing this project
* OpenAI API implemented via Vercel AI SDK. Makes for clean code, but I feel the responses from OpenAI API Native SDK were faster.
* Quizzes and scripts are saved to DB. Adding full auth functionality and quiz retrieval is a simple extension.
* Dark/Light/System Mode toggle because my poor developer eyes hurt
* shadcn/ui and TailwindCSS make for a great combo to just throw things down and make em look nice.
---
### Running Locally
```bash
npm install
npm run dev
```
---
### Tech Stack
Big thank you to all the teams that make these great products!
* [Nextjs 14 (App Router)](https://nextjs.org/docs)
* [shadcn/ui](https://ui.shadcn.com/)
* [TailwindCSS](https://tailwindcss.com/)
* [OpenAI API Native SDK](https://platform.openai.com/docs/overview) _(@ OpenAI Please implement a dark mode for the docs... we all want it)_
* [Vercel's AI SDK](https://sdk.vercel.ai/docs/introduction) _(@ Vercel why are these docs pure white..? Is this an AI SDK specific thing? Did I miss a trend?)_
export const quizSystemContent = `
  You are responsible for writing a quiz based on a script. 
  The script contains captions from a YouTube video. 
  These are the following content are requirements for the quiz you write.

  Overall quiz requirements:
  * 5 questions
  * 3 multiple choice questions
  * 2 free answer questions

  Multiple choice question requirements:
  * ALL multiple choice questions must contain EXACTLY 3 WRONG ANSWERS and 1 CORRECT ANSWER

  Free answer question requirements:
  * ALL free answer questions have EXACTLY one correct answer.

  Response requirements:
  This quiz MUST be returned in JSON format.
`;

export const evalSystemContent = `
    You are responsible for grading the answer to a question on a quiz. The quiz question, user answer, and correct answer will be provided.
    
    Your grading must have the following requirements:
    
    Return requirements:
    1. A score from 0 to 100, where 0 is completely incorrect and 100 is completely correct and comprehensive.
    2. Score reasoning. Score Reasoning is an explanation on why the answer provided received the score it did based on the context of the question.
    The user answer is compared to the correct answer
    3. Use the question provided to get context of the subject matter, which can be used to influence the score.
    
    The grading must return all data in JSON format.
  `;

export const buildEvaluationPrompt = (
  question: string,
  userAnswer: string,
  correctAnswer: string,
) => {
  return `
    Here is the question:
    ${question}

    Here is the user's answer:
    ${userAnswer}

    Here is the correct answer:
    ${correctAnswer}
  `;
};
export async function POST(request: Request) {
  //TODO: implement me
}
import { sql } from "@vercel/postgres";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

const addScriptRequest = z.object({
  uniqueId: z.string().uuid(),
  userKey: z.string(),
  questions: z.any(),
});

export async function POST(request: Request) {
  const data = await request.json();

  try {
    addScriptRequest.parse(data);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({
        error: err.errors,
      });
    }
  }

  try {
    await sql`INSERT INTO quizzes (uniqueId, userKey, questions) VALUES (${data.uniqueId}, ${data.userKey}, ${data.questions});`;
  } catch (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  const res: any = NextResponse.json({ status: 200 });

  return res;
}

export const OPTIONS = async (request: Request) => {
  return new NextResponse("", {
    status: 200,
  });
};
import { sql } from "@vercel/postgres";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

const addScriptRequest = z.object({
  quizId: z.string().uuid(),
  userKey: z.string(),
  script: z.string(),
});

export async function POST(request: Request) {
  const data = await request.json();

  try {
    addScriptRequest.parse(data);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({
        error: err.errors,
      });
    }
  }

  try {
    await sql`INSERT INTO scripts (quizId, userKey, script) VALUES (${data.quizId}, ${data.userKey}, ${data.script});`;
  } catch (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  const res: any = NextResponse.json({ status: 200 });

  return res;
}

export const OPTIONS = async (request: Request) => {
  return new NextResponse("", {
    status: 200,
  });
};
import { sql } from "@vercel/postgres";
import { NextResponse } from "next/server";
import { z } from "zod";

const addScriptRequest = z.object({
  userKey: z.string(),
});

export async function POST(request: Request) {
  // TODO: verify  and use for userKey implementation
  const data = await request.json();

  try {
    addScriptRequest.parse(data);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({
        error: err.errors,
      });
    }
  }

  try {
    await sql`INSERT INTO users (userKey) VALUES (${data.userKey});`;
  } catch (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  const users = await sql`SELECT * FROM users;`;
  return NextResponse.json({ users }, { status: 200 });
}

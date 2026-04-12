# 🧠 QuizTube: Transforming YouTube Videos into Quizzes with Streamlit

QuizTube offers an innovative approach to create interactive quizzes from YouTube video captions. By extracting captions using the [`youtube-transcript-api`](https://github.com/jdepoix/youtube-transcript-api) and subsequently processing the text with OpenAI's LLM, `QuizTube` serves as a powerful tool for enhancing video content interaction.

## Video Tutorial
[![YouTube Video](https://img.youtube.com/vi/xCsAbe5MVLc/0.jpg)](https://youtu.be/xCsAbe5MVLc)

## Website Link
👉 Check out the app here: https://quiztube.streamlit.app/

## How It Works

1. **Caption Extraction:** Using the [`youtube-transcript-api`](https://github.com/jdepoix/youtube-transcript-api), captions are extracted from a given YouTube video URL.
2. **Quiz Generation:** The extracted captions are then fed into OpenAI's LLM using [`LangChain Python`](https://python.langchain.com/) with a predefined prompt template. The model generates questions based on the content, turning the video's key points into an interactive quiz.
3. **Streamlit Integration:** The quizzes are seamlessly integrated and displayed in a Streamlit app, providing users with a unique and interactive experience.

This project was developed as an entry for the [Streamlit Hackathon in September 2023](https://streamlit.io/community/llm-hackathon-2023).

## More Solutions
Explore my tools and templates for Excel, automation, and more.

**[View all solutions](https://pythonandvba.com/solutions)**
## Connect with Me
- **YouTube:** [CodingIsFun](https://youtube.com/c/CodingIsFun)
- **Website:** [PythonAndVBA](https://pythonandvba.com)
- **LinkedIn:** [Sven Bosau](https://www.linkedin.com/in/sven-bosau/)
- **Contact:** [Get in Touch](https://pythonandvba.com/contact)
## Support
If you find this project helpful, consider buying me a coffee. 

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://pythonandvba.com/coffee-donation)
import streamlit as st
from langchain.chat_models import ChatOpenAI
from langchain.prompts.chat import ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate
from langchain.chains import LLMChain


def get_quiz_data(text, openai_api_key):
    template = f"""
    You are a helpful assistant programmed to generate questions based on any text provided. For every chunk of text you receive, you're tasked with designing 5 distinct questions. Each of these questions will be accompanied by 3 possible answers: one correct answer and two incorrect ones. 

    For clarity and ease of processing, structure your response in a way that emulates a Python list of lists. 

    Your output should be shaped as follows:

    1. An outer list that contains 5 inner lists.
    2. Each inner list represents a set of question and answers, and contains exactly 4 strings in this order:
    - The generated question.
    - The correct answer.
    - The first incorrect answer.
    - The second incorrect answer.

    Your output should mirror this structure:
    [
        ["Generated Question 1", "Correct Answer 1", "Incorrect Answer 1.1", "Incorrect Answer 1.2"],
        ["Generated Question 2", "Correct Answer 2", "Incorrect Answer 2.1", "Incorrect Answer 2.2"],
        ...
    ]

    It is crucial that you adhere to this format as it's optimized for further Python processing.

    """
    try:
        system_message_prompt = SystemMessagePromptTemplate.from_template(template)
        human_message_prompt = HumanMessagePromptTemplate.from_template("{text}")
        chat_prompt = ChatPromptTemplate.from_messages(
            [system_message_prompt, human_message_prompt]
        )
        chain = LLMChain(
            llm=ChatOpenAI(openai_api_key=openai_api_key),
            prompt=chat_prompt,
        )
        return chain.run(text)
    except Exception as e:
        if "AuthenticationError" in str(e):
            st.error("Incorrect API key provided. Please check and update your API key.")
            st.stop()
        else:
            st.error(f"An error occurred: {str(e)}")
            st.stop()import random
import ast

import streamlit as st

def string_to_list(s):
    try:
        return ast.literal_eval(s)
    except (SyntaxError, ValueError) as e:
        st.error(f"Error: The provided input is not correctly formatted. {e}")
        st.stop()

def get_randomized_options(options):
    correct_answer = options[0]
    random.shuffle(options)
    return options, correct_answer# List of toast messages paired with their icons
TOAST_MESSAGES = [
    ("Ready to test your YouTube knowledge?", "🎥"),
    ("QuizTube welcomes you!", "🚀"),
    ("Think you caught all the details? Let's find out!", "🔍"),
    ("It's quiz time! No spoilers allowed.", "⏳"),
    ("Popped in for a quiz? You're in the right place!", "🍿"),
    ("Get your YouTube thinking cap on!", "🎓"),
    ("Your next YouTube challenge awaits!", "🏆"),
    ("Another video, another quiz!", "🔄"),
    ("Turn those video views into victories!", "🎖️"),
    ("Did you pay attention? It's quiz o'clock!", "⏰"),
    ("YouTube is fun, but quizzes? Even better!", "🎉"),
    ("Unleash your YouTube prowess here!", "🦸"),
    ("Knowledge check: Engage!", "🚦"),
    ("Video watched? Check. Quiz taken? Pending...", "✅"),
    ("Dive deeper into your YouTube content.", "🌊"),
    ("Up for a YouTube rewind in quiz form?", "⏪"),
    ("Let's decode your recent YouTube watch!", "🧩"),
    ("Adding some quiz spice to your YouTube binge!", "🌶️"),
    ("Transform your watch time into quiz time!", "🔄"),
    ("Here to validate your YouTube expertise?", "🔍")
]

def get_random_toast():
    """Returns a random toast message and icon."""
    import random
    return random.choice(TOAST_MESSAGES)/tmp/quiztube/helpers/openai_utils.py:from langchain.prompts.chat import ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate
/tmp/quiztube/helpers/openai_utils.py-from langchain.chains import LLMChain
/tmp/quiztube/helpers/openai_utils.py-
/tmp/quiztube/helpers/openai_utils.py-
/tmp/quiztube/helpers/openai_utils.py-def get_quiz_data(text, openai_api_key):
/tmp/quiztube/helpers/openai_utils.py-    template = f"""
/tmp/quiztube/helpers/openai_utils.py:    You are a helpful assistant programmed to generate questions based on any text provided. For every chunk of text you receive, you're tasked with designing 5 distinct questions. Each of these questions will be accompanied by 3 possible answers: one correct answer and two incorrect ones. 
/tmp/quiztube/helpers/openai_utils.py-
/tmp/quiztube/helpers/openai_utils.py-    For clarity and ease of processing, structure your response in a way that emulates a Python list of lists. 
/tmp/quiztube/helpers/openai_utils.py-
/tmp/quiztube/helpers/openai_utils.py-    Your output should be shaped as follows:
/tmp/quiztube/helpers/openai_utils.py-
/tmp/quiztube/helpers/openai_utils.py-    1. An outer list that contains 5 inner lists.
/tmp/quiztube/helpers/openai_utils.py:    2. Each inner list represents a set of question and answers, and contains exactly 4 strings in this order:
/tmp/quiztube/helpers/openai_utils.py:    - The generated question.
/tmp/quiztube/helpers/openai_utils.py-    - The correct answer.
/tmp/quiztube/helpers/openai_utils.py-    - The first incorrect answer.
/tmp/quiztube/helpers/openai_utils.py-    - The second incorrect answer.
/tmp/quiztube/helpers/openai_utils.py-
/tmp/quiztube/helpers/openai_utils.py-    Your output should mirror this structure:
/tmp/quiztube/helpers/openai_utils.py-    [
/tmp/quiztube/helpers/openai_utils.py:        ["Generated Question 1", "Correct Answer 1", "Incorrect Answer 1.1", "Incorrect Answer 1.2"],
/tmp/quiztube/helpers/openai_utils.py:        ["Generated Question 2", "Correct Answer 2", "Incorrect Answer 2.1", "Incorrect Answer 2.2"],
/tmp/quiztube/helpers/openai_utils.py-        ...
/tmp/quiztube/helpers/openai_utils.py-    ]
/tmp/quiztube/helpers/openai_utils.py-
/tmp/quiztube/helpers/openai_utils.py-    It is crucial that you adhere to this format as it's optimized for further Python processing.
/tmp/quiztube/helpers/openai_utils.py-
/tmp/quiztube/helpers/openai_utils.py-    """
/tmp/quiztube/helpers/openai_utils.py-    try:
/tmp/quiztube/helpers/openai_utils.py:        system_message_prompt = SystemMessagePromptTemplate.from_template(template)
/tmp/quiztube/helpers/openai_utils.py:        human_message_prompt = HumanMessagePromptTemplate.from_template("{text}")
/tmp/quiztube/helpers/openai_utils.py:        chat_prompt = ChatPromptTemplate.from_messages(
/tmp/quiztube/helpers/openai_utils.py:            [system_message_prompt, human_message_prompt]
/tmp/quiztube/helpers/openai_utils.py-        )
/tmp/quiztube/helpers/openai_utils.py-        chain = LLMChain(
/tmp/quiztube/helpers/openai_utils.py-            llm=ChatOpenAI(openai_api_key=openai_api_key),
/tmp/quiztube/helpers/openai_utils.py:            prompt=chat_prompt,
/tmp/quiztube/helpers/openai_utils.py-        )
/tmp/quiztube/helpers/openai_utils.py-        return chain.run(text)
/tmp/quiztube/helpers/openai_utils.py-    except Exception as e:
/tmp/quiztube/helpers/openai_utils.py-        if "AuthenticationError" in str(e):
/tmp/quiztube/helpers/openai_utils.py-            st.error("Incorrect API key provided. Please check and update your API key.")
/tmp/quiztube/helpers/openai_utils.py-            st.stop()
/tmp/quiztube/helpers/openai_utils.py-        else:
/tmp/quiztube/helpers/openai_utils.py-            st.error(f"An error occurred: {str(e)}")
/tmp/quiztube/helpers/openai_utils.py-            st.stop()
--
/tmp/quiztube/streamlit_app.py:Once you've input the details, voilà! Dive deep into questions crafted just for you, ensuring you've truly grasped the content of the video. Let's put your knowledge to the test! 
/tmp/quiztube/streamlit_app.py-""")
/tmp/quiztube/streamlit_app.py-
/tmp/quiztube/streamlit_app.py-with st.expander("💡 Video Tutorial"):
/tmp/quiztube/streamlit_app.py-    with st.spinner("Loading video.."):
/tmp/quiztube/streamlit_app.py-        st.video("https://youtu.be/yzBr3L2BIto", format="video/mp4", start_time=0)
/tmp/quiztube/streamlit_app.py-
/tmp/quiztube/streamlit_app.py-with st.form("user_input"):
/tmp/quiztube/streamlit_app.py-    YOUTUBE_URL = st.text_input("Enter the YouTube video link:", value="https://youtu.be/bcYwiwsDfGE?si=qQ0nvkmKkzHJom2y")
/tmp/quiztube/streamlit_app.py-    OPENAI_API_KEY = st.text_input("Enter your OpenAI API Key:", placeholder="sk-XXXX", type='password')
/tmp/quiztube/streamlit_app.py-    submitted = st.form_submit_button("Craft my quiz!")
--
/tmp/quiztube/streamlit_app.py:                        st.warning(f"Almost perfect! You got 1 question wrong. Let's review it:")
/tmp/quiztube/streamlit_app.py-                    else:
/tmp/quiztube/streamlit_app.py:                        st.warning(f"Almost there! You got {incorrect_count} questions wrong. Let's review them:")
/tmp/quiztube/streamlit_app.py-
/tmp/quiztube/streamlit_app.py-                for i, (ua, ca, q, ro) in enumerate(zip(st.session_state.user_answers, st.session_state.correct_answers, st.session_state.quiz_data_list, st.session_state.randomized_options)):
/tmp/quiztube/streamlit_app.py:                    with st.expander(f"Question {i + 1}", expanded=False):
/tmp/quiztube/streamlit_app.py-                        if ro[ua] != ca:
/tmp/quiztube/streamlit_app.py:                            st.info(f"Question: {q[0]}")
/tmp/quiztube/streamlit_app.py-                            st.error(f"Your answer: {ro[ua]}")
/tmp/quiztube/streamlit_app.py-                            st.success(f"Correct answer: {ca}")

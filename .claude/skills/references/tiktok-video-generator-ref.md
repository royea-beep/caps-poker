# Automatic Tiktok Quiz Video Generator with OpenAI and MoviePy

This Python script leverages the power of OpenAI and MoviePy to create engaging quiz videos. It randomly selects questions and answers, generates audio using OpenAI's TTS, and assembles a dynamic video with countdowns, questions, answers, and a unique visual touch. The resulting quiz video is not only visually appealing but also includes an audio component for an immersive experience.
Something like this: https://www.tiktok.com/@emilyvilaga

## Key Features:
- Random selection of questions and answers from a predefined set.
- OpenAI TTS for generating lifelike audio responses.
- Dynamic video assembly with MoviePy, including countdowns, questions, and answers.
- Integration of a unique visual element – a colored stripe highlighting the correct answer.
- Video upload to TikTok using the [TikTok uploader library](https://github.com/redrickh/tiktok-uploader) (forked version).

## Requirements:
- Python 3.6 or above
- OpenAI library
- MoviePy library
- TikTok uploader library (Forked version: [redrickh/tiktok-uploader](https://github.com/redrickh/tiktok-uploader))

## Usage:
1. Set up your OpenAI API key in the 'openai_key.py' file.
2. Ensure the required libraries are installed using the provided 'requirements.txt' file.
3. Clone the repository using the following command:
   ```bash
   git clone https://github.com/redrickh/Auto_tiktok_video_generator.git

Feel free to customize the script for your specific needs and experiment with different video templates for added variety.

*Note: Ensure you have the necessary permissions to use the OpenAI API and adhere to TikTok's policies when uploading videos.*

key = "your_key"
import time
from openai import OpenAI
from pathlib import Path
from moviepy.editor import *
from quiz_db import questions_and_answers
from moviepy.video.fx.loop import loop
from tiktok_uploader.upload import upload_video
from moviepy.audio.fx.volumex import volumex
from moviepy.video.fx.margin import margin
from openai_key import *
import random


openai_client = OpenAI(api_key=key)  # your open_ai key goes here
number_of_questions = len(questions_and_answers)
print(f"There are a total of {number_of_questions} questions in the current set.")

# Choose a random question from the list
random_question = random.choice(questions_and_answers)
quiz_question = random_question["kérdés"]  # random question from quiz_db.py


def wrap_text(text, limit):
    words = text.split(' ')
    lines = []
    current_line = []
    current_length = 0
    for word in words:
        if current_length + len(word) <= limit:
            current_length += len(word) + 1  # word length + space
            current_line.append(word)
        else:
            lines.append(' '.join(current_line))
            current_line = [word]
            current_length = len(word)
    lines.append(' '.join(current_line))  # Add remaining words
    return '\n'.join(lines)


# Create the text clip for the question, set its position
max_characters = 20

# The text wraps every 20 characters, but not mid-word
processed_text = wrap_text(quiz_question, max_characters)
# Set the fontsize based on the text length

# Dynamically calculate text position to center it
video_width = 1920
text_width = len(processed_text) * 15  # Adjust the factor based on font and size
text_position = (video_width - text_width) // 2

question = TextClip(processed_text, fontsize=60, font='Amiri-Bold', color='black').set_position(("center", 600))

# Create a list of answers
generated_text = random_question["válaszok"]  # answers from quiz_db.py
clean_answer = random_question["helyes_válasz"]  # correct answer from quiz_db.py

# Current question
print(quiz_question)
# The 'generated_text' variable contains a list of answer choices
print("Answer choices:", generated_text)

# The 'clean_answer' variable contains the correct answer
print("Correct answer:", clean_answer)

# Set the duration for the question and each answer
start_time_answer1 = 1  # start time for the FIRST answer in seconds
start_time_answer2 = 1.1  # start time for the SECOND answer in seconds
start_time_answer3 = 1.2  # start time for the THIRD answer in seconds

# Shuffle the answers
shuffled_answers = random.sample(random_question['válaszok'], len(random_question['válaszok']))

# {shuffled_answers[0]} OR {shuffled_answers[1]} OR {shuffled_answers[2]}
tts_input = f"{quiz_question}? {shuffled_answers[0]} vagy {shuffled_answers[1]} vagy {shuffled_answers[2]}"

speech_response = openai_client.audio.speech.create(
    model="tts-1-hd",
    voice="nova",
    input=f"{tts_input}?\n\n"
          f"Írd le kommentben a helyes választ, ha tudod.\n"  # Write the correct answer in the comment if you know.
)
speech_file_path = Path(__file__).parent / "generated_audio.mp3"
with open(speech_file_path, 'wb') as file:
    file.write(speech_response.content)

# Create the TextClips for each answer, with fixed labels (A, B, C) but shuffled answers
answer1 = TextClip(f"A) {shuffled_answers[0]}", fontsize=55, font='Amiri-Bold', color='black').set_start(
    start_time_answer1)
answer2 = TextClip(f"B) {shuffled_answers[1]}", fontsize=55, font='Amiri-Bold', color='black').set_start(
    start_time_answer2)
answer3 = TextClip(f"C) {shuffled_answers[2]}", fontsize=55, font='Amiri-Bold', color='black').set_start(
    start_time_answer3)

# Create a list of answers (alphabetical label order)
answers = [answer1, answer2, answer3]

# Create a list of default positions for each answer
positions = [(280, 980), (280, 1140), (280, 1300)]

# Create a list of pairs [(label, position), (label, position), (label, position)]
pairs = list(zip(answers, positions))

# Shuffle the pairs
random.shuffle(pairs)

# Load the rendered TTS audio
audio = AudioFileClip("generated_audio.mp3")

# Load the background audio and reduce its volume
background_audio = AudioFileClip("song.mp3").fx(volumex, 0.04)  # 5% of the original volume

# Get the duration of the audio
audio_duration = audio.duration

# Make sure the background_audio is the same duration as the main audio
background_audio = background_audio.subclip(0, audio_duration)

# Combine the two audio clips
composite_audio = CompositeAudioClip([background_audio, audio])

# If you want more video template
video_templates = ["quiz1.mp4", "quiz2.mp4"]
chosen_template = random.choice(video_templates)
print(chosen_template)
# Load the full video first to get its duration
full_video = VideoFileClip(chosen_template)

# Get the last 1 second (without cutting the original video)
video_last_sec = full_video.subclip(full_video.duration - 1)

# Play the whole video first (5 seconds long)
video_first_part = full_video.subclip(0, 5)

# Loop the last second of video until it matches the remaining duration of the audio
looped_video = loop(video_last_sec, duration=audio_duration - 5)


# Concatenate the first part of the video with the looped part
final_video = concatenate_videoclips([video_first_part, looped_video])

# Set the audio of the video
final_video_with_audio_and_music = final_video.set_audio(composite_audio)

# full video length, but make it shorter for the Countdown
duration = final_video.duration - 3

# Now we divide the total time by 5 (counting down from 5)
time_per_number = duration / 5

clips = []

for i in range(5, -1, -1):  # Countdown from 5 to 0
    clip = TextClip(str(i), fontsize=150, color='black').set_duration(time_per_number)
    clips.append(clip)

# Creating the countdown clip
countdown_clip = concatenate_videoclips(clips).set_pos(('center', 'bottom'))

# Setting the position of the countdown clip
countdown_clip = countdown_clip.set_position(lambda t: ('center', countdown_clip.h - -1400))

# Applying crossfade
countdown_clip = countdown_clip.crossfadein(1).crossfadeout(1)

clean_answer_pos = None
answers_texts = [f"A) {shuffled_answers[0]}", f"B) {shuffled_answers[1]}", f"C) {shuffled_answers[2]}"]

shuffled_pairs = list(zip(answers, positions, answers_texts))

for pair in shuffled_pairs:
    if clean_answer in pair[2]:
        clean_answer_pos = pair[1]
        break

if clean_answer_pos is None:
    print(f"Didn't find this answer: {clean_answer}")

random_values = random.sample(range(256), 3)  # random colours


# Setting the number of pixels per character
pix_per_char = 55

# Calculating the length of the stripe based on the length of the cleaned answer
stripe_len = len(clean_answer) * pix_per_char

# Creating a colored stripe clip with a specified length and color (green in this case)
stripe = ColorClip((stripe_len, 10), col=(0, 102, 51))

# Adjusting the position of the stripe relative to the cleaned answer position
stripe = stripe.set_position((clean_answer_pos[0], clean_answer_pos[1] + 60))

# Calculating the start time for the stripe, ensuring it begins after all previous clips
stripe_start_time = sum(clip.duration for clip in clips)

# Setting the start time and duration of the stripe to fit within the remaining duration of the final video
stripe = stripe.set_start(stripe_start_time + 1).set_duration(final_video.duration - stripe_start_time)

# Applying a crossfade effect to smoothly fade in the stripe
stripe = stripe.crossfadein(0)


# Set stripe start time
stripe_start_time = sum(clip.duration for clip in clips)

# Lay out all components to add to the video
comps = [final_video_with_audio_and_music, question.set_start(0).set_duration(audio_duration)]

# Add answers to comps with their FIXED positions
comps.extend(answer.set_position(pos).set_duration(audio_duration) for answer, pos in pairs)

comps.append(countdown_clip.set_start(0))

# Add stripe to comps
comps.append(stripe.set_start(stripe_start_time))

final_video = CompositeVideoClip(comps)
# Add the margin to the final_video
final_video = margin(final_video, 30, color=(random_values[0], random_values[1], random_values[2]))

final_video = final_video.subclip(0, final_video.duration - 1.1)

timestamp = time.time()

# Define the directory path
directory = "quiz_videos"

# Create the directory
os.makedirs(directory, exist_ok=True)

# Define the full file path with the filename
full_path = os.path.join(directory, f"quiz_output_{timestamp}.mp4")

# Save the file
final_video.write_videofile(full_path, codec="libx264")

desc_title = (f"Írj 3 releváns hastaget, plusz ezeket is add hozzá: #fyp #talaloskerdes #rejtveny #riddle"
              f" Erről a szövegről: {quiz_question}"
              f"Csak a hastageket kérem a válaszodban, vesszővel és szóközzel elválasztva egymástól!")
#  Write 3 relevant hashtags, and also add these: #fyp #riddle #puzzle #quiz
#  About this text: {quiz_question}
#  Please provide only the hashtags in your answer, separated by commas and spaces!

desc_title_text = openai_client.chat.completions.create(
    model="gpt-4-0125-preview",
    messages=[
        {"role": "user", "content": desc_title}
    ],
    max_tokens=4000,
)

desc_title_final = desc_title_text.choices[0].message.content.strip('"')
print(desc_title_final)

# single video upload
upload_video(f"{full_path}",
             description=f"Tetszett a találós kérdés? A megfejtés: {clean_answer} / {desc_title_final}",
             #  Liked the riddle? The solution: {clean_answer} / {desc_title_final}
             cookies='cookies.txt',
             browser='chrome',
             )
print("Script is finished!")
questions_and_answers = [
    {"kérdés": "Mi az, ami mindig jön, de soha nem érkezik?", "válaszok": ["holnap", "vonat", "karácsony"],
     "helyes_válasz": "holnap"},
    {"kérdés": "Mi az, ami mindig megy, de soha nem távozik?", "válaszok": ["gyalogos", "perc", "postás"],
     "helyes_válasz": "perc"},
    {"kérdés": "Mi az, ami mindig esik, de soha nem zuhan?", "válaszok": ["hó", "víz", "hőmérséklet"],
     "helyes_válasz": "hőmérséklet"},
    {"kérdés": "Mi az, ami mindig száll, de soha nem repül?", "válaszok": ["por", "madár", "lufi"],
     "helyes_válasz": "por"},
    {"kérdés": "Mi az, ami mindig fut, de soha nem izzad?", "válaszok": ["hűtő", "sportoló", "patak"],
     "helyes_válasz": "hűtő"},
    {"kérdés": "Mi az, ami mindig ugrik, de soha nem szökik?", "válaszok": ["labda", "nyúl", "pulzus"],
     "helyes_válasz": "labda"},
    {"kérdés": "Mi az, ami mindig sír, de soha nem bánkódik?", "válaszok": ["baba", "hagyma", "gitár"],
     "helyes_válasz": "hagyma"},
    {"kérdés": "Mi az, ami mindig nevet, de soha nem vidám?", "válaszok": ["bohóc", "kacagófű", "nevetőgáz"],
     "helyes_válasz": "kacagófű"},
    {"kérdés": "Mi az, ami mindig alszik, de soha nem álmodik?", "válaszok": ["macska", "kő", "telefon"],
     "helyes_válasz": "kő"},
    {"kérdés": "Mi az, ami mindig ébren van, de soha nem figyel?", "válaszok": ["kamera", "tanár", "szem"],
     "helyes_válasz": "szem"},
    {"kérdés": "Mi az, ami mindig beszél, de soha nem hallgat?", "válaszok": ["rádió", "papagáj", "gyerek"],
     "helyes_válasz": "rádió"},
    {"kérdés": "Mi az, ami mindig hallgat, de soha nem beszél?", "válaszok": ["fül", "fal", "titok"],
     "helyes_válasz": "titok"},
    {"kérdés": "Mi az, ami mindig énekel, de soha nem dalol?",
     "válaszok": ["csalogány", "mikrofon", "csengőhang"], "helyes_válasz": "mikrofon"},
    {"kérdés": "Mi az, ami mindig dalol, de soha nem énekel?", "válaszok": ["fülemüle", "kazetta", "himnusz"],
     "helyes_válasz": "himnusz"},
    {"kérdés": "Mi az, ami mindig játszik, de soha nem unatkozik?", "válaszok": ["kutya", "játék", "színész"],
     "helyes_válasz": "játék"},
    {"kérdés": "Mi az, ami mindig unatkozik, de soha nem játszik?", "válaszok": ["tanuló", "könyv", "várakozó"],
     "helyes_válasz": "várakozó"},
    {"kérdés": "Mi az, ami mindig tanul, de soha nem tud?", "válaszok": ["számítógép", "diák", "lexikon"],
     "helyes_válasz": "számítógép"},
    {"kérdés": "Mi az, ami mindig tud, de soha nem tanul?", "válaszok": ["professzor", "bölcs", "természet"],
     "helyes_válasz": "természet"},
    {"kérdés": "Mi az, ami mindig kérdez, de soha nem válaszol?", "válaszok": ["fejtörő", "gyerek", "telefon"],
     "helyes_válasz": "fejtörő"},
    {"kérdés": "Mi az, ami mindig válaszol, de soha nem kérdez?", "válaszok": ["Copilot", "tükör", "papír"],
     "helyes_válasz": "tükör"},
    {"kérdés": "Mi az, ami mindig segít, de soha nem kér segítséget?", "válaszok": ["barát", "szerszám", "mentő"],
     "helyes_válasz": "szerszám"},
    {"kérdés": "Mi az, ami mindig kér segítséget, de soha nem segít?",
     "válaszok": ["bajba jutott", "koldus", "feladat"], "helyes_válasz": "feladat"},
    {"kérdés": "Mi az, ami mindig ad, de soha nem kap?", "válaszok": ["fa", "nap", "bank"],
     "helyes_válasz": "nap"},
    {"kérdés": "Mi az, ami mindig kap, de soha nem ad?", "válaszok": ["tolvaj", "gyűjtő", "lyuk"],
     "helyes_válasz": "lyuk"},
    {"kérdés": "Mi az, ami mindig oszt, de soha nem szoroz?", "válaszok": ["matematika", "kenyér", "lapát"],
     "helyes_válasz": "matematika"},
    {"kérdés": "Mi az, ami mindig szoroz, de soha nem oszt?", "válaszok": ["baktérium", "szám", "család"],
     "helyes_válasz": "baktérium"},
    {"kérdés": "Mi az, ami mindig hozzáad, de soha nem von ki?",
     "válaszok": ["növekedés", "kalória", "születésnap"], "helyes_válasz": "születésnap"},
    {"kérdés": "Mi az, ami mindig kivon, de soha nem hozzáad?", "válaszok": ["halál", "kölcsön", "fogyás"],
     "helyes_válasz": "fogyás"},
    {"kérdés": "Mi az, ami mindig összetart, de soha nem ragaszt?",
     "válaszok": ["barátság", "mágnes", "gravitáció"], "helyes_válasz": "mágnes"},
    {"kérdés": "Mi az, ami mindig ragaszt, de soha nem összetart?", "válaszok": ["ragasztó", "méz", "rágógumi"],
     "helyes_válasz": "ragasztó"},
    {"kérdés": "Mi az, ami mindig szép, de soha nem csinos?", "válaszok": ["virág", "táj", "művészet"],
     "helyes_válasz": "virág"},
    {"kérdés": "Mi az, ami mindig csinos, de soha nem szép?", "válaszok": ["smink", "ruha", "cipő"],
     "helyes_válasz": "smink"},
    {"kérdés": "Mi az, ami mindig erős, de soha nem kemény?", "válaszok": ["szél", "hang", "hit"],
     "helyes_válasz": "szél"},
    {"kérdés": "Mi az, ami mindig kemény, de soha nem erős?", "válaszok": ["kő", "jég", "dió"],
     "helyes_válasz": "kő"},
    {"kérdés": "Mi az, ami mindig puha, de soha nem gyenge?", "válaszok": ["toll", "pamut", "felhő"],
     "helyes_válasz": "toll"},
    {"kérdés": "Mi az, ami mindig gyenge, de soha nem puha?", "válaszok": ["fény", "jel", "remény"],
     "helyes_válasz": "fény"},
    {"kérdés": "Mi az, ami mindig hideg, de soha nem fagy?", "válaszok": ["jégkrém", "hűtő", "hold"],
     "helyes_válasz": "hold"},
    {"kérdés": "Mi az, ami mindig fagy, de soha nem hideg?",
     "válaszok": ["fagylalt", "fagyott zöldség", "fagyott víz"], "helyes_válasz": "fagyott víz"},
    {"kérdés": "Mi az, ami mindig meleg, de soha nem forró?", "válaszok": ["tea", "test", "szív"],
     "helyes_válasz": "tea"},
    {"kérdés": "Mi az, ami mindig forró, de soha nem meleg?", "válaszok": ["tűz", "láva", "villám"],
     "helyes_válasz": "tűz"},
    {"kérdés": "Mi az, ami mindig szúr, de soha nem sebez?", "válaszok": ["tű", "tövis", "kérdés"],
     "helyes_válasz": "kérdés"},
    {"kérdés": "Mi az, ami mindig sebez, de soha nem szúr?", "válaszok": ["kés", "szó", "fagy"],
     "helyes_válasz": "szó"},
    {"kérdés": "Mi az, ami mindig csíp, de soha nem harap?", "válaszok": ["szúnyog", "bors", "csipesz"],
     "helyes_válasz": "szúnyog"},
    {"kérdés": "Mi az, ami mindig harap, de soha nem csíp?", "válaszok": ["kutya", "fogó", "pirája"],
     "helyes_válasz": "kutya"},
    {"kérdés": "Mi az, ami mindig fúj, de soha nem fújja el?", "válaszok": ["szél", "trombita", "gyertya"],
     "helyes_válasz": "szél"},
    {"kérdés": "Mi az, ami mindig elfújja, de soha nem fúj?", "válaszok": ["száj", "ventilátor", "robbanás"],
     "helyes_válasz": "száj"},
    {"kérdés": "Mi az, ami mindig lobog, de soha nem ég?", "válaszok": ["zászló", "tűz", "haj"],
     "helyes_válasz": "zászló"},
    {"kérdés": "Mi az, ami mindig ég, de soha nem lobog?", "válaszok": ["nap", "gyufa", "lámpa"],
     "helyes_válasz": "nap"},
    {"kérdés": "Mi az, ami mindig világít, de soha nem ragyog?", "válaszok": ["csillag", "hold", "LED"],
     "helyes_válasz": "csillag"},
    {"kérdés": "Mi az, ami mindig ragyog, de soha nem világít?", "válaszok": ["gyémánt", "tükör", "hó"],
     "helyes_válasz": "gyémánt"},
    {"kérdés": "Mi az, ami mindig sötét, de soha nem fekete?", "válaszok": ["szem", "Az éjszaka", "Az árnyék"],
     "helyes_válasz": "Az éjszaka"},
    {"kérdés": "Mi az, ami mindig színes, de soha nem fest?",
     "válaszok": ["szivárvány", "virág", "paletta"],
     "helyes_válasz": "szivárvány"},
    {"kérdés": "Mi az, ami mindig fest, de soha nem színes?",
     "válaszok": ["festő", "hajfesték", "festékszóró"],
     "helyes_válasz": "festő"},
    {"kérdés": "Mi az, ami mindig rajzol, de soha nem színez?",
     "válaszok": ["ceruza", "vonalzó", "radír"],
     "helyes_válasz": "ceruza"},
    {"kérdés": "Mi az, ami mindig színez, de soha nem rajzol?",
     "válaszok": ["filctoll", "színező", "színes ceruza"],
     "helyes_válasz": "filctoll"},
    {"kérdés": "Mi az, ami mindig ír, de soha nem olvas?",
     "válaszok": ["toll", "gép", "kéz"],
     "helyes_válasz": "toll"},
    {"kérdés": "Mi az, ami mindig olvas, de soha nem ír?",
     "válaszok": ["szem", "könyv", "szkenner"],
     "helyes_válasz": "szem"},
    {"kérdés": "Mi az, ami mindig nyomtat, de soha nem másol?",
     "válaszok": ["nyomtató", "sajtó", "bélyeg"],
     "helyes_válasz": "nyomtató"},
    {"kérdés": "Mi az, ami mindig másol, de soha nem nyomtat?",
     "válaszok": ["tanuló", "másoló", "DNS"],
     "helyes_válasz": "másoló"},
    {"kérdés": "Mi az, ami mindig számol, de soha nem számít?",
     "válaszok": ["számológép", "pénztáros", "stopper"],
     "helyes_válasz": "számológép"},
    {"kérdés": "Mi az, ami mindig számít, de soha nem számol?",
     "válaszok": ["logika", "vélemény", "döntés"],
     "helyes_válasz": "logika"},
    {"kérdés": "Mi az, ami mindig mér, de soha nem mért?",
     "válaszok": ["mérleg", "mérőszalag", "hőmérő"],
     "helyes_válasz": "mérleg"},
    {"kérdés": "Mi az, ami mindig mért, de soha nem mér?",
     "válaszok": ["távolság", "terület", "súly"],
     "helyes_válasz": "távolság"},
    {"kérdés": "Mi az, ami mindig kever, de soha nem keveredik?",
     "válaszok": ["kanál", "mixer", "koktél"],
     "helyes_válasz": "kanál"},
    {"kérdés": "Mi az, ami mindig keveredik, de soha nem kever?",
     "válaszok": ["nyelv", "vér", "szín"],
     "helyes_válasz": "nyelv"},
    {"kérdés": "Mi az, ami mindig mos, de soha nem tisztít?",
     "válaszok": ["mosógép", "mosogató", "mosoly"],
     "helyes_válasz": "mosógép"},
    {"kérdés": "Mi az, ami mindig tisztít, de soha nem mos?",
     "válaszok": ["seprű", "fertőtlenítő", "fogkefe"],
     "helyes_válasz": "seprű"},
    {"kérdés": "Mi az, ami mindig szárít, de soha nem nedvesít?",
     "válaszok": ["szárítógép", "nap", "törölköző"],
     "helyes_válasz": "szárítógép"},
    {"kérdés": "Mi az, ami mindig nedvesít, de soha nem szárít?",
     "válaszok": ["víz", "nyál", "pára"],
     "helyes_válasz": "pára"},
    {"kérdés": "Mi az, ami mindig nedves, de soha nem ázik?",
     "válaszok": ["hal", "jég", "vízesés"],
     "helyes_válasz": "hal"},
    {"kérdés": "Mi az, ami mindig ázik, de soha nem nedves?",
     "válaszok": ["szivacs", "ruha", "papír"],
     "helyes_válasz": "szivacs"},
    {"kérdés": "Mi az, ami mindig száraz, de soha nem szomjas?",
     "válaszok": ["sivatag", "kenyér", "homok"],
     "helyes_válasz": "sivatag"},
    {"kérdés": "Mi az, ami mindig szomjas, de soha nem száraz?",
     "válaszok": ["kaktusz", "kaméleon", "szivacs"],
     "helyes_válasz": "kaktusz"},
    {"kérdés": "Mi az, ami mindig éhes, de soha nem jóllakott?",
     "válaszok": ["tűz", "farkas", "féreg"],
     "helyes_válasz": "tűz"},
    {"kérdés": "Mi az, ami mindig jóllakott, de soha nem éhes?",
     "válaszok": ["hordó", "pénztárca", "medve"],
     "helyes_válasz": "hordó"},
    {"kérdés": "Mi az, ami mindig nő, de soha nem öregszik?",
     "válaszok": ["fa", "haj", "gyűrű"],
     "helyes_válasz": "fa"},
    {"kérdés": "Mi az, ami mindig öregszik, de soha nem nő?",
     "válaszok": ["bőr", "sajt", "fénykép"],
     "helyes_válasz": "bőr"},
    {"kérdés": "Mi az, ami mindig fiatal, de soha nem születik?",
     "válaszok": ["víz", "csillag", "gyermek"],
     "helyes_válasz": "gyermek"},
    {"kérdés": "Mi az, ami mindig születik, de soha nem fiatal?",
     "válaszok": ["nap", "virág", "pillangó"],
     "helyes_válasz": "pillangó"},
    {"kérdés": "Mi az, ami mindig lát, de soha nem néz?", "válaszok": ["kamera", "szem", "fény"],
     "helyes_válasz": "fény"},
    {"kérdés": "Mi az, ami mindig néz, de soha nem lát?", "válaszok": ["vak", "tükör", "szobor"],
     "helyes_válasz": "tükör"},
    {"kérdés": "Mi az, ami mindig hall, de soha nem figyel?", "válaszok": ["fül", "rádió", "fal"],
     "helyes_válasz": "fal"},
    {"kérdés": "Mi az, ami mindig figyel, de soha nem hall?", "válaszok": ["szem", "kamera", "növény"],
     "helyes_válasz": "növény"},
    {"kérdés": "Mi az, ami mindig érez, de soha nem érint?", "válaszok": ["szív", "lélek", "fájdalom"],
     "helyes_válasz": "fájdalom"},
    {"kérdés": "Mi az, ami mindig érint, de soha nem érez?", "válaszok": ["kéz", "víz", "gomb"],
     "helyes_válasz": "gomb"},
    {"kérdés": "Mi az, ami mindig gondolkodik, de soha nem tud?", "válaszok": ["számítógép", "fejtörő", "gyerek"],
     "helyes_válasz": "számítógép"},
    {"kérdés": "Mi az, ami mindig tud, de soha nem gondolkodik?", "válaszok": ["lexikon", "bölcs", "természet"],
     "helyes_válasz": "lexikon"},
    {"kérdés": "Mi az, ami mindig akar, de soha nem cselekszik?", "válaszok": ["vágy", "terv", "remény"],
     "helyes_válasz": "remény"},
    {"kérdés": "Mi az, ami mindig cselekszik, de soha nem akar?", "válaszok": ["robot", "reflex", "gravitáció"],
     "helyes_válasz": "reflex"},
    {"kérdés": "Mi az, ami mindig mozgat, de soha nem mozog?", "válaszok": ["motor", "zene", "szél"],
     "helyes_válasz": "zene"},
    {"kérdés": "Mi az, ami mindig mozog, de soha nem mozgat?", "válaszok": ["folyó", "hold", "labda"],
     "helyes_válasz": "hold"},
    {"kérdés": "Mi az, ami mindig áll, de soha nem ül?", "válaszok": ["láb", "fa", "szék"],
     "helyes_válasz": "fa"},
    {"kérdés": "Mi az, ami mindig ül, de soha nem áll?", "válaszok": ["macska", "tojás", "kanapé"],
     "helyes_válasz": "tojás"},
    {"kérdés": "Mi az, ami mindig fekszik, de soha nem alszik?", "válaszok": ["padló", "híd", "halott"],
     "helyes_válasz": "híd"},
    {"kérdés": "Mi az, ami mindig alszik, de soha nem fekszik?", "válaszok": ["macska", "denevér", "telefon"],
     "helyes_válasz": "denevér"},
    {"kérdés": "Mi az, ami mindig jár, de soha nem fut?", "válaszok": ["gyalogos", "Az óra", "csiga"],
     "helyes_válasz": "Az óra"},
    {"kérdés": "Mi az, ami mindig fut, de soha nem jár?", "válaszok": ["sportoló", "víz", "vér"],
     "helyes_válasz": "vér"},
    {"kérdés": "Mi az, ami mindig repül, de soha nem száll?", "válaszok": ["madár", "repülő", "papírsárkány"],
     "helyes_válasz": "papírsárkány"},
    {"kérdés": "Mi az, ami mindig száll, de soha nem repül?", "válaszok": ["por", "lufi", "helikopter"],
     "helyes_válasz": "lufi"},
    {"kérdés": "Mi az, ami mindig dob, de soha nem fog?", "válaszok": ["kéz", "dob", "kocka"],
     "helyes_válasz": "dob"},
    {"kérdés": "Mi az, ami mindig fog, de soha nem dob?", "válaszok": ["fogó", "fog", "csapda"],
     "helyes_válasz": "fog"},
    {"kérdés": "Mi az, ami mindig húz, de soha nem tol?", "válaszok": ["ló", "mágnes", "kötél"],
     "helyes_válasz": "mágnes"},
    {"kérdés": "Mi az, ami mindig tol, de soha nem húz?", "válaszok": ["tolóajtó", "rakéta", "szánkó"],
     "helyes_válasz": "rakéta"},
    {"kérdés": "Mi az, ami mindig nyit, de soha nem zár?", "válaszok": ["szem", "száj", "virág"],
     "helyes_válasz": "virág"},
    {"kérdés": "Mi az, ami mindig zár, de soha nem nyit?", "válaszok": ["lakat", "seb", "titok"],
     "helyes_válasz": "seb"},
    {"kérdés": "Mi az, ami mindig forog, de soha nem fordul?", "válaszok": ["kerék", "bolygó", "korong"],
     "helyes_válasz": "bolygó"},
    {"kérdés": "Mi az, ami mindig fordul, de soha nem forog?", "válaszok": ["kanyar", "lapát", "kulcs"],
     "helyes_válasz": "kanyar"},
    {"kérdés": "Mi az, ami mindig billen, de soha nem dől?", "válaszok": ["hinta", "billentyű", "mérleg"],
     "helyes_válasz": "billentyű"},
    {"kérdés": "Mi az, ami mindig dől, de soha nem billen?", "válaszok": ["torony", "fa", "dominó"],
     "helyes_válasz": "torony"},
    {"kérdés": "Mi az, ami mindig ugyanaz marad, akárhogy is forgatod?", "válaszok": ["kör", "labda", "kocka"],
     "helyes_válasz": "kör"},
    {"kérdés": "Mi az, ami mindig változik, akárhogy is állítod be?", "válaszok": ["óra", "hőmérő", "időjárás"],
     "helyes_válasz": "időjárás"},
    {"kérdés": "Mi az, ami mindig egyenlő, akárhogy is osztod el?", "válaszok": ["süti", "pénz", "pi"],
     "helyes_válasz": "pi"},
    {"kérdés": "Mi az, ami mindig kettő, akárhogy is szorozod?", "válaszok": ["nulla", "egy", "kettő"],
     "helyes_válasz": "egy"},
    {"kérdés": "Mi az, ami mindig nulla, akárhogy is hozzáadsz?", "válaszok": ["nulla", "végtelen", "negatív"],
     "helyes_válasz": "nulla"},
    {"kérdés": "Mi az, ami mindig végtelen, akárhogy is kivonod?", "válaszok": ["nulla", "végtelen", "negatív"],
     "helyes_válasz": "végtelen"},
    {"kérdés": "Mi az, ami mindig negatív, akárhogy is átalakítod?", "válaszok": ["nulla", "végtelen", "negatív"],
     "helyes_válasz": "negatív"},
    {"kérdés": "Mi az, ami mindig egyforma, akárhogy is rendezed?", "válaszok": ["betű", "szám", "szín"],
     "helyes_válasz": "szín"},
    {"kérdés": "Mi az, ami mindig más, akárhogy is kevered?", "válaszok": ["kártya", "szó", "hang"],
     "helyes_válasz": "hang"},
    {"kérdés": "Mi az, ami mindig több, akárhogy is veszel belőle?", "válaszok": ["adósság", "tudás", "életkor"],
     "helyes_válasz": "adósság"},
    {"kérdés": "Mi az, ami mindig kevesebb, akárhogy is adsz hozzá?", "válaszok": ["távolság", "idő", "sebesség"],
     "helyes_válasz": "távolság"},
    {"kérdés": "Mi az, ami mindig nagyobb, akárhogy is osztod?", "válaszok": ["tér", "súly", "erő"],
     "helyes_válasz": "tér"},
    {"kérdés": "Mi az, ami mindig kisebb, akárhogy is szorozod?", "válaszok": ["tizedes", "százalék", "tört"],
     "helyes_válasz": "tizedes"},
    {"kérdés": "Mi az, ami mindig egyenlőtlen, akárhogy is igazítod?", "válaszok": ["mérleg", "vonalzó", "libra"],
     "helyes_válasz": "libra"},
    {"kérdés": "Mi az, ami mindig egyenes, akárhogy is hajtogatod?", "válaszok": ["papír", "fény", "vasaló"],
     "helyes_válasz": "fény"},
    {"kérdés": "Mi az, ami mindig görbe, akárhogy is nyújtod?", "válaszok": ["gumi", "banán", "íj"],
     "helyes_válasz": "banán"},
    {"kérdés": "Mi az, ami mindig lapos, akárhogy is fújod?", "válaszok": ["lufi", "lemez", "lapát"],
     "helyes_válasz": "lemez"},
    {"kérdés": "Mi az, ami mindig magas, akárhogy is méred?", "válaszok": ["torony", "hegy", "óriás"],
     "helyes_válasz": "óriás"},
    {"kérdés": "Mi az, ami mindig alacsony, akárhogy is növeszted?", "válaszok": ["törpe", "fű", "csiga"],
     "helyes_válasz": "csiga"},
    {"kérdés": "Mi az, ami mindig nehéz, akárhogy is emeled?", "válaszok": ["vas", "kő", "elefánt"],
     "helyes_válasz": "elefánt"},
    {"kérdés": "Mi az, ami mindig könnyű, akárhogy is nyomod?", "válaszok": ["pamut", "paplan", "párnacsata"],
     "helyes_válasz": "párnacsata"},
    {"kérdés": "Mi az, ami mindig hosszabb, akárhogy is rövidíted?", "válaszok": ["év", "hónap", "nap"],
     "helyes_válasz": "év"},
    {"kérdés": "Mi az, ami mindig rövidebb, akárhogy is hosszabbítod?", "válaszok": ["óra", "perc", "másodperc"],
     "helyes_válasz": "másodperc"},
    {"kérdés": "Mi az, ami mindig gyorsabb, akárhogy is lassítod?", "válaszok": ["fény", "hang", "gondolat"],
     "helyes_válasz": "fény"},
    {"kérdés": "Mi az, ami mindig erősebb, akárhogy is gyengíted?", "válaszok": ["mágnes", "ragasztó", "szerelem"],
     "helyes_válasz": "szerelem"},
    {"kérdés": "Mi az, ami mindig gyengébb, akárhogy is erősíted?", "válaszok": ["jel", "hangya", "remény"],
     "helyes_válasz": "jel"},
    {"kérdés": "Mi az, ami mindig melegebb, akárhogy is hűtöd?", "válaszok": ["láva", "tűz", "vulkán"],
     "helyes_válasz": "vulkán"},
    {"kérdés": "Mi az, ami mindig hidegebb, akárhogy is melegíted?", "válaszok": ["jég", "hó", "gleccser"],
     "helyes_válasz": "gleccser"},
    {"kérdés": "Mi az, ami mindig sötétebb, akárhogy is világítod?", "válaszok": ["éjszaka", "barlang", "fekete lyuk"],
     "helyes_válasz": "fekete lyuk"},
    {"kérdés": "Mi az, ami mindig világosabb, akárhogy is árnyékolod?", "válaszok": ["nap", "csillag", "fény"],
     "helyes_válasz": "fény"},
    {"kérdés": "Mi az, ami mindig élesebb, akárhogy is tompítod?", "válaszok": ["kés", "olló", "tű"],
     "helyes_válasz": "tű"},
    {"kérdés": "Mi az, ami mindig tompább, akárhogy is élesíted?", "válaszok": ["ceruza", "köröm", "fog"],
     "helyes_válasz": "fog"},
    {"kérdés": "Mi az, ami mindig színesebb, akárhogy is fested?", "válaszok": ["szivárvány", "virág", "pillangó"],
     "helyes_válasz": "szivárvány"},
    {"kérdés": "Mi az, ami mindig szürkébb, akárhogy is színezed?", "válaszok": ["elefánt", "egér", "hamu"],
     "helyes_válasz": "hamu"},
    {"kérdés": "Mi az, ami mindig üres, akárhogy is töltöd?", "válaszok": ["pohár", "üveg", "lyuk"],
     "helyes_válasz": "lyuk"},
    {"kérdés": "Mi az, ami mindig tele, akárhogy is üríted?", "válaszok": ["doboz", "zsák", "tenger"],
     "helyes_válasz": "tenger"},
    {"kérdés": "Mi az, ami mindig nyitott, akárhogy is zárod?", "válaszok": ["ajtó", "ablak", "szem"],
     "helyes_válasz": "szem"},
    {"kérdés": "Mi az, ami mindig lila, de soha nem szőlő?", "válaszok": ["ibolya", "bogyó", "hercegnő"],
     "helyes_válasz": "hercegnő"},
    {"kérdés": "Mi az, ami mindig szürke, de soha nem elefánt?", "válaszok": ["hamu", "egér", "beton"],
     "helyes_válasz": "beton"},
    {"kérdés": "Mi az, ami mindig arany, de soha nem ékszer?", "válaszok": ["medál", "korona", "medve"],
     "helyes_válasz": "medve"},
    {"kérdés": "Mi az, ami mindig ezüst, de soha nem pénz?", "válaszok": ["tükör", "hold", "golyó"],
     "helyes_válasz": "hold"},
    {"kérdés": "Mi az, ami mindig bronz, de soha nem érem?", "válaszok": ["szobor", "barna", "csillár"],
     "helyes_válasz": "szobor"},
    {"kérdés": "Mi az, ami mindig üveg, de soha nem törékeny?", "válaszok": ["ablak", "üveg", "lencse"],
     "helyes_válasz": "lencse"},
    {"kérdés": "Mi az, ami mindig fa, de soha nem növény?", "válaszok": ["asztal", "ceruza", "fa"],
     "helyes_válasz": "fa"},
    {"kérdés": "Mi az, ami mindig műanyag, de soha nem játék?", "válaszok": ["flakon", "kártya", "műfogsor"],
     "helyes_válasz": "műfogsor"},
    {"kérdés": "Mi az, ami mindig fém, de soha nem vas?", "válaszok": ["arany", "alumínium", "mágnes"],
     "helyes_válasz": "alumínium"},
    {"kérdés": "Mi az, ami mindig víz, de soha nem folyékony?", "válaszok": ["jég", "gőz", "hó"],
     "helyes_válasz": "jég"},
    {"kérdés": "Mi az, ami mindig levegő, de soha nem látható?", "válaszok": ["oxigén", "szél", "lélegzet"],
     "helyes_válasz": "oxigén"},
    {"kérdés": "Mi az, ami mindig tűz, de soha nem meleg?", "válaszok": ["gyertya", "sárkány", "tűzijáték"],
     "helyes_válasz": "tűzijáték"},
    {"kérdés": "Mi az, ami mindig föld, de soha nem piszkos?", "válaszok": ["bolygó", "homok", "agyag"],
     "helyes_válasz": "bolygó"},
    {"kérdés": "Mi az, ami mindig éter, de soha nem létezik?", "válaszok": ["lélek", "álom", "mágia"],
     "helyes_válasz": "mágia"},
    {"kérdés": "Mi az, ami mindig kő, de soha nem kemény?", "válaszok": ["gyémánt", "márvány", "kavics"],
     "helyes_válasz": "kavics"},
    {"kérdés": "Mi az, ami mindig papír, de soha nem írható?", "válaszok": ["pénz", "jegyzet", "repülő"],
     "helyes_válasz": "repülő"},
    {"kérdés": "Mi az, ami mindig betű, de soha nem olvasható?", "válaszok": ["ABC", "DNA", "SMS"],
     "helyes_válasz": "DNA"},
    {"kérdés": "Mi az, ami mindig szám, de soha nem számolható?", "válaszok": ["nulla", "végtelen", "pi"],
     "helyes_válasz": "végtelen"},
    {"kérdés": "Mi az, ami mindig forma, de soha nem alakítható?", "válaszok": ["kör", "négyzet", "háromszög"],
     "helyes_válasz": "kör"},
    {"kérdés": "Mi az, ami mindig szín, de soha nem festhető?", "válaszok": ["fekete", "fehér", "szürke"],
     "helyes_válasz": "fekete"},
    {"kérdés": "Mi az, ami mindig hang, de soha nem hallható?", "válaszok": ["ultrahang", "infrhang", "rezgés"],
     "helyes_válasz": "ultrahang"},
    {"kérdés": "Mi az, ami mindig fény, de soha nem világít?", "válaszok": ["lámpa", "csillag", "tükör"],
     "helyes_válasz": "tükör"},
    {"kérdés": "Mi az, ami mindig árnyék, de soha nem sötét?", "válaszok": ["napernyő", "szemüveg", "függöny"],
     "helyes_válasz": "szemüveg"},
    {"kérdés": "Mi az, ami mindig üzenet, de soha nem mondható?", "válaszok": ["kép", "jel", "titok"],
     "helyes_válasz": "titok"},
    {"kérdés": "Mi az, ami mindig kérdés, de soha nem válaszolható?", "válaszok": ["miért", "hogyan", "mikor"],
     "helyes_válasz": "miért"},
    {"kérdés": "Mi az, ami mindig válasz, de soha nem kérdezhető?", "válaszok": ["igen", "nem", "talán"],
     "helyes_válasz": "talán"},
    {"kérdés": "Mi az, ami mindig játék, de soha nem szórakoztató?", "válaszok": ["sakk", "kártya", "háború"],
     "helyes_válasz": "háború"},
    {"kérdés": "Mi az, ami mindig dal, de soha nem énekelhető?", "válaszok": ["himnusz", "rap", "csend"],
     "helyes_válasz": "csend"},
    {"kérdés": "Mi az, ami mindig vers, de soha nem rímelhető?", "válaszok": ["szabadvers", "haiku", "limerick"],
     "helyes_válasz": "haiku"},
    {"kérdés": "Mi az, ami mindig szó, de soha nem írható?", "válaszok": ["suttogás", "kiáltás", "csók"],
     "helyes_válasz": "csók"},
    {"kérdés": "Mi az, ami mindig mondat, de soha nem mondható?", "válaszok": ["parancs", "kívánság", "titok"],
     "helyes_válasz": "kívánság"},
    {"kérdés": "Mi a következő betű ebben a sorozatban: B, D, F, H, ...", "válaszok": ["I", "J", "K"],
     "helyes_válasz": "J"},
    {"kérdés": "Mi a legjobb analógia erre: Madár : Repül :: Hal : ...", "válaszok": ["Úszik", "Esik", "Fúj"],
     "helyes_válasz": "Úszik"},
    {"kérdés": "Mi a következő betű ebben a sorozatban: Z, X, V, T, ...", "válaszok": ["R", "S", "U"],
     "helyes_válasz": "R"},
    {"kérdés": "Mi a legjobb analógia erre: Nap : Ég :: Hold : ...", "válaszok": ["Csillag", "Éjszaka", "Föld"],
     "helyes_válasz": "Éjszaka"},
    {"kérdés": "Mi a következő betű ebben a sorozatban: M, O, Q, S, ...", "válaszok": ["T", "U", "V"],
     "helyes_válasz": "U"},
    {"kérdés": "Mi a legjobb analógia erre: Alma : Piros :: Banán : ...", "válaszok": ["Sárga", "Zöld", "Kék"],
     "helyes_válasz": "Sárga"},
    {"kérdés": "Mi a következő betű ebben a sorozatban: C, F, I, L, ...", "válaszok": ["M", "N", "O"],
     "helyes_válasz": "O"},
    {"kérdés": "Mi a legjobb analógia erre: Tél : Hideg :: Nyár : ...", "válaszok": ["Meleg", "Napos", "Szép"],
     "helyes_válasz": "Meleg"},
    {"kérdés": "Mi a következő betű ebben a sorozatban: W, U, S, Q, ...", "válaszok": ["O", "P", "R"],
     "helyes_válasz": "O"},
    {"kérdés": "Mi a legjobb analógia erre: Kávé : Fekete :: Tej : ...", "válaszok": ["Fehér", "Kék", "Barna"],
     "helyes_válasz": "Fehér"},
    {"kérdés": "Mi a következő betű ebben a sorozatban: Y, V, S, P, ...", "válaszok": ["M", "N", "O"],
     "helyes_válasz": "N"},
    {"kérdés": "Mi a legjobb analógia erre: Cukor : Édes :: Só : ...", "válaszok": ["Sós", "Savanyú", "Csípős"],
     "helyes_válasz": "Sós"},
    {"kérdés": "Mi a következő betű ebben a sorozatban: D, G, J, M, ...", "válaszok": ["N", "O", "P"],
     "helyes_válasz": "P"},
    {"kérdés": "Mi a legjobb analógia erre: Kígyó : Csúszik :: Nyúl : ...", "válaszok": ["Ugrál", "Fut", "Rág"],
     "helyes_válasz": "Ugrál"},
    {"kérdés": "Mi a következő betű ebben a sorozatban: E, H, K, N, ...", "válaszok": ["O", "Q", "R"],
     "helyes_válasz": "Q"},
    {"kérdés": "Mi a legjobb analógia erre: Kéz : Ujj :: Láb : ...", "válaszok": ["Lábujj", "Sarok", "Boka"],
     "helyes_válasz": "Lábujj"},
    {"kérdés": "Mi a következő betű ebben a sorozatban: F, I, L, O, ...", "válaszok": ["P", "R", "S"],
     "helyes_válasz": "R"},
    {"kérdés": "Mi a legjobb analógia erre: Szem : Lát :: Fül : ...", "válaszok": ["Hall", "Érez", "Szagol"],
     "helyes_válasz": "Hall"},
    {"kérdés": "Mi a következő betű ebben a sorozatban: G, J, M, P, ...", "válaszok": ["Q", "S", "T"],
     "helyes_válasz": "S"},
    {"kérdés": "Mi a legjobb analógia erre: Olló : Vág :: Toll : ...", "válaszok": ["Ír", "Rajzol", "Szúr"],
     "helyes_válasz": "Ír"},
    {"kérdés": "Mi a következő betű ebben a sorozatban: H, K, N, Q, ...", "válaszok": ["R", "T", "U"],
     "helyes_válasz": "T"},
    {"kérdés": "Mi a legjobb analógia erre: Ég : Kék :: Fű : ...", "válaszok": ["Zöld", "Sárga", "Barna"],
     "helyes_válasz": "Zöld"},
    {"kérdés": "Mi a következő betű ebben a sorozatban: I, L, O, S, ...", "válaszok": ["T", "U", "V"],
     "helyes_válasz": "V"},
    {"kérdés": "Mi a legjobb analógia erre: Virág : Illat :: Méz : ...", "válaszok": ["Íz", "Szín", "Tapintás"],
     "helyes_válasz": "Íz"},
    {"kérdés": "Mi a következő betű ebben a sorozatban: J, M, P, S, ...", "válaszok": ["T", "U", "V"],
     "helyes_válasz": "V"},
    {"kérdés": "Mi a legjobb analógia erre: Szív : Vér :: Tüdő : ...", "válaszok": ["Levegő", "Oxigén", "Szén-dioxid"],
     "helyes_válasz": "Levegő"},
    {"kérdés": "Mi a következő betű ebben a sorozatban: K, O, S, W, ...", "válaszok": ["X", "Y", "Z"],
     "helyes_válasz": "Z"},
    {"kérdés": "Mi a legjobb analógia erre: Ház : Fal :: Ruha : ...", "válaszok": ["Anyag", "Cipzár", "Gomb"],
     "helyes_válasz": "Anyag"},
    {"kérdés": "Mi a következő betű ebben a sorozatban: L, P, S, X, ...", "válaszok": ["A", "B", "C"],
     "helyes_válasz": "A"},
    {"kérdés": "Mi a legjobb analógia erre: Eső : Nedves :: Hó : ...", "válaszok": ["Hideg", "Fehér", "Puha"],
     "helyes_válasz": "Fehér"},
    {"kérdés": "Mi a következő betű ebben a sorozatban: M, R, V, A, ...", "válaszok": ["D", "E", "F"],
     "helyes_válasz": "E"},

]
key = "your_key"
import time
from openai import OpenAI
from pathlib import Path
from moviepy.editor import *
from quiz_db import questions_and_answers
from moviepy.video.fx.loop import loop
from tiktok_uploader.upload import upload_video
from moviepy.audio.fx.volumex import volumex
from moviepy.video.fx.margin import margin
from openai_key import *
import random


openai_client = OpenAI(api_key=key)  # your open_ai key goes here
number_of_questions = len(questions_and_answers)
print(f"There are a total of {number_of_questions} questions in the current set.")

# Choose a random question from the list
random_question = random.choice(questions_and_answers)
quiz_question = random_question["kérdés"]  # random question from quiz_db.py


def wrap_text(text, limit):
    words = text.split(' ')
    lines = []
    current_line = []
    current_length = 0
    for word in words:
        if current_length + len(word) <= limit:
            current_length += len(word) + 1  # word length + space
            current_line.append(word)
        else:
            lines.append(' '.join(current_line))
            current_line = [word]
            current_length = len(word)
    lines.append(' '.join(current_line))  # Add remaining words
    return '\n'.join(lines)


# Create the text clip for the question, set its position
max_characters = 20

# The text wraps every 20 characters, but not mid-word
processed_text = wrap_text(quiz_question, max_characters)
# Set the fontsize based on the text length

# Dynamically calculate text position to center it
video_width = 1920
text_width = len(processed_text) * 15  # Adjust the factor based on font and size
text_position = (video_width - text_width) // 2

question = TextClip(processed_text, fontsize=60, font='Amiri-Bold', color='black').set_position(("center", 600))

# Create a list of answers
generated_text = random_question["válaszok"]  # answers from quiz_db.py
clean_answer = random_question["helyes_válasz"]  # correct answer from quiz_db.py

# Current question
print(quiz_question)
# The 'generated_text' variable contains a list of answer choices
print("Answer choices:", generated_text)

# The 'clean_answer' variable contains the correct answer
print("Correct answer:", clean_answer)

# Set the duration for the question and each answer
start_time_answer1 = 1  # start time for the FIRST answer in seconds
start_time_answer2 = 1.1  # start time for the SECOND answer in seconds
start_time_answer3 = 1.2  # start time for the THIRD answer in seconds

# Shuffle the answers
shuffled_answers = random.sample(random_question['válaszok'], len(random_question['válaszok']))

# {shuffled_answers[0]} OR {shuffled_answers[1]} OR {shuffled_answers[2]}
tts_input = f"{quiz_question}? {shuffled_answers[0]} vagy {shuffled_answers[1]} vagy {shuffled_answers[2]}"

speech_response = openai_client.audio.speech.create(
    model="tts-1-hd",
    voice="nova",
    input=f"{tts_input}?\n\n"
          f"Írd le kommentben a helyes választ, ha tudod.\n"  # Write the correct answer in the comment if you know.
)
speech_file_path = Path(__file__).parent / "generated_audio.mp3"
with open(speech_file_path, 'wb') as file:
    file.write(speech_response.content)

# Create the TextClips for each answer, with fixed labels (A, B, C) but shuffled answers
answer1 = TextClip(f"A) {shuffled_answers[0]}", fontsize=55, font='Amiri-Bold', color='black').set_start(
    start_time_answer1)
answer2 = TextClip(f"B) {shuffled_answers[1]}", fontsize=55, font='Amiri-Bold', color='black').set_start(
    start_time_answer2)
answer3 = TextClip(f"C) {shuffled_answers[2]}", fontsize=55, font='Amiri-Bold', color='black').set_start(
    start_time_answer3)

# Create a list of answers (alphabetical label order)
answers = [answer1, answer2, answer3]

# Create a list of default positions for each answer
positions = [(280, 980), (280, 1140), (280, 1300)]

# Create a list of pairs [(label, position), (label, position), (label, position)]
pairs = list(zip(answers, positions))

# Shuffle the pairs
random.shuffle(pairs)

# Load the rendered TTS audio
audio = AudioFileClip("generated_audio.mp3")

# Load the background audio and reduce its volume
background_audio = AudioFileClip("song.mp3").fx(volumex, 0.04)  # 5% of the original volume

# Get the duration of the audio
audio_duration = audio.duration

# Make sure the background_audio is the same duration as the main audio
background_audio = background_audio.subclip(0, audio_duration)

# Combine the two audio clips
composite_audio = CompositeAudioClip([background_audio, audio])

# If you want more video template
video_templates = ["quiz1.mp4", "quiz2.mp4"]
chosen_template = random.choice(video_templates)
print(chosen_template)
# Load the full video first to get its duration
full_video = VideoFileClip(chosen_template)

# Get the last 1 second (without cutting the original video)
video_last_sec = full_video.subclip(full_video.duration - 1)

# Play the whole video first (5 seconds long)
video_first_part = full_video.subclip(0, 5)

# Loop the last second of video until it matches the remaining duration of the audio
looped_video = loop(video_last_sec, duration=audio_duration - 5)


# Concatenate the first part of the video with the looped part
final_video = concatenate_videoclips([video_first_part, looped_video])

# Set the audio of the video
final_video_with_audio_and_music = final_video.set_audio(composite_audio)

# full video length, but make it shorter for the Countdown
duration = final_video.duration - 3

# Now we divide the total time by 5 (counting down from 5)
time_per_number = duration / 5

clips = []

for i in range(5, -1, -1):  # Countdown from 5 to 0
    clip = TextClip(str(i), fontsize=150, color='black').set_duration(time_per_number)
    clips.append(clip)

# Creating the countdown clip
countdown_clip = concatenate_videoclips(clips).set_pos(('center', 'bottom'))

# Setting the position of the countdown clip
countdown_clip = countdown_clip.set_position(lambda t: ('center', countdown_clip.h - -1400))

# Applying crossfade
countdown_clip = countdown_clip.crossfadein(1).crossfadeout(1)

clean_answer_pos = None
answers_texts = [f"A) {shuffled_answers[0]}", f"B) {shuffled_answers[1]}", f"C) {shuffled_answers[2]}"]

shuffled_pairs = list(zip(answers, positions, answers_texts))

for pair in shuffled_pairs:
    if clean_answer in pair[2]:
        clean_answer_pos = pair[1]
        break

if clean_answer_pos is None:
    print(f"Didn't find this answer: {clean_answer}")

random_values = random.sample(range(256), 3)  # random colours


# Setting the number of pixels per character
pix_per_char = 55

# Calculating the length of the stripe based on the length of the cleaned answer
stripe_len = len(clean_answer) * pix_per_char

# Creating a colored stripe clip with a specified length and color (green in this case)
stripe = ColorClip((stripe_len, 10), col=(0, 102, 51))

# Adjusting the position of the stripe relative to the cleaned answer position
stripe = stripe.set_position((clean_answer_pos[0], clean_answer_pos[1] + 60))

# Calculating the start time for the stripe, ensuring it begins after all previous clips
stripe_start_time = sum(clip.duration for clip in clips)

# Setting the start time and duration of the stripe to fit within the remaining duration of the final video
stripe = stripe.set_start(stripe_start_time + 1).set_duration(final_video.duration - stripe_start_time)

# Applying a crossfade effect to smoothly fade in the stripe
stripe = stripe.crossfadein(0)


# Set stripe start time
stripe_start_time = sum(clip.duration for clip in clips)

# Lay out all components to add to the video
comps = [final_video_with_audio_and_music, question.set_start(0).set_duration(audio_duration)]

# Add answers to comps with their FIXED positions
comps.extend(answer.set_position(pos).set_duration(audio_duration) for answer, pos in pairs)

comps.append(countdown_clip.set_start(0))

# Add stripe to comps
comps.append(stripe.set_start(stripe_start_time))

final_video = CompositeVideoClip(comps)
# Add the margin to the final_video
final_video = margin(final_video, 30, color=(random_values[0], random_values[1], random_values[2]))

final_video = final_video.subclip(0, final_video.duration - 1.1)

timestamp = time.time()

# Define the directory path
directory = "quiz_videos"

# Create the directory
os.makedirs(directory, exist_ok=True)

# Define the full file path with the filename
full_path = os.path.join(directory, f"quiz_output_{timestamp}.mp4")

# Save the file
final_video.write_videofile(full_path, codec="libx264")

desc_title = (f"Írj 3 releváns hastaget, plusz ezeket is add hozzá: #fyp #talaloskerdes #rejtveny #riddle"
              f" Erről a szövegről: {quiz_question}"
              f"Csak a hastageket kérem a válaszodban, vesszővel és szóközzel elválasztva egymástól!")
#  Write 3 relevant hashtags, and also add these: #fyp #riddle #puzzle #quiz
#  About this text: {quiz_question}
#  Please provide only the hashtags in your answer, separated by commas and spaces!

desc_title_text = openai_client.chat.completions.create(
    model="gpt-4-0125-preview",
    messages=[
        {"role": "user", "content": desc_title}
    ],
    max_tokens=4000,
)

desc_title_final = desc_title_text.choices[0].message.content.strip('"')
print(desc_title_final)

# single video upload
upload_video(f"{full_path}",
             description=f"Tetszett a találós kérdés? A megfejtés: {clean_answer} / {desc_title_final}",
             #  Liked the riddle? The solution: {clean_answer} / {desc_title_final}
             cookies='cookies.txt',
             browser='chrome',
             )
print("Script is finished!")
questions_and_answers = [
    {"kérdés": "Mi az, ami mindig jön, de soha nem érkezik?", "válaszok": ["holnap", "vonat", "karácsony"],
     "helyes_válasz": "holnap"},
    {"kérdés": "Mi az, ami mindig megy, de soha nem távozik?", "válaszok": ["gyalogos", "perc", "postás"],
     "helyes_válasz": "perc"},
    {"kérdés": "Mi az, ami mindig esik, de soha nem zuhan?", "válaszok": ["hó", "víz", "hőmérséklet"],
     "helyes_válasz": "hőmérséklet"},
    {"kérdés": "Mi az, ami mindig száll, de soha nem repül?", "válaszok": ["por", "madár", "lufi"],
     "helyes_válasz": "por"},
    {"kérdés": "Mi az, ami mindig fut, de soha nem izzad?", "válaszok": ["hűtő", "sportoló", "patak"],
     "helyes_válasz": "hűtő"},
    {"kérdés": "Mi az, ami mindig ugrik, de soha nem szökik?", "válaszok": ["labda", "nyúl", "pulzus"],
     "helyes_válasz": "labda"},
    {"kérdés": "Mi az, ami mindig sír, de soha nem bánkódik?", "válaszok": ["baba", "hagyma", "gitár"],
     "helyes_válasz": "hagyma"},
    {"kérdés": "Mi az, ami mindig nevet, de soha nem vidám?", "válaszok": ["bohóc", "kacagófű", "nevetőgáz"],
     "helyes_válasz": "kacagófű"},
    {"kérdés": "Mi az, ami mindig alszik, de soha nem álmodik?", "válaszok": ["macska", "kő", "telefon"],
     "helyes_válasz": "kő"},
    {"kérdés": "Mi az, ami mindig ébren van, de soha nem figyel?", "válaszok": ["kamera", "tanár", "szem"],
     "helyes_válasz": "szem"},
    {"kérdés": "Mi az, ami mindig beszél, de soha nem hallgat?", "válaszok": ["rádió", "papagáj", "gyerek"],
     "helyes_válasz": "rádió"},
    {"kérdés": "Mi az, ami mindig hallgat, de soha nem beszél?", "válaszok": ["fül", "fal", "titok"],
     "helyes_válasz": "titok"},
    {"kérdés": "Mi az, ami mindig énekel, de soha nem dalol?",
     "válaszok": ["csalogány", "mikrofon", "csengőhang"], "helyes_válasz": "mikrofon"},
    {"kérdés": "Mi az, ami mindig dalol, de soha nem énekel?", "válaszok": ["fülemüle", "kazetta", "himnusz"],
     "helyes_válasz": "himnusz"},
    {"kérdés": "Mi az, ami mindig játszik, de soha nem unatkozik?", "válaszok": ["kutya", "játék", "színész"],
     "helyes_válasz": "játék"},
    {"kérdés": "Mi az, ami mindig unatkozik, de soha nem játszik?", "válaszok": ["tanuló", "könyv", "várakozó"],
     "helyes_válasz": "várakozó"},
    {"kérdés": "Mi az, ami mindig tanul, de soha nem tud?", "válaszok": ["számítógép", "diák", "lexikon"],
     "helyes_válasz": "számítógép"},
    {"kérdés": "Mi az, ami mindig tud, de soha nem tanul?", "válaszok": ["professzor", "bölcs", "természet"],
     "helyes_válasz": "természet"},
    {"kérdés": "Mi az, ami mindig kérdez, de soha nem válaszol?", "válaszok": ["fejtörő", "gyerek", "telefon"],
     "helyes_válasz": "fejtörő"},
    {"kérdés": "Mi az, ami mindig válaszol, de soha nem kérdez?", "válaszok": ["Copilot", "tükör", "papír"],
     "helyes_válasz": "tükör"},
    {"kérdés": "Mi az, ami mindig segít, de soha nem kér segítséget?", "válaszok": ["barát", "szerszám", "mentő"],
     "helyes_válasz": "szerszám"},
    {"kérdés": "Mi az, ami mindig kér segítséget, de soha nem segít?",
     "válaszok": ["bajba jutott", "koldus", "feladat"], "helyes_válasz": "feladat"},
    {"kérdés": "Mi az, ami mindig ad, de soha nem kap?", "válaszok": ["fa", "nap", "bank"],
     "helyes_válasz": "nap"},
    {"kérdés": "Mi az, ami mindig kap, de soha nem ad?", "válaszok": ["tolvaj", "gyűjtő", "lyuk"],
     "helyes_válasz": "lyuk"},
    {"kérdés": "Mi az, ami mindig oszt, de soha nem szoroz?", "válaszok": ["matematika", "kenyér", "lapát"],
     "helyes_válasz": "matematika"},
    {"kérdés": "Mi az, ami mindig szoroz, de soha nem oszt?", "válaszok": ["baktérium", "szám", "család"],
     "helyes_válasz": "baktérium"},
    {"kérdés": "Mi az, ami mindig hozzáad, de soha nem von ki?",
     "válaszok": ["növekedés", "kalória", "születésnap"], "helyes_válasz": "születésnap"},
    {"kérdés": "Mi az, ami mindig kivon, de soha nem hozzáad?", "válaszok": ["halál", "kölcsön", "fogyás"],
     "helyes_válasz": "fogyás"},
    {"kérdés": "Mi az, ami mindig összetart, de soha nem ragaszt?",
     "válaszok": ["barátság", "mágnes", "gravitáció"], "helyes_válasz": "mágnes"},
    {"kérdés": "Mi az, ami mindig ragaszt, de soha nem összetart?", "válaszok": ["ragasztó", "méz", "rágógumi"],
     "helyes_válasz": "ragasztó"},
    {"kérdés": "Mi az, ami mindig szép, de soha nem csinos?", "válaszok": ["virág", "táj", "művészet"],
     "helyes_válasz": "virág"},
    {"kérdés": "Mi az, ami mindig csinos, de soha nem szép?", "válaszok": ["smink", "ruha", "cipő"],
     "helyes_válasz": "smink"},
    {"kérdés": "Mi az, ami mindig erős, de soha nem kemény?", "válaszok": ["szél", "hang", "hit"],
     "helyes_válasz": "szél"},
    {"kérdés": "Mi az, ami mindig kemény, de soha nem erős?", "válaszok": ["kő", "jég", "dió"],
     "helyes_válasz": "kő"},
    {"kérdés": "Mi az, ami mindig puha, de soha nem gyenge?", "válaszok": ["toll", "pamut", "felhő"],
     "helyes_válasz": "toll"},
    {"kérdés": "Mi az, ami mindig gyenge, de soha nem puha?", "válaszok": ["fény", "jel", "remény"],
     "helyes_válasz": "fény"},
    {"kérdés": "Mi az, ami mindig hideg, de soha nem fagy?", "válaszok": ["jégkrém", "hűtő", "hold"],
     "helyes_válasz": "hold"},
    {"kérdés": "Mi az, ami mindig fagy, de soha nem hideg?",
     "válaszok": ["fagylalt", "fagyott zöldség", "fagyott víz"], "helyes_válasz": "fagyott víz"},
    {"kérdés": "Mi az, ami mindig meleg, de soha nem forró?", "válaszok": ["tea", "test", "szív"],
     "helyes_válasz": "tea"},
    {"kérdés": "Mi az, ami mindig forró, de soha nem meleg?", "válaszok": ["tűz", "láva", "villám"],
     "helyes_válasz": "tűz"},
    {"kérdés": "Mi az, ami mindig szúr, de soha nem sebez?", "válaszok": ["tű", "tövis", "kérdés"],
     "helyes_válasz": "kérdés"},
    {"kérdés": "Mi az, ami mindig sebez, de soha nem szúr?", "válaszok": ["kés", "szó", "fagy"],
     "helyes_válasz": "szó"},
    {"kérdés": "Mi az, ami mindig csíp, de soha nem harap?", "válaszok": ["szúnyog", "bors", "csipesz"],
     "helyes_válasz": "szúnyog"},
    {"kérdés": "Mi az, ami mindig harap, de soha nem csíp?", "válaszok": ["kutya", "fogó", "pirája"],
     "helyes_válasz": "kutya"},
    {"kérdés": "Mi az, ami mindig fúj, de soha nem fújja el?", "válaszok": ["szél", "trombita", "gyertya"],
     "helyes_válasz": "szél"},
    {"kérdés": "Mi az, ami mindig elfújja, de soha nem fúj?", "válaszok": ["száj", "ventilátor", "robbanás"],
     "helyes_válasz": "száj"},
    {"kérdés": "Mi az, ami mindig lobog, de soha nem ég?", "válaszok": ["zászló", "tűz", "haj"],
     "helyes_válasz": "zászló"},
    {"kérdés": "Mi az, ami mindig ég, de soha nem lobog?", "válaszok": ["nap", "gyufa", "lámpa"],
     "helyes_válasz": "nap"},
    {"kérdés": "Mi az, ami mindig világít, de soha nem ragyog?", "válaszok": ["csillag", "hold", "LED"],
     "helyes_válasz": "csillag"},
    {"kérdés": "Mi az, ami mindig ragyog, de soha nem világít?", "válaszok": ["gyémánt", "tükör", "hó"],
     "helyes_válasz": "gyémánt"},
    {"kérdés": "Mi az, ami mindig sötét, de soha nem fekete?", "válaszok": ["szem", "Az éjszaka", "Az árnyék"],
     "helyes_válasz": "Az éjszaka"},
    {"kérdés": "Mi az, ami mindig színes, de soha nem fest?",
     "válaszok": ["szivárvány", "virág", "paletta"],
     "helyes_válasz": "szivárvány"},
    {"kérdés": "Mi az, ami mindig fest, de soha nem színes?",
     "válaszok": ["festő", "hajfesték", "festékszóró"],
     "helyes_válasz": "festő"},
    {"kérdés": "Mi az, ami mindig rajzol, de soha nem színez?",
     "válaszok": ["ceruza", "vonalzó", "radír"],
     "helyes_válasz": "ceruza"},
    {"kérdés": "Mi az, ami mindig színez, de soha nem rajzol?",
     "válaszok": ["filctoll", "színező", "színes ceruza"],
     "helyes_válasz": "filctoll"},
    {"kérdés": "Mi az, ami mindig ír, de soha nem olvas?",
     "válaszok": ["toll", "gép", "kéz"],
     "helyes_válasz": "toll"},
    {"kérdés": "Mi az, ami mindig olvas, de soha nem ír?",
     "válaszok": ["szem", "könyv", "szkenner"],
     "helyes_válasz": "szem"},
    {"kérdés": "Mi az, ami mindig nyomtat, de soha nem másol?",
     "válaszok": ["nyomtató", "sajtó", "bélyeg"],
     "helyes_válasz": "nyomtató"},
    {"kérdés": "Mi az, ami mindig másol, de soha nem nyomtat?",
     "válaszok": ["tanuló", "másoló", "DNS"],
     "helyes_válasz": "másoló"},
    {"kérdés": "Mi az, ami mindig számol, de soha nem számít?",
     "válaszok": ["számológép", "pénztáros", "stopper"],
     "helyes_válasz": "számológép"},
    {"kérdés": "Mi az, ami mindig számít, de soha nem számol?",
     "válaszok": ["logika", "vélemény", "döntés"],
     "helyes_válasz": "logika"},
    {"kérdés": "Mi az, ami mindig mér, de soha nem mért?",
     "válaszok": ["mérleg", "mérőszalag", "hőmérő"],
     "helyes_válasz": "mérleg"},
    {"kérdés": "Mi az, ami mindig mért, de soha nem mér?",
     "válaszok": ["távolság", "terület", "súly"],
     "helyes_válasz": "távolság"},
    {"kérdés": "Mi az, ami mindig kever, de soha nem keveredik?",
     "válaszok": ["kanál", "mixer", "koktél"],
     "helyes_válasz": "kanál"},
    {"kérdés": "Mi az, ami mindig keveredik, de soha nem kever?",
     "válaszok": ["nyelv", "vér", "szín"],
     "helyes_válasz": "nyelv"},
    {"kérdés": "Mi az, ami mindig mos, de soha nem tisztít?",
     "válaszok": ["mosógép", "mosogató", "mosoly"],
     "helyes_válasz": "mosógép"},
    {"kérdés": "Mi az, ami mindig tisztít, de soha nem mos?",
     "válaszok": ["seprű", "fertőtlenítő", "fogkefe"],
     "helyes_válasz": "seprű"},
    {"kérdés": "Mi az, ami mindig szárít, de soha nem nedvesít?",
     "válaszok": ["szárítógép", "nap", "törölköző"],
     "helyes_válasz": "szárítógép"},
    {"kérdés": "Mi az, ami mindig nedvesít, de soha nem szárít?",
     "válaszok": ["víz", "nyál", "pára"],
     "helyes_válasz": "pára"},
    {"kérdés": "Mi az, ami mindig nedves, de soha nem ázik?",
     "válaszok": ["hal", "jég", "vízesés"],
     "helyes_válasz": "hal"},
    {"kérdés": "Mi az, ami mindig ázik, de soha nem nedves?",
     "válaszok": ["szivacs", "ruha", "papír"],
     "helyes_válasz": "szivacs"},
    {"kérdés": "Mi az, ami mindig száraz, de soha nem szomjas?",
     "válaszok": ["sivatag", "kenyér", "homok"],
     "helyes_válasz": "sivatag"},
    {"kérdés": "Mi az, ami mindig szomjas, de soha nem száraz?",
     "válaszok": ["kaktusz", "kaméleon", "szivacs"],
     "helyes_válasz": "kaktusz"},
    {"kérdés": "Mi az, ami mindig éhes, de soha nem jóllakott?",
     "válaszok": ["tűz", "farkas", "féreg"],
     "helyes_válasz": "tűz"},
    {"kérdés": "Mi az, ami mindig jóllakott, de soha nem éhes?",
     "válaszok": ["hordó", "pénztárca", "medve"],
     "helyes_válasz": "hordó"},
    {"kérdés": "Mi az, ami mindig nő, de soha nem öregszik?",
     "válaszok": ["fa", "haj", "gyűrű"],
     "helyes_válasz": "fa"},
    {"kérdés": "Mi az, ami mindig öregszik, de soha nem nő?",
     "válaszok": ["bőr", "sajt", "fénykép"],
     "helyes_válasz": "bőr"},
    {"kérdés": "Mi az, ami mindig fiatal, de soha nem születik?",
     "válaszok": ["víz", "csillag", "gyermek"],
     "helyes_válasz": "gyermek"},
    {"kérdés": "Mi az, ami mindig születik, de soha nem fiatal?",
     "válaszok": ["nap", "virág", "pillangó"],
     "helyes_válasz": "pillangó"},
    {"kérdés": "Mi az, ami mindig lát, de soha nem néz?", "válaszok": ["kamera", "szem", "fény"],
     "helyes_válasz": "fény"},
    {"kérdés": "Mi az, ami mindig néz, de soha nem lát?", "válaszok": ["vak", "tükör", "szobor"],
     "helyes_válasz": "tükör"},
    {"kérdés": "Mi az, ami mindig hall, de soha nem figyel?", "válaszok": ["fül", "rádió", "fal"],
     "helyes_válasz": "fal"},
    {"kérdés": "Mi az, ami mindig figyel, de soha nem hall?", "válaszok": ["szem", "kamera", "növény"],
     "helyes_válasz": "növény"},
    {"kérdés": "Mi az, ami mindig érez, de soha nem érint?", "válaszok": ["szív", "lélek", "fájdalom"],
     "helyes_válasz": "fájdalom"},
    {"kérdés": "Mi az, ami mindig érint, de soha nem érez?", "válaszok": ["kéz", "víz", "gomb"],
     "helyes_válasz": "gomb"},
    {"kérdés": "Mi az, ami mindig gondolkodik, de soha nem tud?", "válaszok": ["számítógép", "fejtörő", "gyerek"],
     "helyes_válasz": "számítógép"},
    {"kérdés": "Mi az, ami mindig tud, de soha nem gondolkodik?", "válaszok": ["lexikon", "bölcs", "természet"],
     "helyes_válasz": "lexikon"},
    {"kérdés": "Mi az, ami mindig akar, de soha nem cselekszik?", "válaszok": ["vágy", "terv", "remény"],
     "helyes_válasz": "remény"},
    {"kérdés": "Mi az, ami mindig cselekszik, de soha nem akar?", "válaszok": ["robot", "reflex", "gravitáció"],
     "helyes_válasz": "reflex"},
    {"kérdés": "Mi az, ami mindig mozgat, de soha nem mozog?", "válaszok": ["motor", "zene", "szél"],
     "helyes_válasz": "zene"},
    {"kérdés": "Mi az, ami mindig mozog, de soha nem mozgat?", "válaszok": ["folyó", "hold", "labda"],
     "helyes_válasz": "hold"},
    {"kérdés": "Mi az, ami mindig áll, de soha nem ül?", "válaszok": ["láb", "fa", "szék"],
     "helyes_válasz": "fa"},
    {"kérdés": "Mi az, ami mindig ül, de soha nem áll?", "válaszok": ["macska", "tojás", "kanapé"],
     "helyes_válasz": "tojás"},
    {"kérdés": "Mi az, ami mindig fekszik, de soha nem alszik?", "válaszok": ["padló", "híd", "halott"],
     "helyes_válasz": "híd"},
    {"kérdés": "Mi az, ami mindig alszik, de soha nem fekszik?", "válaszok": ["macska", "denevér", "telefon"],
     "helyes_válasz": "denevér"},
    {"kérdés": "Mi az, ami mindig jár, de soha nem fut?", "válaszok": ["gyalogos", "Az óra", "csiga"],
     "helyes_válasz": "Az óra"},
    {"kérdés": "Mi az, ami mindig fut, de soha nem jár?", "válaszok": ["sportoló", "víz", "vér"],
     "helyes_válasz": "vér"},
    {"kérdés": "Mi az, ami mindig repül, de soha nem száll?", "válaszok": ["madár", "repülő", "papírsárkány"],
     "helyes_válasz": "papírsárkány"},
    {"kérdés": "Mi az, ami mindig száll, de soha nem repül?", "válaszok": ["por", "lufi", "helikopter"],
     "helyes_válasz": "lufi"},
    {"kérdés": "Mi az, ami mindig dob, de soha nem fog?", "válaszok": ["kéz", "dob", "kocka"],
     "helyes_válasz": "dob"},
    {"kérdés": "Mi az, ami mindig fog, de soha nem dob?", "válaszok": ["fogó", "fog", "csapda"],
     "helyes_válasz": "fog"},
    {"kérdés": "Mi az, ami mindig húz, de soha nem tol?", "válaszok": ["ló", "mágnes", "kötél"],
     "helyes_válasz": "mágnes"},
    {"kérdés": "Mi az, ami mindig tol, de soha nem húz?", "válaszok": ["tolóajtó", "rakéta", "szánkó"],
     "helyes_válasz": "rakéta"},
    {"kérdés": "Mi az, ami mindig nyit, de soha nem zár?", "válaszok": ["szem", "száj", "virág"],
     "helyes_válasz": "virág"},
    {"kérdés": "Mi az, ami mindig zár, de soha nem nyit?", "válaszok": ["lakat", "seb", "titok"],
     "helyes_válasz": "seb"},
    {"kérdés": "Mi az, ami mindig forog, de soha nem fordul?", "válaszok": ["kerék", "bolygó", "korong"],
     "helyes_válasz": "bolygó"},
    {"kérdés": "Mi az, ami mindig fordul, de soha nem forog?", "válaszok": ["kanyar", "lapát", "kulcs"],
     "helyes_válasz": "kanyar"},
    {"kérdés": "Mi az, ami mindig billen, de soha nem dől?", "válaszok": ["hinta", "billentyű", "mérleg"],
     "helyes_válasz": "billentyű"},
    {"kérdés": "Mi az, ami mindig dől, de soha nem billen?", "válaszok": ["torony", "fa", "dominó"],
     "helyes_válasz": "torony"},
    {"kérdés": "Mi az, ami mindig ugyanaz marad, akárhogy is forgatod?", "válaszok": ["kör", "labda", "kocka"],
     "helyes_válasz": "kör"},
    {"kérdés": "Mi az, ami mindig változik, akárhogy is állítod be?", "válaszok": ["óra", "hőmérő", "időjárás"],
     "helyes_válasz": "időjárás"},
    {"kérdés": "Mi az, ami mindig egyenlő, akárhogy is osztod el?", "válaszok": ["süti", "pénz", "pi"],
     "helyes_válasz": "pi"},
    {"kérdés": "Mi az, ami mindig kettő, akárhogy is szorozod?", "válaszok": ["nulla", "egy", "kettő"],
     "helyes_válasz": "egy"},
    {"kérdés": "Mi az, ami mindig nulla, akárhogy is hozzáadsz?", "válaszok": ["nulla", "végtelen", "negatív"],
     "helyes_válasz": "nulla"},
    {"kérdés": "Mi az, ami mindig végtelen, akárhogy is kivonod?", "válaszok": ["nulla", "végtelen", "negatív"],
     "helyes_válasz": "végtelen"},
    {"kérdés": "Mi az, ami mindig negatív, akárhogy is átalakítod?", "válaszok": ["nulla", "végtelen", "negatív"],
     "helyes_válasz": "negatív"},
    {"kérdés": "Mi az, ami mindig egyforma, akárhogy is rendezed?", "válaszok": ["betű", "szám", "szín"],
     "helyes_válasz": "szín"},
    {"kérdés": "Mi az, ami mindig más, akárhogy is kevered?", "válaszok": ["kártya", "szó", "hang"],
     "helyes_válasz": "hang"},
    {"kérdés": "Mi az, ami mindig több, akárhogy is veszel belőle?", "válaszok": ["adósság", "tudás", "életkor"],
     "helyes_válasz": "adósság"},
    {"kérdés": "Mi az, ami mindig kevesebb, akárhogy is adsz hozzá?", "válaszok": ["távolság", "idő", "sebesség"],
     "helyes_válasz": "távolság"},
    {"kérdés": "Mi az, ami mindig nagyobb, akárhogy is osztod?", "válaszok": ["tér", "súly", "erő"],
     "helyes_válasz": "tér"},
    {"kérdés": "Mi az, ami mindig kisebb, akárhogy is szorozod?", "válaszok": ["tizedes", "százalék", "tört"],
     "helyes_válasz": "tizedes"},
    {"kérdés": "Mi az, ami mindig egyenlőtlen, akárhogy is igazítod?", "válaszok": ["mérleg", "vonalzó", "libra"],
     "helyes_válasz": "libra"},
    {"kérdés": "Mi az, ami mindig egyenes, akárhogy is hajtogatod?", "válaszok": ["papír", "fény", "vasaló"],
     "helyes_válasz": "fény"},
    {"kérdés": "Mi az, ami mindig görbe, akárhogy is nyújtod?", "válaszok": ["gumi", "banán", "íj"],
     "helyes_válasz": "banán"},
    {"kérdés": "Mi az, ami mindig lapos, akárhogy is fújod?", "válaszok": ["lufi", "lemez", "lapát"],
     "helyes_válasz": "lemez"},
    {"kérdés": "Mi az, ami mindig magas, akárhogy is méred?", "válaszok": ["torony", "hegy", "óriás"],
     "helyes_válasz": "óriás"},
    {"kérdés": "Mi az, ami mindig alacsony, akárhogy is növeszted?", "válaszok": ["törpe", "fű", "csiga"],
     "helyes_válasz": "csiga"},
    {"kérdés": "Mi az, ami mindig nehéz, akárhogy is emeled?", "válaszok": ["vas", "kő", "elefánt"],
     "helyes_válasz": "elefánt"},
    {"kérdés": "Mi az, ami mindig könnyű, akárhogy is nyomod?", "válaszok": ["pamut", "paplan", "párnacsata"],
     "helyes_válasz": "párnacsata"},
    {"kérdés": "Mi az, ami mindig hosszabb, akárhogy is rövidíted?", "válaszok": ["év", "hónap", "nap"],
     "helyes_válasz": "év"},
    {"kérdés": "Mi az, ami mindig rövidebb, akárhogy is hosszabbítod?", "válaszok": ["óra", "perc", "másodperc"],
     "helyes_válasz": "másodperc"},
    {"kérdés": "Mi az, ami mindig gyorsabb, akárhogy is lassítod?", "válaszok": ["fény", "hang", "gondolat"],
     "helyes_válasz": "fény"},
    {"kérdés": "Mi az, ami mindig erősebb, akárhogy is gyengíted?", "válaszok": ["mágnes", "ragasztó", "szerelem"],
     "helyes_válasz": "szerelem"},
    {"kérdés": "Mi az, ami mindig gyengébb, akárhogy is erősíted?", "válaszok": ["jel", "hangya", "remény"],
     "helyes_válasz": "jel"},
    {"kérdés": "Mi az, ami mindig melegebb, akárhogy is hűtöd?", "válaszok": ["láva", "tűz", "vulkán"],
     "helyes_válasz": "vulkán"},
    {"kérdés": "Mi az, ami mindig hidegebb, akárhogy is melegíted?", "válaszok": ["jég", "hó", "gleccser"],
     "helyes_válasz": "gleccser"},
    {"kérdés": "Mi az, ami mindig sötétebb, akárhogy is világítod?", "válaszok": ["éjszaka", "barlang", "fekete lyuk"],
     "helyes_válasz": "fekete lyuk"},
    {"kérdés": "Mi az, ami mindig világosabb, akárhogy is árnyékolod?", "válaszok": ["nap", "csillag", "fény"],
     "helyes_válasz": "fény"},
    {"kérdés": "Mi az, ami mindig élesebb, akárhogy is tompítod?", "válaszok": ["kés", "olló", "tű"],
     "helyes_válasz": "tű"},
    {"kérdés": "Mi az, ami mindig tompább, akárhogy is élesíted?", "válaszok": ["ceruza", "köröm", "fog"],
     "helyes_válasz": "fog"},
    {"kérdés": "Mi az, ami mindig színesebb, akárhogy is fested?", "válaszok": ["szivárvány", "virág", "pillangó"],
     "helyes_válasz": "szivárvány"},
    {"kérdés": "Mi az, ami mindig szürkébb, akárhogy is színezed?", "válaszok": ["elefánt", "egér", "hamu"],
     "helyes_válasz": "hamu"},
    {"kérdés": "Mi az, ami mindig üres, akárhogy is töltöd?", "válaszok": ["pohár", "üveg", "lyuk"],
     "helyes_válasz": "lyuk"},
    {"kérdés": "Mi az, ami mindig tele, akárhogy is üríted?", "válaszok": ["doboz", "zsák", "tenger"],
     "helyes_válasz": "tenger"},
    {"kérdés": "Mi az, ami mindig nyitott, akárhogy is zárod?", "válaszok": ["ajtó", "ablak", "szem"],
     "helyes_válasz": "szem"},
    {"kérdés": "Mi az, ami mindig lila, de soha nem szőlő?", "válaszok": ["ibolya", "bogyó", "hercegnő"],
     "helyes_válasz": "hercegnő"},
    {"kérdés": "Mi az, ami mindig szürke, de soha nem elefánt?", "válaszok": ["hamu", "egér", "beton"],
     "helyes_válasz": "beton"},
    {"kérdés": "Mi az, ami mindig arany, de soha nem ékszer?", "válaszok": ["medál", "korona", "medve"],
     "helyes_válasz": "medve"},
    {"kérdés": "Mi az, ami mindig ezüst, de soha nem pénz?", "válaszok": ["tükör", "hold", "golyó"],
     "helyes_válasz": "hold"},
    {"kérdés": "Mi az, ami mindig bronz, de soha nem érem?", "válaszok": ["szobor", "barna", "csillár"],
     "helyes_válasz": "szobor"},
    {"kérdés": "Mi az, ami mindig üveg, de soha nem törékeny?", "válaszok": ["ablak", "üveg", "lencse"],
     "helyes_válasz": "lencse"},
    {"kérdés": "Mi az, ami mindig fa, de soha nem növény?", "válaszok": ["asztal", "ceruza", "fa"],
     "helyes_válasz": "fa"},
    {"kérdés": "Mi az, ami mindig műanyag, de soha nem játék?", "válaszok": ["flakon", "kártya", "műfogsor"],
     "helyes_válasz": "műfogsor"},
    {"kérdés": "Mi az, ami mindig fém, de soha nem vas?", "válaszok": ["arany", "alumínium", "mágnes"],
     "helyes_válasz": "alumínium"},
    {"kérdés": "Mi az, ami mindig víz, de soha nem folyékony?", "válaszok": ["jég", "gőz", "hó"],
     "helyes_válasz": "jég"},
    {"kérdés": "Mi az, ami mindig levegő, de soha nem látható?", "válaszok": ["oxigén", "szél", "lélegzet"],
     "helyes_válasz": "oxigén"},
    {"kérdés": "Mi az, ami mindig tűz, de soha nem meleg?", "válaszok": ["gyertya", "sárkány", "tűzijáték"],
     "helyes_válasz": "tűzijáték"},
    {"kérdés": "Mi az, ami mindig föld, de soha nem piszkos?", "válaszok": ["bolygó", "homok", "agyag"],
     "helyes_válasz": "bolygó"},
    {"kérdés": "Mi az, ami mindig éter, de soha nem létezik?", "válaszok": ["lélek", "álom", "mágia"],
     "helyes_válasz": "mágia"},
    {"kérdés": "Mi az, ami mindig kő, de soha nem kemény?", "válaszok": ["gyémánt", "márvány", "kavics"],
     "helyes_válasz": "kavics"},
    {"kérdés": "Mi az, ami mindig papír, de soha nem írható?", "válaszok": ["pénz", "jegyzet", "repülő"],
     "helyes_válasz": "repülő"},
    {"kérdés": "Mi az, ami mindig betű, de soha nem olvasható?", "válaszok": ["ABC", "DNA", "SMS"],
     "helyes_válasz": "DNA"},
    {"kérdés": "Mi az, ami mindig szám, de soha nem számolható?", "válaszok": ["nulla", "végtelen", "pi"],
     "helyes_válasz": "végtelen"},
    {"kérdés": "Mi az, ami mindig forma, de soha nem alakítható?", "válaszok": ["kör", "négyzet", "háromszög"],
     "helyes_válasz": "kör"},
    {"kérdés": "Mi az, ami mindig szín, de soha nem festhető?", "válaszok": ["fekete", "fehér", "szürke"],
     "helyes_válasz": "fekete"},
    {"kérdés": "Mi az, ami mindig hang, de soha nem hallható?", "válaszok": ["ultrahang", "infrhang", "rezgés"],
     "helyes_válasz": "ultrahang"},
    {"kérdés": "Mi az, ami mindig fény, de soha nem világít?", "válaszok": ["lámpa", "csillag", "tükör"],
     "helyes_válasz": "tükör"},
    {"kérdés": "Mi az, ami mindig árnyék, de soha nem sötét?", "válaszok": ["napernyő", "szemüveg", "függöny"],
     "helyes_válasz": "szemüveg"},
    {"kérdés": "Mi az, ami mindig üzenet, de soha nem mondható?", "válaszok": ["kép", "jel", "titok"],
     "helyes_válasz": "titok"},
    {"kérdés": "Mi az, ami mindig kérdés, de soha nem válaszolható?", "válaszok": ["miért", "hogyan", "mikor"],
     "helyes_válasz": "miért"},
    {"kérdés": "Mi az, ami mindig válasz, de soha nem kérdezhető?", "válaszok": ["igen", "nem", "talán"],
     "helyes_válasz": "talán"},
    {"kérdés": "Mi az, ami mindig játék, de soha nem szórakoztató?", "válaszok": ["sakk", "kártya", "háború"],
     "helyes_válasz": "háború"},
    {"kérdés": "Mi az, ami mindig dal, de soha nem énekelhető?", "válaszok": ["himnusz", "rap", "csend"],
     "helyes_válasz": "csend"},
    {"kérdés": "Mi az, ami mindig vers, de soha nem rímelhető?", "válaszok": ["szabadvers", "haiku", "limerick"],
     "helyes_válasz": "haiku"},
    {"kérdés": "Mi az, ami mindig szó, de soha nem írható?", "válaszok": ["suttogás", "kiáltás", "csók"],
     "helyes_válasz": "csók"},
    {"kérdés": "Mi az, ami mindig mondat, de soha nem mondható?", "válaszok": ["parancs", "kívánság", "titok"],
     "helyes_válasz": "kívánság"},
    {"kérdés": "Mi a következő betű ebben a sorozatban: B, D, F, H, ...", "válaszok": ["I", "J", "K"],
     "helyes_válasz": "J"},
    {"kérdés": "Mi a legjobb analógia erre: Madár : Repül :: Hal : ...", "válaszok": ["Úszik", "Esik", "Fúj"],
     "helyes_válasz": "Úszik"},
    {"kérdés": "Mi a következő betű ebben a sorozatban: Z, X, V, T, ...", "válaszok": ["R", "S", "U"],
     "helyes_válasz": "R"},
    {"kérdés": "Mi a legjobb analógia erre: Nap : Ég :: Hold : ...", "válaszok": ["Csillag", "Éjszaka", "Föld"],
     "helyes_válasz": "Éjszaka"},
    {"kérdés": "Mi a következő betű ebben a sorozatban: M, O, Q, S, ...", "válaszok": ["T", "U", "V"],
     "helyes_válasz": "U"},
    {"kérdés": "Mi a legjobb analógia erre: Alma : Piros :: Banán : ...", "válaszok": ["Sárga", "Zöld", "Kék"],
     "helyes_válasz": "Sárga"},
    {"kérdés": "Mi a következő betű ebben a sorozatban: C, F, I, L, ...", "válaszok": ["M", "N", "O"],
     "helyes_válasz": "O"},
    {"kérdés": "Mi a legjobb analógia erre: Tél : Hideg :: Nyár : ...", "válaszok": ["Meleg", "Napos", "Szép"],
     "helyes_válasz": "Meleg"},
    {"kérdés": "Mi a következő betű ebben a sorozatban: W, U, S, Q, ...", "válaszok": ["O", "P", "R"],
     "helyes_válasz": "O"},
    {"kérdés": "Mi a legjobb analógia erre: Kávé : Fekete :: Tej : ...", "válaszok": ["Fehér", "Kék", "Barna"],
     "helyes_válasz": "Fehér"},
    {"kérdés": "Mi a következő betű ebben a sorozatban: Y, V, S, P, ...", "válaszok": ["M", "N", "O"],
     "helyes_válasz": "N"},
    {"kérdés": "Mi a legjobb analógia erre: Cukor : Édes :: Só : ...", "válaszok": ["Sós", "Savanyú", "Csípős"],
     "helyes_válasz": "Sós"},
    {"kérdés": "Mi a következő betű ebben a sorozatban: D, G, J, M, ...", "válaszok": ["N", "O", "P"],
     "helyes_válasz": "P"},
    {"kérdés": "Mi a legjobb analógia erre: Kígyó : Csúszik :: Nyúl : ...", "válaszok": ["Ugrál", "Fut", "Rág"],
     "helyes_válasz": "Ugrál"},
    {"kérdés": "Mi a következő betű ebben a sorozatban: E, H, K, N, ...", "válaszok": ["O", "Q", "R"],
     "helyes_válasz": "Q"},
    {"kérdés": "Mi a legjobb analógia erre: Kéz : Ujj :: Láb : ...", "válaszok": ["Lábujj", "Sarok", "Boka"],
     "helyes_válasz": "Lábujj"},
    {"kérdés": "Mi a következő betű ebben a sorozatban: F, I, L, O, ...", "válaszok": ["P", "R", "S"],
     "helyes_válasz": "R"},
    {"kérdés": "Mi a legjobb analógia erre: Szem : Lát :: Fül : ...", "válaszok": ["Hall", "Érez", "Szagol"],
     "helyes_válasz": "Hall"},
    {"kérdés": "Mi a következő betű ebben a sorozatban: G, J, M, P, ...", "válaszok": ["Q", "S", "T"],
     "helyes_válasz": "S"},
    {"kérdés": "Mi a legjobb analógia erre: Olló : Vág :: Toll : ...", "válaszok": ["Ír", "Rajzol", "Szúr"],
     "helyes_válasz": "Ír"},
    {"kérdés": "Mi a következő betű ebben a sorozatban: H, K, N, Q, ...", "válaszok": ["R", "T", "U"],
     "helyes_válasz": "T"},
    {"kérdés": "Mi a legjobb analógia erre: Ég : Kék :: Fű : ...", "válaszok": ["Zöld", "Sárga", "Barna"],
     "helyes_válasz": "Zöld"},
    {"kérdés": "Mi a következő betű ebben a sorozatban: I, L, O, S, ...", "válaszok": ["T", "U", "V"],
     "helyes_válasz": "V"},
    {"kérdés": "Mi a legjobb analógia erre: Virág : Illat :: Méz : ...", "válaszok": ["Íz", "Szín", "Tapintás"],
     "helyes_válasz": "Íz"},
    {"kérdés": "Mi a következő betű ebben a sorozatban: J, M, P, S, ...", "válaszok": ["T", "U", "V"],
     "helyes_válasz": "V"},
    {"kérdés": "Mi a legjobb analógia erre: Szív : Vér :: Tüdő : ...", "válaszok": ["Levegő", "Oxigén", "Szén-dioxid"],
     "helyes_válasz": "Levegő"},
    {"kérdés": "Mi a következő betű ebben a sorozatban: K, O, S, W, ...", "válaszok": ["X", "Y", "Z"],
     "helyes_válasz": "Z"},
    {"kérdés": "Mi a legjobb analógia erre: Ház : Fal :: Ruha : ...", "válaszok": ["Anyag", "Cipzár", "Gomb"],
     "helyes_válasz": "Anyag"},
    {"kérdés": "Mi a következő betű ebben a sorozatban: L, P, S, X, ...", "válaszok": ["A", "B", "C"],
     "helyes_válasz": "A"},
    {"kérdés": "Mi a legjobb analógia erre: Eső : Nedves :: Hó : ...", "válaszok": ["Hideg", "Fehér", "Puha"],
     "helyes_válasz": "Fehér"},
    {"kérdés": "Mi a következő betű ebben a sorozatban: M, R, V, A, ...", "válaszok": ["D", "E", "F"],
     "helyes_válasz": "E"},

]

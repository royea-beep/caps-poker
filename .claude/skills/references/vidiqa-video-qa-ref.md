# VidiQA

Video Question Answering is the task of answering open-ended questions based on a video clip. They output natural language responses to natural language questions about the content of a video clip. This project uses one of the popular multimodal models, [**MiniCPM-V-2_6**](https://huggingface.co/openbmb/MiniCPM-V-2_6) from the Hugging Face model hub for video question answering.

[**MiniCPM-V-2_6**](https://huggingface.co/openbmb/MiniCPM-V-2_6) is the latest model in the MiniCPM-V series, built on **SigLip-400M** and **Qwen2-7B** with a total of 8B parameters. It introduces new features for multi-image and video understanding. It also supports multilingual capabilities and produces fewer tokens than most models, improving inference speed, first-token latency, memory usage, and power consumption. It is easy to use in various ways, including CPU inference, quantized models, and online demos.

## Project Structure

The project is structured as follows:

- `src\`: The folder that contains the source code for the project.

  - `app\`: The folder containing the source code for the application's main functionality.

    - `model.py`: The file that contains the code for loading the model and the tokenizer.
    - `response.py`: The file that contains the function for generating the response for the input video and question.

  - `utils\`: The folder containing the project's utility function.
    - `video_processing.py`: This file contains the functions for processing the video input.

  - `config.py`: This file contains the configuration for the used model.
  - `logger.py`: This file contains the project's logging configuration.
  - `exception.py`: This file contains the exception handling for the project.

- `app.py`: The main file that contains the Gradio application for video question answering.
- `requirements.txt`: The file containing the project's required dependencies.
- `LICENSE`: The license file for the project.
- `README.md`: The README file that contains information about the project.
- `assets`: The folder that contains the screenshots for working on the application.
- `images`: The folder that contains the images for testing the application.

## Tech Stack

- Python (for the programming language)
- PyTorch (for the deep learning framework)
- Hugging Face Transformers Library (for the visual question-answering model)
- Gradio (for the web application)
- Hugging Face Spaces (for hosting the gradio application)

## Getting Started

To get started with this project, follow the steps below:

1. Clone the repository: `git clone https://github.com/sitamgithub-MSIT/VidiQA.git`
2. Change the directory: `cd VidiQA`
3. Create a virtual environment: `python -m venv tutorial-env`
4. Activate the virtual environment: `tutorial-env\Scripts\activate`
5. Install the required dependencies: `pip install -r requirements.txt`
6. Run the Gradio application: `python app.py`

Now, open up your local host and see the web application running. For more information, please refer to the Gradio documentation [here](https://www.gradio.app/docs/interface). Also, a live version of the application can be found [here](https://huggingface.co/spaces/sitammeur/VidiQA).

**Note**: The application is hosted on Hugging Face Spaces running on a GPU. For local use, you are expected to have a GPU for running the application. If you do not have a GPU, you can explore the CPU inference option provided by the model [here](https://huggingface.co/collections/openbmb/minicpm-65d48bf958302b9fd25b698f).

## Usage

The web application allows you to upload a video and input a question. The model will analyze the video frames and generate an answer based on the content of the video and the question. This can assist in video summarization, enhance video retrieval by identifying specific scenes or actions, and support visually impaired individuals by describing video content. The application is also useful in educational settings for providing detailed explanations or context based on video material.

## Contributing

Contributions are welcome! If you would like to contribute to this project, please raise an issue to discuss the changes you want to make. Once the changes are approved, you can create a pull request.

## License

This project is licensed under the [MIT License](LICENSE).

## Contact

If you have any questions or suggestions regarding the project, feel free to reach out to me on my GitHub profile.

Happy coding! 🚀
# Importing the requirements
import warnings
warnings.filterwarnings("ignore")

import gradio as gr
from src.app.response import describe_video


# Video, text query, and input parameters
video = gr.Video(label="Video")
query = gr.Textbox(label="Question", placeholder="Enter your question here")
temperature = gr.Slider(
    minimum=0.01, maximum=1.99, step=0.01, value=0.7, label="Temperature"
)
top_p = gr.Slider(minimum=0, maximum=1, step=0.01, value=0.8, label="Top P")
top_k = gr.Slider(minimum=0, maximum=1000, step=1, value=100, label="Top K")
max_new_tokens = gr.Slider(minimum=1, maximum=4096, step=1, value=512, label="Max Tokens")

# Output for the interface
response = gr.Textbox(label="Predicted answer", show_label=True, show_copy_button=True)

# Examples for the interface
examples = [
    [
        "./videos/sample_video_1.mp4",
        "Here are some frames of a video. Describe this video.",
        0.7,
        0.8,
        100,
        512,
    ],
    [
        "./videos/sample_video_2.mp4",
        "¿Cuál es el animal de este vídeo? ¿Cuantos animales hay?",
        0.7,
        0.8,
        100,
        512,
    ],
    [
        "./videos/sample_video_3.mp4",
        "Que se passe-t-il dans cette vidéo ?",
        0.7,
        0.8,
        100,
        512,
    ],
]

# Title, description, and article for the interface
title = "Video Question Answering"
description = "Gradio Demo for the MiniCPM-V 2.6 Vision Language Understanding and Generation model. This model can answer questions about videos in natural language. To use it, upload your video, type a question, select associated parameters, use the default values, click 'Submit', or click one of the examples to load them. You can read more at the links below."
article = "<p style='text-align: center'><a href='https://github.com/OpenBMB/MiniCPM-V' target='_blank'>Model GitHub Repo</a> | <a href='https://huggingface.co/openbmb/MiniCPM-V-2_6' target='_blank'>Model Page</a></p>"


# Launch the interface
interface = gr.Interface(
    fn=describe_video,
    inputs=[video, query, temperature, top_p, top_k, max_new_tokens],
    outputs=response,
    examples=examples,
    cache_examples=True,
    cache_mode="lazy",
    title=title,
    description=description,
    article=article,
    theme="ParityError/Anime",
    flagging_mode="never",
)
interface.launch(debug=False)
# Necessary imports
import os
import sys
from dotenv import load_dotenv
from typing import Any
import torch
from transformers import AutoModel, AutoTokenizer, AutoProcessor

# Local imports
from src.logger import logging
from src.exception import CustomExceptionHandling


# Load the Environment Variables from .env file
load_dotenv()

# Access token for using the model
access_token = os.environ.get("ACCESS_TOKEN")


def load_model_and_tokenizer(model_name: str, device: str) -> Any:
    """
    Load the model, tokenizer and processor.

    Args:
        - model_name (str): The name of the model to load.
        - device (str): The device to load the model onto.

    Returns:
        - model: The loaded model.
        - tokenizer: The loaded tokenizer.
        - processor: The loaded processor.
    """
    try:
        # Load the model, tokenizer and processor
        model = AutoModel.from_pretrained(
            model_name,
            trust_remote_code=True,
            attn_implementation="sdpa",
            torch_dtype=torch.bfloat16,
            token=access_token
        )
        model = model.to(device=device)
        tokenizer = AutoTokenizer.from_pretrained(
            model_name, trust_remote_code=True, token=access_token
        )
        processor = AutoProcessor.from_pretrained(
            model_name, trust_remote_code=True, token=access_token
        )
        model.eval()

        # Log the successful loading of the model and tokenizer
        logging.info("Model and tokenizer loaded successfully.")

        # Return the model, tokenizer and processor
        return model, tokenizer, processor

    # Handle exceptions that may occur during model and tokenizer loading
    except Exception as e:
        # Custom exception handling
        raise CustomExceptionHandling(e, sys) from e
# Necessary imports
import sys
from typing import Any, Dict
import gradio as gr
import spaces

# Local imports
from src.utils.video_processing import encode_video
from src.config import (
    device,
    model_name,
    sampling,
    stream,
    repetition_penalty,
)
from src.app.model import load_model_and_tokenizer
from src.logger import logging
from src.exception import CustomExceptionHandling


# Model, tokenizer and processor
model, tokenizer, processor = load_model_and_tokenizer(model_name, device)


@spaces.GPU(duration=120)
def describe_video(
    video: str,
    question: str,
    temperature: float,
    top_p: float,
    top_k: int,
    max_new_tokens: int,
) -> str:
    """
    Describes a video by generating an answer to a given question.

    Args:
        - video (str): The path to the video file.
        - question (str): The question to be answered about the video.
        - temperature (float): The temperature parameter for the model.
        - top_p (float): The top_p parameter for the model.
        - top_k (int): The top_k parameter for the model.
        - max_new_tokens (int): The max tokens to be generated by the model.

    Returns:
        str: The generated answer to the question.
    """
    try:
        # Check if video or question is None
        if not video or not question:
            gr.Warning("Please provide a video and a question.")

        # Encode the video frames
        frames = encode_video(video)

        # Message format for the model
        msgs = [{"role": "user", "content": frames + [question]}]

        # Set decode params for video
        params: Dict[str, Any] = {
            "use_image_id": False,
            "max_slice_nums": 1,  # Use 1 if CUDA OOM and video resolution > 448*448
        }

        # Generate the answer
        answer = model.chat(
            image=None,
            msgs=msgs,
            tokenizer=tokenizer,
            processor=processor,
            sampling=sampling,
            stream=stream,
            top_p=top_p,
            top_k=top_k,
            temperature=temperature,
            repetition_penalty=repetition_penalty,
            max_new_tokens=max_new_tokens,
            **params
        )

        # Log the successful generation of the answer
        logging.info("Answer generated successfully.")

        # Return the answer
        return "".join(answer)

    # Handle exceptions that may occur during answer generation
    except Exception as e:
        # Custom exception handling
        raise CustomExceptionHandling(e, sys) from e
# Model settings
device = "cuda"
model_name = "openbmb/MiniCPM-V-2_6"

# Decoding settings
sampling = True
stream = True
repetition_penalty = 1.05

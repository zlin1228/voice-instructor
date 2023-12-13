import openai
import tiktoken

from logger_setup import get_logger

logger = get_logger()


def num_tokens_from_string(string: str, encoding_name: str = "cl100k_base") -> int:
    """Returns the number of tokens in a text string."""
    encoding = tiktoken.get_encoding(encoding_name)
    num_tokens = len(encoding.encode(string))
    return num_tokens


def generate(prompt):
    """Call the language model to generate a response."""
    ntokens = num_tokens_from_string(prompt)

    logger.debug('ntokens %s', ntokens)

    model_name = 'gpt-4' if ntokens < (8192 - 1024) else 'gpt-4-32k'

    response = openai.ChatCompletion.create(
        model=model_name,
        messages=[
            {"role": "system", "content": "You are an autonomous AI agent."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.6
    )
    return response['choices'][0]['message']['content']

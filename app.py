import json
import os
import logging
import random

import requests
import time
import openai
from flask import Flask, Response, request, jsonify, send_from_directory
from dotenv import load_dotenv
from opencensus.ext.azure.log_exporter import AzureLogHandler

load_dotenv()

app = Flask(__name__, static_folder="static")

# -----------------------------------------------------------------------------
# Logging set up
# -----------------------------------------------------------------------------
logging.basicConfig(level=logging.DEBUG, format="%(asctime)s - %(levelname)s - %(message)s")

c_handler = logging.StreamHandler()
c_handler.setLevel(logging.DEBUG)

logger = logging.getLogger(__name__)
logger.addHandler(c_handler)

if 'APPLICATIONINSIGHTS_CONNECTION_STRING' in os.environ and 'APPLICATIONINSIGHTS_INSTRUMENTATION_KEY' in os.environ:
    logger.info("APPLICATIONINSIGHTS_CONNECTION_STRING and _INSTRUMENTATION_KEY defined, setting AzureLogHandler")
    connection_string = os.getenv('APPLICATIONINSIGHTS_CONNECTION_STRING')
    instrumentation_key = os.getenv('APPLICATIONINSIGHTS_INSTRUMENTATION_KEY')
    logger.addHandler(AzureLogHandler(connection_string=connection_string, instrumentation_key=instrumentation_key))
else:
    logger.info("APPLICATIONINSIGHTS_CONNECTION_STRING and _INSTRUMENTATION_KEY defined not defined, AzureLogHandler will not be initialized")


# -----------------------------------------------------------------------------
# Static Files
# -----------------------------------------------------------------------------
@app.route("/")
def index():
    return app.send_static_file("index.html")


@app.route("/favicon.ico")
def favicon():
    return app.send_static_file('favicon.ico')


@app.route("/assets/<path:path>")
def assets(path):
    return send_from_directory("static/assets", path)


# -----------------------------------------------------------------------------
# ACS Integration Settings
# -----------------------------------------------------------------------------
AZURE_SEARCH_SERVICE = os.environ.get("AZURE_SEARCH_SERVICE")
AZURE_SEARCH_INDEX = os.environ.get("AZURE_SEARCH_INDEX")
AZURE_SEARCH_KEY = os.environ.get("AZURE_SEARCH_KEY")
AZURE_SEARCH_USE_SEMANTIC_SEARCH = os.environ.get("AZURE_SEARCH_USE_SEMANTIC_SEARCH", "false")
AZURE_SEARCH_SEMANTIC_SEARCH_CONFIG = os.environ.get("AZURE_SEARCH_SEMANTIC_SEARCH_CONFIG", "default")
AZURE_SEARCH_TOP_K = os.environ.get("AZURE_SEARCH_TOP_K", 5)
AZURE_SEARCH_ENABLE_IN_DOMAIN = os.environ.get("AZURE_SEARCH_ENABLE_IN_DOMAIN", "true")
AZURE_SEARCH_CONTENT_COLUMNS = os.environ.get("AZURE_SEARCH_CONTENT_COLUMNS")
AZURE_SEARCH_FILENAME_COLUMN = os.environ.get("AZURE_SEARCH_FILENAME_COLUMN")
AZURE_SEARCH_TITLE_COLUMN = os.environ.get("AZURE_SEARCH_TITLE_COLUMN")
AZURE_SEARCH_URL_COLUMN = os.environ.get("AZURE_SEARCH_URL_COLUMN")

# -----------------------------------------------------------------------------
# AOAI Integration Settings
# -----------------------------------------------------------------------------
AZURE_OPENAI_TEMPERATURE = os.environ.get("AZURE_OPENAI_TEMPERATURE", 0)
AZURE_OPENAI_TOP_P = os.environ.get("AZURE_OPENAI_TOP_P", 1.0)
AZURE_OPENAI_MAX_TOKENS = os.environ.get("AZURE_OPENAI_MAX_TOKENS", 1000)
AZURE_OPENAI_STOP_SEQUENCE = os.environ.get("AZURE_OPENAI_STOP_SEQUENCE")
AZURE_OPENAI_SYSTEM_MESSAGE = os.environ.get("AZURE_OPENAI_SYSTEM_MESSAGE", "You are an AI assistant that helps people find information.")
AZURE_OPENAI_PREVIEW_API_VERSION = os.environ.get("AZURE_OPENAI_PREVIEW_API_VERSION", "2023-06-01-preview")
AZURE_OPENAI_STREAM = os.environ.get("AZURE_OPENAI_STREAM", "true")
SHOULD_STREAM = True if AZURE_OPENAI_STREAM.lower() == "true" else False


# -----------------------------------------------------------------------------
# Load balanced endpoints
# -----------------------------------------------------------------------------
AZURE_OPENAI_KEY = os.environ.get("AZURE_OPENAI_KEY")
AZURE_OPENAI_RESOURCE = os.environ.get("AZURE_OPENAI_RESOURCE")
AZURE_OPENAI_MODEL = os.environ.get("AZURE_OPENAI_MODEL")
AZURE_OPENAI_MODEL_NAME = os.environ.get("AZURE_OPENAI_MODEL_NAME")

AZURE_OPENAI_KEY_NC = os.environ.get("AZURE_OPENAI_KEY_NC")
AZURE_OPENAI_RESOURCE_NC = os.environ.get("AZURE_OPENAI_RESOURCE_NC")
AZURE_OPENAI_MODEL_NC = os.environ.get("AZURE_OPENAI_MODEL_NC")
AZURE_OPENAI_MODEL_NAME_NC = os.environ.get("AZURE_OPENAI_MODEL_NAME_NC")

AZURE_OPENAI_KEY_US2 = os.environ.get("AZURE_OPENAI_KEY_US2")
AZURE_OPENAI_RESOURCE_US2 = os.environ.get("AZURE_OPENAI_RESOURCE_US2")
AZURE_OPENAI_MODEL_US2 = os.environ.get("AZURE_OPENAI_MODEL_US2")
AZURE_OPENAI_MODEL_NAME_US2 = os.environ.get("AZURE_OPENAI_MODEL_NAME_US2")

# VERY IMPORTANT - THE ORDER IN THE ARRAYS BELOW MUST MATCH!!!!!
openai_keys = [AZURE_OPENAI_KEY, AZURE_OPENAI_KEY_NC, AZURE_OPENAI_KEY_US2]
openai_resources = [AZURE_OPENAI_RESOURCE, AZURE_OPENAI_RESOURCE_NC, AZURE_OPENAI_RESOURCE_US2]
openai_models = [AZURE_OPENAI_MODEL, AZURE_OPENAI_MODEL_NC, AZURE_OPENAI_MODEL_US2]
openai_model_names = [AZURE_OPENAI_MODEL_NAME, AZURE_OPENAI_MODEL_NAME_NC, AZURE_OPENAI_MODEL_NAME_US2]

# -----------------------------------------------------------------------------
# Endpoint randomization stuff
# -----------------------------------------------------------------------------
max_retries = 3


def generate_endpoint(ndx):
    resource = openai_resources[ndx]
    model = openai_models[ndx]
    api_version = AZURE_OPENAI_PREVIEW_API_VERSION
    return f"https://{resource}.openai.azure.com/openai/deployments/{model}/extensions/chat/completions?api-version={api_version}"


def next_index(ndx):
    return (ndx + 1) % max_retries


# -----------------------------------------------------------------------------
# Everything else
# -----------------------------------------------------------------------------
def is_chat_model():
    if 'gpt-4' in AZURE_OPENAI_MODEL_NAME.lower() or AZURE_OPENAI_MODEL_NAME.lower() in ['gpt-35-turbo-4k',
                                                                                         'gpt-35-turbo-16k']:
        return True
    return False


def should_use_data():
    if AZURE_SEARCH_SERVICE and AZURE_SEARCH_INDEX and AZURE_SEARCH_KEY:
        return True
    return False


def prepare_body_headers_with_data(request, ndx):
    request_messages = request.json["messages"]
    openai_key = openai_keys[ndx]
    openai_resource = openai_resources[ndx]
    openai_model = openai_models[ndx]

    body = {
        "messages": request_messages,
        "temperature": float(AZURE_OPENAI_TEMPERATURE),
        "max_tokens": int(AZURE_OPENAI_MAX_TOKENS),
        "top_p": float(AZURE_OPENAI_TOP_P),
        "stop": AZURE_OPENAI_STOP_SEQUENCE.split("|") if AZURE_OPENAI_STOP_SEQUENCE else None,
        "stream": SHOULD_STREAM,
        "dataSources": [
            {
                "type": "AzureCognitiveSearch",
                "parameters": {
                    "endpoint": f"https://{AZURE_SEARCH_SERVICE}.search.windows.net",
                    "key": AZURE_SEARCH_KEY,
                    "indexName": AZURE_SEARCH_INDEX,
                    "fieldsMapping": {
                        "contentField": AZURE_SEARCH_CONTENT_COLUMNS.split("|") if AZURE_SEARCH_CONTENT_COLUMNS else [],
                        "titleField": AZURE_SEARCH_TITLE_COLUMN if AZURE_SEARCH_TITLE_COLUMN else None,
                        "urlField": AZURE_SEARCH_URL_COLUMN if AZURE_SEARCH_URL_COLUMN else None,
                        "filepathField": AZURE_SEARCH_FILENAME_COLUMN if AZURE_SEARCH_FILENAME_COLUMN else None
                    },
                    "inScope": True if AZURE_SEARCH_ENABLE_IN_DOMAIN.lower() == "true" else False,
                    "topNDocuments": AZURE_SEARCH_TOP_K,
                    "queryType": "semantic" if AZURE_SEARCH_USE_SEMANTIC_SEARCH.lower() == "true" else "simple",
                    "semanticConfiguration": AZURE_SEARCH_SEMANTIC_SEARCH_CONFIG if AZURE_SEARCH_USE_SEMANTIC_SEARCH.lower() == "true" and AZURE_SEARCH_SEMANTIC_SEARCH_CONFIG else "",
                    "roleInformation": AZURE_OPENAI_SYSTEM_MESSAGE
                }
            }
        ]
    }

    chatgpt_url = f"https://{openai_resource}.openai.azure.com/openai/deployments/{openai_model}"
    if is_chat_model():
        chatgpt_url += "/chat/completions?api-version=2023-03-15-preview"
    else:
        chatgpt_url += "/completions?api-version=2023-03-15-preview"

    headers = {
        'Content-Type': 'application/json',
        'api-key': openai_key,
        'chatgpt_url': chatgpt_url,
        'chatgpt_key': openai_key,
        "x-ms-useragent": "GitHubSampleWebApp/PublicAPI/1.0.0"
    }

    return body, headers


def stream_with_data(body, headers, endpoint):
    logger.info(f"stream_with_data: {endpoint}")
    s = requests.Session()
    response = {
        "id": "",
        "model": "",
        "created": 0,
        "object": "",
        "choices": [{
            "messages": []
        }]
    }

    logger.info("stream_with_data: starting POST")
    start_time = time.time()
    try:
        r = s.post(endpoint, json=body, headers=headers, stream=True, timeout=10)
    except Exception:
        logger.error(f"Endpoint {endpoint} timed out")
        return None
    logger.info(f"stream_with_data: status code of call: {r.status_code}")
    if r.status_code != 200:
        return None

    with r:
        total_time = round(time.time() - start_time, 3)
        logger.info(f"stream_with_data: POST completed in {total_time} seconds, processing response lines")
        start_time = time.time()
        for line in r.iter_lines(chunk_size=10):
            if line:
                line_json = json.loads(line.lstrip(b'data:').decode('utf-8'))
                if 'error' in line_json:
                    yield json.dumps(line_json).replace("\n", "\\n") + "\n"
                response["id"] = line_json["id"]
                response["model"] = line_json["model"]
                response["created"] = line_json["created"]
                response["object"] = line_json["object"]

                role = line_json["choices"][0]["messages"][0]["delta"].get("role")
                if role == "tool":
                    response["choices"][0]["messages"].append(line_json["choices"][0]["messages"][0]["delta"])
                elif role == "assistant":
                    response["choices"][0]["messages"].append({
                        "role": "assistant",
                        "content": ""
                    })
                else:
                    deltaText = line_json["choices"][0]["messages"][0]["delta"]["content"]
                    if deltaText != "[DONE]":
                        response["choices"][0]["messages"][1]["content"] += deltaText

                yield json.dumps(response).replace("\n", "\\n") + "\n"
        total_time = round(time.time() - start_time, 3)
        logger.info(f"stream_with_data: lines processed in {total_time} seconds")


@app.route("/conversation", methods=["GET", "POST"])
def conversation():
    current_index = random.randint(0, max_retries - 1)
    for retry in range(max_retries):
        logger.info(f"####### Retry #{retry} Using index #{current_index}")
        body, headers = prepare_body_headers_with_data(request, current_index)
        openai_resource = openai_resources[current_index]
        openai_model = openai_models[current_index]
        endpoint = f"https://{openai_resource}.openai.azure.com/openai/deployments/{openai_model}/extensions/chat/completions?api-version={AZURE_OPENAI_PREVIEW_API_VERSION}"
        data_stream = stream_with_data(body, headers, endpoint)
        if data_stream is not None and next(data_stream, None) is not None:
            logger.info("Data stream received, sending response to client")
            return Response(data_stream, mimetype='text/event-stream')
        else:
            if retry < max_retries - 1:
                logger.error("Retrying...")
                current_index = next_index(current_index)
            else:
                logger.error("Giving up and returning an error")
                return Response(json.dumps({"error": "Sorry, I could not answer that. Please try asking a different question."}) + "\n")


if __name__ == "__main__":
    logger.info("Main: application starting")
    app.run()

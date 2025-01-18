import requests
import json

url = "http://localhost:11434/api/chat"


def llama3(prompt):
    data = {
        "model": "llama3.2",
        "messages": [
            {
                "role": "user",
                "content": prompt

            }
        ],
        "stream": False,
    }

    headers = {
        "Content-Type": "application/json"
    }

    response = requests.post(url, headers=headers, json=data)
    return response.json()


response = llama3("who wrote the book godfather")
print(response)
CLAIM_GETTER = {
    "model_name": "gpt-4o",
    "temperature": 0.0,
    "max_tokens": 500
}

CLAIM_CHECKER = {
    "question model": {
        "model_name": "gpt-3.5-turbo",
        "temperature": 0.0,
        "max_tokens": 500
    },
    "answer model": {
        "model_name": "gpt-4o-mini",
        "temperature": 0.0,
        "max_tokens": 250
    },
    "verification model": {
        "model_name": "gpt-4o",
        "temperature": 0.0,
        "max_tokens": 500
    },
    "evidence model": {
        "model_name": "gpt-4o",
        "temperature": 0.0,
        "max_tokens": 500
    }
}

config = {
    "claim getter": CLAIM_GETTER,
    "claim checker": CLAIM_CHECKER
} 
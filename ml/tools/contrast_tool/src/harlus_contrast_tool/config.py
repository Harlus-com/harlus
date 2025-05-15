"""
Configuration settings for Harlus contrast tool models and processing.
This file replaces the previous YAML-based configuration.
"""

# Document Processing Configuration

# Claim Getter configuration
CLAIM_GETTER = {
    "model_name": "gpt-4o",
    "temperature": 0.0,
    "max_tokens": 500
}

# Claim checker configuration
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
    }
}

# The config dictionary that matches the structure expected by existing code
config = {
    "claim getter": CLAIM_GETTER,
    "claim checker": CLAIM_CHECKER
} 
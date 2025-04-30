def snake_to_camel(s: str) -> str:
    return "".join(
        word if i == 0 else word.capitalize() for i, word in enumerate(s.split("_"))
    )


def clean_name(name: str) -> str:
    return (
        name.replace(" ", "_")
        .replace(".", "_")
        .replace("-", "_")
        .replace(")", "")
        .replace("(", "")
        .replace(":", "")
        .replace("!", "")
        .replace("?", "")
        .replace("'", "")
        .replace('"', "")
    )

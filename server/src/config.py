import yaml
import os
import dotenv

dotenv.load_dotenv()

# TODO: Determine config strategy and ensure this is OS agnostic
current_dir = os.path.dirname(os.path.abspath(__file__))
server_dir = os.path.dirname(current_dir)
config_path = os.path.join(server_dir, "config.yaml")

with open(config_path, "r") as f:
    config = yaml.safe_load(f)

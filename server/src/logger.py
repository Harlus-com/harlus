import os
import logging
from datetime import datetime

# TODO: Determine log strategy and ensure this is OS agnostic
log_file = os.path.join("/tmp", "harlus.log")
if not os.path.exists(log_file):
    os.makedirs(os.path.dirname(log_file), exist_ok=True)

with open(log_file, "w") as f:
    f.write("\n")
    f.write("\n")
    f.write("\n")
    f.write("LOG STARTED AT: " + datetime.now().strftime("%Y-%m-%d %H:%M:%S"))

logging.basicConfig(filename=log_file, level=logging.INFO)
logging.basicConfig(format="%(asctime)s %(message)s")
logger = logging.getLogger(__name__)

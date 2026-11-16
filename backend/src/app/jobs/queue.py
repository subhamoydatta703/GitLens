import os
from bullmq import Queue
from dotenv import load_dotenv
load_dotenv()

redis_url = os.environ["REDIS_URL"]

queue = Queue("github_analyze", {"connection": redis_url})
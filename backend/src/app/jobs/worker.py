import asyncio
import concurrent
import os
import signal

from bullmq import Worker
from dotenv import load_dotenv

load_dotenv()

from app.jobs.tasks import process


async def main():

    # Create an event that will be triggered for shutdown
    shutdown_event = asyncio.Event()

    def signal_handler(signal, frame):
        print("Signal received, shutting down.")
        shutdown_event.set()

    # Assign signal handlers to SIGTERM and SIGINT
    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)

    # Feel free to remove the connection parameter, if your redis runs on localhost
    worker = Worker(
        "github_analyze",
        process,  # pyright: ignore[reportArgumentType]
        {"connection": os.environ["REDIS_URL"], "concurrency": 1},
         
    )

    # Wait until the shutdown event is set
    await shutdown_event.wait()

    # close the worker
    print("Cleaning up worker...")
    await worker.close()
    print("Worker shut down successfully.")


if __name__ == "__main__":
    asyncio.run(main())

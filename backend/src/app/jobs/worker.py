import asyncio
import concurrent
import os
import signal

from bullmq import Worker
from dotenv import load_dotenv

load_dotenv()

from app.jobs.tasks import process


def create_worker():
    return Worker(
        "github_analyze",
        process,  # pyright: ignore[reportArgumentType]
        {"connection": os.environ["REDIS_URL"], "concurrency": 1},
    )


async def main():

    # Create an event that will be triggered for shutdown
    shutdown_event = asyncio.Event()
    force_shutdown_task = None

    def signal_handler(signal, frame):
        nonlocal force_shutdown_task
        if shutdown_event.is_set():
            if force_shutdown_task is None:
                print("Second signal received, forcing shutdown.")
                force_shutdown_task = asyncio.create_task(worker.close(force=True))
            return

        print("Signal received, shutting down.")
        shutdown_event.set()

    # Assign signal handlers to SIGTERM and SIGINT
    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)

    worker = create_worker()

    # Wait until the shutdown event is set
    await shutdown_event.wait()

    # close the worker
    print("Cleaning up worker...")
    await worker.close()
    if force_shutdown_task is not None:
        await force_shutdown_task
    print("Worker shut down successfully.")


if __name__ == "__main__":
    asyncio.run(main())

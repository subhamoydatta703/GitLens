# AI provider

The FastAPI lifespan automatically starts one BullMQ worker per server process
and closes it on shutdown before closing the queue. Start the server normally;
a separate worker terminal is no longer needed. Stop any previously started
standalone worker to avoid processing more jobs concurrently. Graceful shutdown
waits for active jobs to finish. The standalone worker command remains available
if you deliberately want additional consumers.

Batch analysis and the final portfolio assessment use OpenRouter's
`nvidia/nemotron-3.5-super-vl:free` model. Add the following to your existing
`backend/.env` without replacing your other settings:

```env
OPENROUTER_API_KEY=your_openrouter_api_key
```

Restart the backend and worker after adding the key. No Gemini or Groq key is
required by the active analysis pipeline. Missing OpenRouter configuration fails
only when analysis is requested; profile and evidence preparation remain usable.

The existing analysis and assessment functions remain in `services/gemini/`,
but both call the shared OpenRouter service. Two repository batches run
sequentially, with the existing 60-second pause, followed by one assessment call.
The frontend still receives one consolidated Markdown report through job polling.

Requests use the explicit free model ID with no paid-model fallback. Free-tier
availability and rate limits still apply. Network errors, provider errors,
empty output, and truncated output fail the job rather than returning a partial
report. Each OpenRouter request has a 180-second timeout and a 10-second
connection timeout. Model reasoning is disabled to reserve the output budget
for the visible report.

from concurrent.futures import ThreadPoolExecutor

# Shared bounded thread pool for CPU-intensive tasks (PDF generation, forecasting).
# max_workers=5 prevents unbounded thread creation under load.
SHARED_EXECUTOR = ThreadPoolExecutor(max_workers=5)

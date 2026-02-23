from prometheus_client import Histogram

REQUEST_LATENCY = Histogram('request_latency_seconds', 'Request latency in seconds', ['method', 'endpoint'])
REPORT_GENERATION_DURATION = Histogram('report_generation_duration_seconds', 'Report generation duration in seconds')
FORECAST_DURATION = Histogram('forecast_duration_seconds', 'Forecast duration in seconds')

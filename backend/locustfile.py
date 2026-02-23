from locust import HttpUser, task, between

class HackathonStressTest(HttpUser):
    wait_time = between(1, 3)

    @task(3)
    def admin_dashboard_summary(self):
        # Admin dashboard polling
        self.client.get("/api/admin/dashboard/summary")

    @task(1)
    def admin_analytics(self):
        # Analytics page polling
        self.client.get("/api/admin/analytics/fraud-distribution")

    @task(1)
    def report_download(self):
        # Heavy report endpoint
        self.client.get("/api/admin/reports/monthly?district=TestDistrict&month=2026-02")

    @task(2)
    def forecast_spam(self):
        # Spam forecast API
        self.client.get("/api/admin/forecast/demand?district=TestDistrict")

    @task(5)
    def login_rate_limit(self):
        # Login rate limit
        self.client.post("/api/auth/login", json={"mobile": "9999999999", "password": "wrong"})

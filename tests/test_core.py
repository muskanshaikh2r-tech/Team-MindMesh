import os, sys, tempfile, unittest, random
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
os.environ["VORTEXA_DB"] = os.path.join(tempfile.mkdtemp(), "t.db")
os.environ["MOCK_TIME_SCALE"] = "0"

import auth, database, service  # noqa: E402
from models_registry import registry  # noqa: E402
from request_analyzer import analyze  # noqa: E402
from routing_engine import Preferences  # noqa: E402


class NoFail(random.Random):
    def random(self):  # never trigger transient failures
        return 0.999


class Core(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        database.init_db()
        auth.ensure_demo_user()
        cls.uid = auth.login("demo@vortexa.ai", "demo1234")[0]["id"]

    def setUp(self):
        registry.clear_overrides()

    def route(self, prompt, **kw):
        return service.route_request(self.uid, prompt, Preferences(**kw), rng=NoFail())

    def test_classification(self):
        self.assertEqual(analyze("Explain pointers in C++").category, "coding")
        self.assertEqual(analyze("Summarize this article for me").category, "summarization")
        self.assertEqual(analyze("What is the capital of France?").category, "general")
        self.assertEqual(analyze("Analyze the trade-off and compare both designs step by step").category, "reasoning")

    def test_mockup_scenario_picks_model_b(self):
        r = self.route("Explain pointers in C++", budget="low_cost", max_latency_ms=1000, min_capability=4, context_tokens=8000)
        self.assertEqual(r["status"], "success")
        self.assertEqual(r["selected_model"]["id"], "model-b")
        self.assertEqual(r["eligible_count"], 1)

    def test_simple_question_prefers_cheap_model(self):
        r = self.route("What is the capital of France?", budget="low_cost", max_latency_ms=2000, min_capability=1, context_tokens=4000)
        self.assertEqual(r["selected_model"]["id"], "model-a")

    def test_high_quality_prefers_c(self):
        r = self.route("Analyze and compare these two architectures step by step", budget="high_quality",
                       max_latency_ms=3000, min_capability=4, context_tokens=8000)
        self.assertEqual(r["selected_model"]["id"], "model-c")

    def test_fallback_on_execution_failure(self):
        registry.set_override("model-b", "fail")
        r = self.route("Explain pointers in C++", budget="balanced", max_latency_ms=3000, min_capability=3, context_tokens=8000)
        self.assertEqual(r["status"], "success")
        self.assertTrue(r["fallback_used"])
        self.assertEqual(r["attempts"][0]["outcome"], "failed")
        self.assertNotEqual(r["selected_model"]["id"], "model-b")

    def test_all_fail_is_bounded(self):
        for m in ("model-b", "model-c", "model-d"):
            registry.set_override(m, "fail")
        r = self.route("Explain pointers in C++", budget="balanced", max_latency_ms=3000, min_capability=3, context_tokens=8000)
        self.assertEqual(r["status"], "failed")
        self.assertLessEqual(len(r["attempts"]), 3)

    def test_no_eligible_model(self):
        r = self.route("hello", max_latency_ms=100, min_capability=5, context_tokens=64000)
        self.assertEqual(r["status"], "no_eligible_model")
        self.assertIsNone(r["selected_model"])

    def test_unavailable_model_rejected_upfront(self):
        registry.set_override("model-a", "unavailable")
        r = self.route("hello there", max_latency_ms=2000, context_tokens=4000)
        a = next(c for c in r["candidates"] if c["id"] == "model-a")
        self.assertFalse(a["eligible"])
        self.assertIn("Currently unavailable", a["reasons_rejected"])

    def test_simulation_message(self):
        s = service.simulate("Explain pointers in C++", Preferences("balanced", 2000, 3, 4000),
                             {"model-b": {"latency_ms": 2500}})
        self.assertIn("Model B is now slower (2.5s)", s["message"])
        self.assertTrue(s["changed"])

    def test_history_and_analytics(self):
        database.clear_history(self.uid)
        self.route("hello there", max_latency_ms=2000, context_tokens=4000)
        self.route("Explain pointers in C++", min_capability=4)
        h = database.list_history(self.uid)
        self.assertEqual(len(h), 2)
        a = database.analytics(self.uid)
        self.assertEqual(a["total_requests"], 2)
        self.assertEqual(sum(a["requests_over_time"]), 2)

    def test_otp_flow(self):
        auth.create_user("Test", "t@example.com", "password1")
        with self.assertRaises(auth.AuthError):
            auth.login("t@example.com", "password1")  # not verified yet
        code = auth.issue_otp("t@example.com")
        with self.assertRaises(auth.AuthError):
            auth.verify_otp("t@example.com", "000000" if code != "000000" else "111111")
        user, token = auth.verify_otp("t@example.com", code)
        self.assertEqual(auth.user_from_token(token)["email"], "t@example.com")
        auth.login("t@example.com", "password1")


if __name__ == "__main__":
    unittest.main()

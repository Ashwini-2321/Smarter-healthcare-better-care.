import unittest

from app import app


class CareToolsApiTests(unittest.TestCase):
    def setUp(self):
        app.config["TESTING"] = True
        self.client = app.test_client()

    def test_symptom_list_and_urgent_guidance(self):
        catalog_response = self.client.get("/symptoms")
        self.assertEqual(catalog_response.status_code, 200)
        catalog = catalog_response.get_json()["symptoms"]
        self.assertTrue(any(item["value"] == "chest_pain" for item in catalog))

        response = self.client.post(
            "/symptom-recommendation",
            json={"symptoms": ["chest_pain", "palpitations"]},
        )
        result = response.get_json()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(result["suggestedSpecialty"], "Cardiology")
        self.assertIn("not a diagnosis", result["disclaimer"])
        self.assertIn("emergency services", result["urgentGuidance"])

    def test_symptom_recommendation_rejects_uncontrolled_values(self):
        response = self.client.post(
            "/symptom-recommendation",
            json={"symptoms": ["made_up_symptom"]},
        )
        self.assertEqual(response.status_code, 400)

    def test_endpoints_reject_unsupported_request_fields(self):
        symptom_response = self.client.post(
            "/symptom-recommendation",
            json={"symptoms": ["headache"], "patientName": "Not accepted"},
        )
        no_show_response = self.client.post(
            "/no-show-prediction",
            json={
                "appointmentDate": "2026-12-01",
                "appointmentTime": "10:30",
                "bookingLeadDays": 1,
                "reminderSent": False,
                "patientName": "Not accepted",
            },
        )
        self.assertEqual(symptom_response.status_code, 400)
        self.assertEqual(no_show_response.status_code, 400)

    def test_doctor_recommendation_uses_directory_attributes(self):
        doctors = [
            {
                "id": 1,
                "name": "Dr. Priya Sharma",
                "specialization": "Cardiologist",
                "experienceYears": 10,
                "availability": "Available",
                "workingDays": ["Mon", "Tue"],
                "timeSlots": ["09:00", "10:30"],
                "consultationFee": None,
                "clinic": "Clinexa Care Center",
                "isActive": True,
            },
            {
                "id": 2,
                "name": "Dr. Rahul Kumar",
                "specialization": "Dermatologist",
                "experienceYears": 8,
                "availability": "Unavailable",
                "workingDays": ["Mon", "Tue"],
                "timeSlots": ["13:00"],
                "consultationFee": 75,
                "clinic": "Clinexa Skin Clinic",
                "isActive": True,
            },
        ]
        response = self.client.post(
            "/doctor-recommendation",
            json={
                "doctors": doctors,
                "preferences": {
                    "specialization": "Cardiologist",
                    "availability": "Available",
                    "preferredTime": "09:00",
                },
            },
        )
        recommendations = response.get_json()["recommendations"]
        self.assertEqual(response.status_code, 200)
        self.assertEqual(recommendations[0]["name"], "Dr. Priya Sharma")
        self.assertEqual(recommendations[0]["id"], "1")
        self.assertIn("specialty preference", recommendations[0]["explanation"])
        self.assertNotIn("rating", recommendations[0])

    def test_no_show_prediction_is_labeled_as_synthetic_estimate(self):
        response = self.client.post(
            "/no-show-prediction",
            json={
                "appointmentDate": "2026-12-01",
                "appointmentTime": "10:30",
                "bookingLeadDays": 14,
                "reminderSent": False,
                "previousAttendance": "unknown",
            },
        )
        result = response.get_json()
        self.assertEqual(response.status_code, 200)
        self.assertIn(result["estimatedRisk"], {"Low", "Medium", "High"})
        self.assertGreaterEqual(result["estimatedProbability"], 0)
        self.assertLessEqual(result["estimatedProbability"], 1)
        self.assertIn("synthetic data", result["disclaimer"])
        self.assertIn("deny", result["disclaimer"])
        self.assertTrue(result["suggestedReminderActions"])

    def test_no_show_prediction_validates_inputs(self):
        response = self.client.post(
            "/no-show-prediction",
            json={
                "appointmentDate": "not-a-date",
                "appointmentTime": "10:30",
                "bookingLeadDays": 14,
                "reminderSent": False,
            },
        )
        self.assertEqual(response.status_code, 400)


if __name__ == "__main__":
    unittest.main()

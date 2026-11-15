import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split


FEATURE_COLUMNS = [
    "day_of_week",
    "appointment_hour",
    "booking_lead_days",
    "reminder_sent",
    "prior_missed_visits",
]


def build_training_data(row_count=800, random_seed=42):
    random = np.random.default_rng(random_seed)
    days = random.integers(0, 7, row_count)
    hours = random.integers(8, 18, row_count)
    lead_days = random.integers(0, 61, row_count)
    reminders = random.integers(0, 2, row_count)
    previous_missed = random.integers(0, 4, row_count)

    probability = (
        0.12
        + (days >= 5) * 0.08
        + (hours < 9) * 0.05
        + (lead_days > 30) * 0.12
        - reminders * 0.08
        + (previous_missed > 0) * 0.16
        + (previous_missed > 1) * 0.08
    )
    probability = np.clip(probability, 0.04, 0.85)
    outcomes = random.binomial(1, probability)
    return pd.DataFrame(
        {
            "day_of_week": days,
            "appointment_hour": hours,
            "booking_lead_days": lead_days,
            "reminder_sent": reminders,
            "prior_missed_visits": previous_missed,
            "missed": outcomes,
        }
    )


def create_model(training_data=None):
    dataset = training_data if training_data is not None else build_training_data()
    model = RandomForestClassifier(
        n_estimators=120,
        min_samples_leaf=4,
        class_weight="balanced",
        random_state=42,
    )
    model.fit(dataset[FEATURE_COLUMNS], dataset["missed"])
    return model


def evaluate_model():
    dataset = build_training_data()
    features = dataset[FEATURE_COLUMNS]
    labels = dataset["missed"]
    train_features, test_features, train_labels, test_labels = train_test_split(
        features,
        labels,
        test_size=0.25,
        random_state=42,
        stratify=labels,
    )
    model = create_model(
        pd.concat(
            [
                train_features.reset_index(drop=True),
                train_labels.reset_index(drop=True).rename("missed"),
            ],
            axis=1,
        )
    )
    return accuracy_score(test_labels, model.predict(test_features))


def _validate_input(data):
    if not isinstance(data, dict):
        raise ValueError("Provide appointment details as an object.")
    allowed_fields = {
        "appointmentDate",
        "appointmentTime",
        "bookingLeadDays",
        "reminderSent",
        "previousAttendance",
    }
    if set(data) - allowed_fields:
        raise ValueError("One or more appointment fields are not supported.")

    appointment_date = data.get("appointmentDate")
    appointment_time = data.get("appointmentTime")
    if not isinstance(appointment_date, str):
        raise ValueError("Provide a valid appointmentDate.")
    try:
        parsed_date = pd.to_datetime(appointment_date, format="%Y-%m-%d", errors="raise")
    except (TypeError, ValueError):
        raise ValueError("appointmentDate must use YYYY-MM-DD format.") from None
    if parsed_date.strftime("%Y-%m-%d") != appointment_date:
        raise ValueError("appointmentDate must use YYYY-MM-DD format.")

    if not isinstance(appointment_time, str):
        raise ValueError("Provide an appointmentTime in HH:MM format.")
    try:
        hour_text, minute_text = appointment_time.split(":")
        hour, minute = int(hour_text), int(minute_text)
    except (ValueError, AttributeError):
        raise ValueError("appointmentTime must use HH:MM format.") from None
    if (
        len(hour_text) != 2
        or len(minute_text) != 2
        or not 0 <= hour <= 23
        or not 0 <= minute <= 59
    ):
        raise ValueError("appointmentTime must use HH:MM format.")

    lead_days = data.get("bookingLeadDays")
    if (
        isinstance(lead_days, bool)
        or not isinstance(lead_days, int)
        or not 0 <= lead_days <= 365
    ):
        raise ValueError("bookingLeadDays must be a whole number from 0 to 365.")

    reminder_sent = data.get("reminderSent")
    if not isinstance(reminder_sent, bool):
        raise ValueError("reminderSent must be true or false.")

    previous_attendance = data.get("previousAttendance", "unknown")
    if not isinstance(previous_attendance, str):
        raise ValueError("previousAttendance must be unknown, attended, or missed.")
    if previous_attendance not in {"unknown", "attended", "missed"}:
        raise ValueError("previousAttendance must be unknown, attended, or missed.")

    prior_missed_visits = 1 if previous_attendance == "missed" else 0
    return {
        "day_of_week": parsed_date.day_of_week,
        "appointment_hour": hour,
        "booking_lead_days": lead_days,
        "reminder_sent": int(reminder_sent),
        "prior_missed_visits": prior_missed_visits,
    }


def predict_risk(model, data):
    features = pd.DataFrame([_validate_input(data)], columns=FEATURE_COLUMNS)
    probability = float(model.predict_proba(features)[0][list(model.classes_).index(1)])
    if probability < 0.3:
        risk = "Low"
    elif probability < 0.6:
        risk = "Medium"
    else:
        risk = "High"

    return {
        "estimatedRisk": risk,
        "estimatedProbability": round(probability, 2),
        "explanation": (
            "This estimate uses appointment timing, booking lead time, reminder "
            "status, and the optional attendance-history choice you provided."
        ),
        "suggestedReminderActions": [
            "Add the appointment to a calendar you use.",
            "Consider setting a reminder before the appointment.",
            "Contact the clinic if you need help changing your appointment.",
        ],
        "disclaimer": (
            "This is a demonstration estimate trained on synthetic data, not a "
            "validated prediction about an individual. It must never be used to "
            "deny, delay, or restrict care or to penalize a patient."
        ),
    }

import math
import re

import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


_TIME_PATTERN = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
_PREFERENCE_FIELDS = {
    "specialization",
    "availability",
    "preferredTime",
    "maxFee",
    "minExperience",
}


def _validate_preferences(preferences):
    if not isinstance(preferences, dict):
        raise ValueError("Provide doctor preferences as an object.")
    if set(preferences) - _PREFERENCE_FIELDS:
        raise ValueError("One or more doctor preference fields are not supported.")

    specialization = preferences.get("specialization", "")
    if not isinstance(specialization, str):
        raise ValueError("Specialization must be text.")

    availability = preferences.get("availability", "Any")
    if not isinstance(availability, str):
        raise ValueError("Availability must be text.")
    if availability not in {"Any", "Available", "Unavailable"}:
        raise ValueError("Choose Any, Available, or Unavailable availability.")

    preferred_time = preferences.get("preferredTime", "")
    if preferred_time and (
        not isinstance(preferred_time, str)
        or not _TIME_PATTERN.fullmatch(preferred_time)
    ):
        raise ValueError("Preferred time must use 24-hour HH:MM format.")

    for field in ("maxFee", "minExperience"):
        value = preferences.get(field)
        if value is not None and (
            isinstance(value, bool)
            or not isinstance(value, (int, float))
            or not math.isfinite(value)
            or value < 0
        ):
            raise ValueError(f"{field} must be a non-negative number.")


def _time_score(slots, preferred_time):
    if not preferred_time or not slots:
        return 0
    if preferred_time in slots:
        return 1

    preferred_minutes = int(preferred_time[:2]) * 60 + int(preferred_time[3:])
    distances = [
        abs(int(slot[:2]) * 60 + int(slot[3:]) - preferred_minutes)
        for slot in slots
        if isinstance(slot, str) and _TIME_PATTERN.fullmatch(slot)
    ]
    return max(0, 1 - min(distances) / 360) if distances else 0


def recommend_doctors(doctors, preferences):
    _validate_preferences(preferences)
    if not isinstance(doctors, list):
        raise ValueError("Doctor records must be a list.")
    if len(doctors) > 500:
        raise ValueError("Provide no more than 500 doctor records.")
    if not doctors:
        return {"recommendations": []}

    for doctor in doctors:
        if not isinstance(doctor, dict):
            raise ValueError("Each doctor record must be an object.")
        doctor_id = doctor.get("id")
        if (
            isinstance(doctor_id, bool)
            or not isinstance(doctor_id, (str, int))
            or not str(doctor_id).strip()
            or any(
                not isinstance(doctor.get(field), str) or not doctor[field].strip()
                for field in ("name", "specialization")
            )
        ):
            raise ValueError("Doctor IDs must be text or integers; names and specialties must be non-empty text.")
        experience = doctor.get("experienceYears")
        if (
            isinstance(experience, bool)
            or not isinstance(experience, (int, float))
            or not math.isfinite(experience)
            or experience < 0
        ):
            raise ValueError("Doctor experience must be a non-negative number.")
        availability = doctor.get("availability")
        if not isinstance(availability, str) or availability not in {
            "Available",
            "Unavailable",
        }:
            raise ValueError("Doctor availability must be Available or Unavailable.")
        if not isinstance(doctor.get("isActive"), bool):
            raise ValueError("Doctor isActive must be true or false.")
        fee = doctor.get("consultationFee")
        if fee is not None and (
            isinstance(fee, bool)
            or not isinstance(fee, (int, float))
            or not math.isfinite(fee)
            or fee < 0
        ):
            raise ValueError("Doctor consultation fees must be non-negative numbers.")
        slots = doctor.get("timeSlots", [])
        if not isinstance(slots, list) or any(
            not isinstance(slot, str) or not _TIME_PATTERN.fullmatch(slot)
            for slot in slots
        ):
            raise ValueError("Doctor timeSlots must contain 24-hour HH:MM times.")

    frame = pd.DataFrame(doctors)
    required = {
        "id",
        "name",
        "specialization",
        "experienceYears",
        "availability",
        "isActive",
    }
    if not required.issubset(frame.columns):
        raise ValueError("Doctor records are missing required fields.")
    frame = frame[frame["isActive"] != False].copy()  # noqa: E712
    if frame.empty:
        return {"recommendations": []}

    documents = (
        frame["name"].fillna("").astype(str)
        + " "
        + frame["specialization"].fillna("").astype(str)
        + " "
        + frame.get("clinic", pd.Series("", index=frame.index)).fillna("").astype(str)
    )
    query = " ".join(
        part
        for part in (
            preferences.get("specialization", ""),
            preferences.get("availability", ""),
        )
        if part and part != "Any"
    )
    if not query:
        query = "healthcare doctor"

    vectorizer = TfidfVectorizer()
    doctor_vectors = vectorizer.fit_transform(documents)
    preference_vector = vectorizer.transform([query])
    similarity_scores = cosine_similarity(preference_vector, doctor_vectors)[0]

    ranked = []
    for index, (_, doctor) in enumerate(frame.iterrows()):
        score = float(similarity_scores[index]) * 0.35
        reasons = []
        specialization = str(doctor["specialization"])
        requested_specialization = preferences.get("specialization", "").strip()
        if requested_specialization and specialization.casefold() == requested_specialization.casefold():
            score += 0.35
            reasons.append(f"matches your {specialization} specialty preference")
        elif requested_specialization:
            score += float(similarity_scores[index]) * 0.2

        availability = str(doctor.get("availability", "Unavailable"))
        requested_availability = preferences.get("availability", "Any")
        if availability == requested_availability:
            score += 0.2
            reasons.append(f"is {availability.lower()}")
        elif requested_availability == "Any" and availability == "Available":
            score += 0.1
            reasons.append("is currently available")

        slots = doctor.get("timeSlots", [])
        if not isinstance(slots, list):
            slots = []
        preferred_time = preferences.get("preferredTime", "")
        time_score = _time_score(slots, preferred_time)
        score += time_score * 0.15
        if preferred_time and time_score:
            reasons.append(f"has a time slot close to {preferred_time}")

        fee = doctor.get("consultationFee")
        max_fee = preferences.get("maxFee")
        if max_fee is not None and fee is not None and fee <= max_fee:
            score += 0.15
            reasons.append("fits your stated consultation fee preference")

        experience = float(doctor.get("experienceYears") or 0)
        minimum_experience = preferences.get("minExperience")
        if minimum_experience is not None and experience >= minimum_experience:
            score += 0.1
            reasons.append(f"has {experience:g} years of experience")
        elif minimum_experience is None and experience > 0:
            score += min(experience, 20) / 200

        if not reasons:
            reasons.append("is one of the available doctors in the directory")

        ranked.append(
            {
                "id": str(doctor["id"]),
                "name": str(doctor["name"]),
                "specialization": specialization,
                "availability": availability,
                "consultationFee": (
                    float(fee) if fee is not None and not pd.isna(fee) else None
                ),
                "experienceYears": experience,
                "explanation": "Recommended because this doctor " + " and ".join(reasons) + ".",
                "_score": score,
            }
        )

    ranked.sort(
        key=lambda doctor: (
            -doctor["_score"],
            -doctor["experienceYears"],
            doctor["name"].casefold(),
        )
    )
    return {
        "recommendations": [
            {key: value for key, value in doctor.items() if key != "_score"}
            for doctor in ranked[:5]
        ]
    }

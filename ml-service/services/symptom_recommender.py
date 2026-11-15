import numpy as np
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import MultiLabelBinarizer
from sklearn.ensemble import RandomForestClassifier


SYMPTOM_CATALOG = [
    {"value": "chest_pain", "label": "Chest discomfort"},
    {"value": "palpitations", "label": "Noticeable or irregular heartbeat"},
    {"value": "swelling", "label": "Swelling in legs or feet"},
    {"value": "exertional_fatigue", "label": "Unusual tiredness during activity"},
    {"value": "skin_rash", "label": "Skin rash"},
    {"value": "itching", "label": "Itching"},
    {"value": "dry_skin", "label": "Dry or irritated skin"},
    {"value": "mole_change", "label": "Change in a mole"},
    {"value": "headache", "label": "Headache"},
    {"value": "dizziness", "label": "Dizziness"},
    {"value": "numbness", "label": "Numbness or tingling"},
    {"value": "vision_changes", "label": "Changes in vision"},
    {"value": "stomach_pain", "label": "Stomach discomfort"},
    {"value": "nausea", "label": "Nausea"},
    {"value": "heartburn", "label": "Heartburn"},
    {"value": "bloating", "label": "Bloating"},
    {"value": "fever", "label": "Fever"},
    {"value": "cough", "label": "Cough"},
    {"value": "sore_throat", "label": "Sore throat"},
    {"value": "fatigue", "label": "Tiredness"},
    {"value": "ear_pain", "label": "Ear discomfort"},
    {"value": "back_pain", "label": "Back discomfort"},
    {"value": "joint_pain", "label": "Joint discomfort"},
    {"value": "muscle_pain", "label": "Muscle discomfort"},
    {"value": "stiffness", "label": "Stiffness"},
    {"value": "difficulty_breathing", "label": "Difficulty breathing"},
    {"value": "sudden_weakness", "label": "Sudden weakness"},
]

SYMPTOM_VALUES = [item["value"] for item in SYMPTOM_CATALOG]
URGENT_SYMPTOMS = {
    "chest_pain",
    "difficulty_breathing",
    "sudden_weakness",
}

_SYMPTOMS_BY_SPECIALTY = {
    "Cardiology": [
        "chest_pain",
        "palpitations",
        "swelling",
        "exertional_fatigue",
    ],
    "Dermatology": ["skin_rash", "itching", "dry_skin", "mole_change"],
    "Neurology": ["headache", "dizziness", "numbness", "vision_changes"],
    "Gastroenterology": ["stomach_pain", "nausea", "heartburn", "bloating"],
    "General Medicine": [
        "fever",
        "cough",
        "sore_throat",
        "fatigue",
        "ear_pain",
        "difficulty_breathing",
        "sudden_weakness",
    ],
    "Orthopedics": ["back_pain", "joint_pain", "muscle_pain", "stiffness"],
}

_EXPLANATIONS = {
    "Cardiology": "This specialty focuses on heart and circulation concerns.",
    "Dermatology": "This specialty focuses on skin, hair, and nail concerns.",
    "Neurology": "This specialty focuses on the brain, nerves, and related concerns.",
    "Gastroenterology": "This specialty focuses on digestive system concerns.",
    "General Medicine": "A general medical professional can help assess a range of concerns.",
    "Orthopedics": "This specialty focuses on bones, joints, and movement concerns.",
}


def build_training_data(row_count=1200, random_seed=42):
    random = np.random.default_rng(random_seed)
    all_symptoms = set(SYMPTOM_VALUES)
    specialties = list(_SYMPTOMS_BY_SPECIALTY)
    samples = []
    labels = []

    for _ in range(row_count):
        specialty = random.choice(specialties)
        related_symptoms = _SYMPTOMS_BY_SPECIALTY[specialty]
        selected_count = int(random.integers(1, min(4, len(related_symptoms)) + 1))
        selected = random.choice(
            related_symptoms, size=selected_count, replace=False
        ).tolist()
        unrelated_symptoms = sorted(all_symptoms.difference(related_symptoms))
        noise_count = int(random.choice([0, 0, 0, 1]))
        if noise_count:
            selected.extend(random.choice(unrelated_symptoms, size=noise_count).tolist())
        samples.append(selected)
        labels.append(specialty)

    return samples, labels


def create_model():
    training_symptoms, labels = build_training_data()
    binarizer = MultiLabelBinarizer(classes=SYMPTOM_VALUES)
    features = binarizer.fit_transform(training_symptoms)
    model = RandomForestClassifier(
        n_estimators=100,
        min_samples_leaf=2,
        class_weight="balanced",
        random_state=42,
    )
    model.fit(features, labels)
    return model, binarizer


def evaluate_model():
    training_symptoms, labels = build_training_data()
    features = MultiLabelBinarizer(classes=SYMPTOM_VALUES).fit_transform(
        training_symptoms
    )
    train_features, test_features, train_labels, test_labels = train_test_split(
        features,
        labels,
        test_size=0.25,
        random_state=42,
        stratify=labels,
    )
    model = RandomForestClassifier(
        n_estimators=100,
        min_samples_leaf=2,
        class_weight="balanced",
        random_state=42,
    )
    model.fit(train_features, train_labels)
    return accuracy_score(test_labels, model.predict(test_features))


def recommend_specialty(model, binarizer, selected_symptoms):
    if not isinstance(selected_symptoms, list) or not selected_symptoms:
        raise ValueError("Select at least one symptom.")
    if len(selected_symptoms) > 8:
        raise ValueError("Select no more than 8 symptoms.")
    if any(
        not isinstance(symptom, str) or symptom not in SYMPTOM_VALUES
        for symptom in selected_symptoms
    ):
        raise ValueError("Select symptoms from the provided list.")

    unique_symptoms = list(dict.fromkeys(selected_symptoms))
    specialty = str(model.predict(binarizer.transform([unique_symptoms]))[0])
    result = {
        "suggestedSpecialty": specialty,
        "explanation": _EXPLANATIONS[specialty],
        "disclaimer": (
            "This educational suggestion is not a diagnosis and does not confirm "
            "a disease. Please consult a qualified healthcare professional."
        ),
    }

    if URGENT_SYMPTOMS.intersection(unique_symptoms):
        result["urgentGuidance"] = (
            "If you are experiencing severe chest discomfort, difficulty breathing, "
            "or sudden weakness, contact local emergency services or seek immediate "
            "medical care."
        )
    else:
        result["urgentGuidance"] = None

    return result

from pathlib import Path

import pandas as pd
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import MultiLabelBinarizer
from sklearn.tree import DecisionTreeClassifier

from services.no_show_predictor import (
    FEATURE_COLUMNS,
    build_training_data,
    create_model as create_no_show_model,
)
from services.symptom_recommender import (
    build_training_data as build_symptom_training_data,
    evaluate_model as evaluate_symptom_model,
)


DATASET_DIR = Path(__file__).parent / "datasets"


def train_and_report():
    DATASET_DIR.mkdir(exist_ok=True)

    symptoms, specialties = build_symptom_training_data()
    symptom_rows = pd.DataFrame(
        {
            "symptoms": ["|".join(symptom_list) for symptom_list in symptoms],
            "specialty": specialties,
        }
    )
    symptom_rows.to_csv(DATASET_DIR / "synthetic_symptoms.csv", index=False)
    print(
        "Symptom random-forest synthetic holdout accuracy: "
        f"{evaluate_symptom_model():.3f}"
    )

    no_show_data = build_training_data()
    no_show_data.to_csv(DATASET_DIR / "synthetic_no_shows.csv", index=False)
    features = no_show_data[FEATURE_COLUMNS]
    labels = no_show_data["missed"]
    train_features, test_features, train_labels, test_labels = train_test_split(
        features,
        labels,
        test_size=0.25,
        random_state=42,
        stratify=labels,
    )
    training_data = pd.concat(
        [
            train_features.reset_index(drop=True),
            train_labels.reset_index(drop=True).rename("missed"),
        ],
        axis=1,
    )
    model = create_no_show_model(training_data)
    score = accuracy_score(test_labels, model.predict(test_features))
    print(f"No-show random-forest synthetic holdout accuracy: {score:.3f}")
    print(
        "These scores measure only agreement with generated synthetic labels; "
        "they are not real-world model performance."
    )


if __name__ == "__main__":
    train_and_report()

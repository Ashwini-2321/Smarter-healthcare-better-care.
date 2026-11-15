import os

from flask import Flask, jsonify, request

from services.doctor_recommender import recommend_doctors
from services.no_show_predictor import create_model as create_no_show_model
from services.no_show_predictor import predict_risk
from services.symptom_recommender import (
    SYMPTOM_CATALOG,
    create_model as create_symptom_model,
    recommend_specialty,
)


app = Flask(__name__)
symptom_model, symptom_binarizer = create_symptom_model()
no_show_model = create_no_show_model()


def get_json_object():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raise ValueError("Provide a JSON object.")
    return data


def reject_unknown_fields(data, allowed_fields):
    if set(data) - allowed_fields:
        raise ValueError("One or more request fields are not supported.")


@app.get("/health")
def health():
    return jsonify({"status": "ok"})


@app.get("/symptoms")
def get_symptoms():
    return jsonify({"symptoms": SYMPTOM_CATALOG})


@app.post("/symptom-recommendation")
def symptom_recommendation():
    try:
        data = get_json_object()
        reject_unknown_fields(data, {"symptoms"})
        result = recommend_specialty(
            symptom_model, symptom_binarizer, data.get("symptoms")
        )
    except ValueError as error:
        return jsonify({"message": str(error)}), 400
    return jsonify(result)


@app.post("/doctor-recommendation")
def doctor_recommendation():
    try:
        data = get_json_object()
        reject_unknown_fields(data, {"doctors", "preferences"})
        result = recommend_doctors(
            data.get("doctors"), data.get("preferences")
        )
    except ValueError as error:
        return jsonify({"message": str(error)}), 400
    return jsonify(result)


@app.post("/no-show-prediction")
def no_show_prediction():
    try:
        data = get_json_object()
        result = predict_risk(no_show_model, data)
    except ValueError as error:
        return jsonify({"message": str(error)}), 400
    return jsonify(result)


if __name__ == "__main__":
    app.run(
        host=os.environ.get("ML_HOST", "127.0.0.1"),
        port=int(os.environ.get("ML_PORT", "8000")),
        debug=False,
    )

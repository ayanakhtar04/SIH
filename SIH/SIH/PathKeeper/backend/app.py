# backend/app.py
from flask import Flask, jsonify, request
from flask import has_request_context
from flask_cors import CORS
import pandas as pd
import random
import os
from typing import List, Optional
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score, roc_auc_score, confusion_matrix
from sklearn.preprocessing import StandardScaler
import numpy as np
import pickle
import threading
import time
from generate_dataset import generate_new_dataset
from csv_to_sqlite import rebuild_db_from_csv

# Global model holder (demo only; in production consider a class / persistence layer)
MODEL: Optional[LogisticRegression] = None
MODEL_FEATURES: List[str] = []
MODEL_VERSION = 1
MODEL_CLASSES: List[str] = []
MODEL_LOCK = threading.Lock()
SCALER: Optional[StandardScaler] = None
SCHEDULER_THREAD: Optional[threading.Thread] = None
SCHEDULER_STOP = threading.Event()

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

def load_or_generate_df() -> pd.DataFrame:
    """Load student data from SQLite DB if present, else fallback to synthetic dataset."""
    import sqlite3
    base_dir = os.path.dirname(os.path.abspath(__file__))
    db_path = os.path.join(base_dir, 'student_data.db')
    if os.path.exists(db_path):
        conn = sqlite3.connect(db_path)
        df = pd.read_sql_query("SELECT * FROM students", conn)
        conn.close()
        return df
    # Fallback synthetic data
    rows: List[dict] = []
    random.seed(42)
    for i in range(1, 51):
        attendance = random.randint(40, 100)
        score = random.randint(35, 98)
        total_assignments = 10
        submitted = random.randint(0, total_assignments)
        fees_paid = random.choice([0, 1, 1])
        rows.append({
            'student_id': 100 + i,
            'name': f'Student {i}',
            'attendance_percentage': attendance,
            'avg_test_score': score,
            'assignments_submitted': submitted,
            'total_assignments': total_assignments,
            'fees_paid': fees_paid
        })
    return pd.DataFrame(rows)


def enrich_with_risk(df: pd.DataFrame,
                     att_hi: float | None = None,
                     score_hi: float | None = None,
                     att_med: float | None = None,
                     score_med: float | None = None) -> pd.DataFrame:
    """Annotate with risk using thresholds.

    If called within a request, query params can override thresholds.
    When called outside request context (e.g., scheduler), safe defaults are used
    unless explicit values are provided via arguments.
    """
    # Threshold overrides via query params (when available)
    if has_request_context():
        att_hi = float(request.args.get('att_high', att_hi if att_hi is not None else 70))
        score_hi = float(request.args.get('score_high', score_hi if score_hi is not None else 50))
        att_med = float(request.args.get('att_med', att_med if att_med is not None else 80))
        score_med = float(request.args.get('score_med', score_med if score_med is not None else 60))
    else:
        att_hi = 70 if att_hi is None else float(att_hi)
        score_hi = 50 if score_hi is None else float(score_hi)
        att_med = 80 if att_med is None else float(att_med)
        score_med = 60 if score_med is None else float(score_med)

    def calculate_risk(row):
        if row['attendance_percentage'] < att_hi and row['avg_test_score'] < score_hi:
            return 'High Risk'
        elif (row['attendance_percentage'] < att_med or
              row['avg_test_score'] < score_med or
              row['fees_paid'] == 0):
            return 'Medium Risk'
        else:
            return 'Low Risk'

    df = df.copy()
    df['risk_level'] = df.apply(calculate_risk, axis=1)

    def get_risk_color(risk_level):
        return {'High Risk': '#FF4136', 'Medium Risk': '#FF851B'}.get(risk_level, '#2ECC40')

    df['risk_color'] = df['risk_level'].apply(get_risk_color)

    def reasons_and_history(row):
        reasons = []
        if row['attendance_percentage'] < 70:
            reasons.append('Low attendance')
        if row['avg_test_score'] < 50:
            reasons.append('Low average test score')
        if row['assignments_submitted'] / max(row['total_assignments'], 1) < 0.6:
            reasons.append('Incomplete assignments')
        if row['fees_paid'] == 0:
            reasons.append('Fees pending')

        def gen_history(current, volatility=5, trend=0.0):
            vals = []
            v = max(0.0, float(current))
            for _ in range(8, 0, -1):
                noise = random.uniform(-volatility, volatility)
                v_step = max(0.0, min(100.0, v + noise + trend))
                vals.append(round(v_step, 1))
                v = v_step
            return vals

        level = row['risk_level']
        if level == 'High Risk':
            att_hist = gen_history(row['attendance_percentage'], volatility=7, trend=-1.2)
            score_hist = gen_history(row['avg_test_score'], volatility=8, trend=-0.8)
        elif level == 'Medium Risk':
            att_hist = gen_history(row['attendance_percentage'], volatility=5, trend=-0.4)
            score_hist = gen_history(row['avg_test_score'], volatility=6, trend=-0.2)
        else:
            att_hist = gen_history(row['attendance_percentage'], volatility=3, trend=0.2)
            score_hist = gen_history(row['avg_test_score'], volatility=3, trend=0.3)
        return pd.Series({
            'risk_reasons': reasons,
            'attendance_history': att_hist,
            'score_history': score_hist,
        })

    extra = df.apply(reasons_and_history, axis=1)
    return pd.concat([df, extra], axis=1)


def prepare_ml_dataset(df: pd.DataFrame):
    """Prepare X,y for multiclass model (Low / Medium Risk / High Risk)."""
    # Map textual labels directly
    y = df['risk_level']
    completion_ratio = (df['assignments_submitted'] / df['total_assignments'].replace({0: 1})).fillna(0)
    X = pd.DataFrame({
        'attendance_percentage': df['attendance_percentage'],
        'avg_test_score': df['avg_test_score'],
        'completion_ratio': completion_ratio,
        'fees_paid': df['fees_paid']
    })
    return X, y


def _persist_model(model: LogisticRegression):
    models_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'models')
    os.makedirs(models_dir, exist_ok=True)
    filename = f'model_v{MODEL_VERSION}.pkl'
    path = os.path.join(models_dir, filename)
    with open(path, 'wb') as f:
        pickle.dump({
            'version': MODEL_VERSION,
            'model': model,
            'features': MODEL_FEATURES,
            'classes': MODEL_CLASSES,
            'scaler': SCALER
        }, f)
    # also write latest.pkl
    latest = os.path.join(models_dir, 'latest.pkl')
    with open(latest, 'wb') as f:
        pickle.dump({
            'version': MODEL_VERSION,
            'model': model,
            'features': MODEL_FEATURES,
            'classes': MODEL_CLASSES,
            'scaler': SCALER
        }, f)
    return path


def _load_latest_model_if_any() -> bool:
    """Attempt to load the latest persisted model from disk into globals.

    Returns True on success, False if no file or load error.
    """
    global MODEL, MODEL_FEATURES, MODEL_VERSION, MODEL_CLASSES, SCALER
    try:
        models_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'models')
        latest = os.path.join(models_dir, 'latest.pkl')
        if not os.path.exists(latest):
            return False
        with open(latest, 'rb') as f:
            payload = pickle.load(f)
        with MODEL_LOCK:
            MODEL = payload.get('model')
            MODEL_FEATURES = payload.get('features', [])
            MODEL_CLASSES = payload.get('classes', [])
            SCALER = payload.get('scaler')
            try:
                MODEL_VERSION = int(payload.get('version', MODEL_VERSION))
            except Exception:
                pass
        return MODEL is not None
    except Exception as e:
        print('Failed to load latest model:', e)
        return False


def _train_internal() -> dict:
    global MODEL, MODEL_FEATURES, MODEL_VERSION, MODEL_CLASSES, SCALER
    base_df = enrich_with_risk(load_or_generate_df())
    X, y = prepare_ml_dataset(base_df)
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42, stratify=y)
    # Fit scaler on train and transform train/test
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    model = LogisticRegression(max_iter=500, multi_class='auto')
    model.fit(X_train_scaled, y_train)
    y_pred = model.predict(X_test_scaled)
    acc = float(accuracy_score(y_test, y_pred))
    # Per-class metrics
    classes = sorted(y.unique())
    MODEL_CLASSES = classes
    metrics_per_class = {}
    for cls in classes:
        # binary view per class
        y_true_bin = (y_test == cls).astype(int)
        y_pred_bin = (y_pred == cls).astype(int)
        metrics_per_class[cls] = {
            'precision': float(precision_score(y_true_bin, y_pred_bin, zero_division=0)),
            'recall': float(recall_score(y_true_bin, y_pred_bin, zero_division=0)),
            'f1': float(f1_score(y_true_bin, y_pred_bin, zero_division=0)),
        }
    # Macro averages
    macro_precision = float(np.mean([m['precision'] for m in metrics_per_class.values()]))
    macro_recall = float(np.mean([m['recall'] for m in metrics_per_class.values()]))
    macro_f1 = float(np.mean([m['f1'] for m in metrics_per_class.values()]))

    # Probabilities for ROC AUC macro (one-vs-rest) if possible
    try:
        y_proba = model.predict_proba(X_test_scaled)
        # Build one-hot matrix
        class_indices = {c: i for i, c in enumerate(model.classes_)}
        y_test_indices = y_test.map(class_indices)
        y_test_oh = np.zeros((len(y_test_indices), len(model.classes_)))
        for i, idx in enumerate(y_test_indices):
            y_test_oh[i, idx] = 1
        macro_roc_auc = float(roc_auc_score(y_test_oh, y_proba, multi_class='ovr'))
    except Exception:
        macro_roc_auc = None

    with MODEL_LOCK:
        MODEL = model
        MODEL_FEATURES = list(X.columns)
        MODEL_VERSION += 1
        SCALER = scaler
        _persist_model(model)

    # Feature importance (coefficients). For multiclass, report per class.
    coefs = {}
    try:
        for cls_idx, cls in enumerate(model.classes_):
            coefs[str(cls)] = {feat: float(model.coef_[cls_idx][i]) for i, feat in enumerate(MODEL_FEATURES)}
    except Exception:
        coefs = {}

    # Confusion matrix in class order
    cm = confusion_matrix(y_test, y_pred, labels=MODEL_CLASSES).tolist()

    return {
        'status': 'trained',
        'version': MODEL_VERSION,
        'overall': {
            'accuracy': acc,
            'macro_precision': macro_precision,
            'macro_recall': macro_recall,
            'macro_f1': macro_f1,
            'macro_roc_auc': macro_roc_auc,
        },
        'per_class': metrics_per_class,
        'features': MODEL_FEATURES,
        'classes': MODEL_CLASSES,
        'coefficients': coefs,
        'confusion_matrix': cm,
        'samples': len(X)
    }


@app.route('/api/train', methods=['POST'])
def train_model():
    result = _train_internal()
    return jsonify(result)


@app.route('/api/predict', methods=['POST'])
def predict():
    if MODEL is None:
        return jsonify({'error': 'Model not trained yet. Call /api/train first.'}), 400
    payload = request.get_json(silent=True) or {}
    items = payload.get('students') or []
    if not isinstance(items, list) or len(items) == 0:
        return jsonify({'error': 'Provide students: [...] list'}), 400

    rows = []
    for it in items:
        rows.append({
            'attendance_percentage': it.get('attendance_percentage', 0),
            'avg_test_score': it.get('avg_test_score', 0),
            'completion_ratio': (it.get('assignments_submitted', 0) / max(it.get('total_assignments', 1), 1)),
            'fees_paid': it.get('fees_paid', 0)
        })
    X = pd.DataFrame(rows)
    for col in MODEL_FEATURES:
        if col not in X.columns:
            X[col] = 0
    X = X[MODEL_FEATURES]
    with MODEL_LOCK:
        X_scaled = SCALER.transform(X) if SCALER is not None else X
        probs = MODEL.predict_proba(X_scaled)
        pred_labels = MODEL.predict(X_scaled)
        class_list = list(MODEL_CLASSES)
    results = []
    for original, label, prob_vec in zip(items, pred_labels, probs):
        probs_map = {cls: float(prob_vec[i]) for i, cls in enumerate(class_list)}
        results.append({
            'input': original,
            'predicted_risk': label,
            'probabilities': probs_map
        })
    return jsonify({
        'version': MODEL_VERSION,
        'count': len(results),
        'classes': class_list,
        'results': results
    })


def _scheduler_loop(interval_seconds: int):
    while not SCHEDULER_STOP.is_set():
        try:
            _train_internal()
        except Exception as e:
            print('Scheduled retrain failed:', e)
        SCHEDULER_STOP.wait(interval_seconds)


@app.route('/api/schedule_retrain', methods=['POST'])
def schedule_retrain():
    global SCHEDULER_THREAD
    payload = request.get_json(silent=True) or {}
    interval = int(payload.get('interval_seconds', 3600))
    if interval < 60:
        return jsonify({'error': 'Minimum interval 60 seconds'}), 400
    if SCHEDULER_THREAD and SCHEDULER_THREAD.is_alive():
        return jsonify({'status': 'already-running'}), 200
    SCHEDULER_STOP.clear()
    SCHEDULER_THREAD = threading.Thread(target=_scheduler_loop, args=(interval,), daemon=True)
    SCHEDULER_THREAD.start()
    return jsonify({'status': 'scheduled', 'interval_seconds': interval})


@app.route('/api/stop_retrain', methods=['POST'])
def stop_retrain():
    if not SCHEDULER_THREAD or not SCHEDULER_THREAD.is_alive():
        return jsonify({'status': 'not-running'})
    SCHEDULER_STOP.set()
    return jsonify({'status': 'stopping'})


@app.route('/health', methods=['GET'])
def health():
    """Simple health check with model status."""
    loaded = MODEL is not None and SCALER is not None and len(MODEL_FEATURES) > 0
    return jsonify({
        'status': 'ok',
        'model_loaded': loaded,
        'model_version': MODEL_VERSION,
        'features': MODEL_FEATURES,
    })


@app.route('/api/students', methods=['GET'])
def get_students():
    df = load_or_generate_df()

    # Enrich with risk first (so we can filter by risk)
    df = enrich_with_risk(df)

    # Filtering params
    search = request.args.get('search', '').strip().lower()
    risk_filter = request.args.get('risk')  # e.g. High Risk|Medium Risk|Low Risk or comma separated
    attendance_min = request.args.get('attendance_min')
    assign_min = request.args.get('assignment_min')
    fees_paid = request.args.get('fees_paid')  # '1' for paid only

    if search:
        df = df[df['name'].str.lower().str.contains(search)]
    if risk_filter:
        parts = {p.strip() for p in risk_filter.replace(',', '|').split('|') if p.strip()}
        df = df[df['risk_level'].isin(parts)]
    if attendance_min:
        try:
            val = float(attendance_min)
            df = df[df['attendance_percentage'] >= val]
        except ValueError:
            pass
    if assign_min:
        try:
            val = float(assign_min)
            frac = df['assignments_submitted'] / df['total_assignments'].replace({0: 1})
            df = df[frac >= val]
        except ValueError:
            pass
    if fees_paid == '1':
        df = df[df['fees_paid'] == 1]

    # Sorting
    sort_by = request.args.get('sort_by', 'student_id')
    sort_dir = request.args.get('sort_dir', 'asc')
    if sort_by not in df.columns:
        sort_by = 'student_id'
    ascending = sort_dir != 'desc'
    try:
        df = df.sort_values(by=sort_by, ascending=ascending)
    except Exception:
        pass

    total = len(df)

    # Pagination
    try:
        page = int(request.args.get('page', 1))
        page_size = int(request.args.get('page_size', 25))
    except ValueError:
        page, page_size = 1, 25
    page = max(1, page)
    page_size = max(1, min(200, page_size))
    start = (page - 1) * page_size
    end = start + page_size
    page_df = df.iloc[start:end]

    data = page_df.to_dict(orient='records')
    return jsonify({
        'data': data,
        'total': total,
        'page': page,
        'page_size': page_size
    })


@app.route('/api/notify', methods=['POST'])
def notify():
    payload = request.get_json(silent=True) or {}
    student_ids = payload.get('student_ids', [])
    channel = payload.get('channel', 'email')  # email or sms
    message = payload.get('message', 'Intervention scheduled.')
    # Stub: just echo back. A real implementation would integrate with SendGrid / Twilio etc.
    print(f"NOTIFY stub -> channel={channel} ids={student_ids} message={message}")
    return jsonify({
        'status': 'queued',
        'channel': channel,
        'count': len(student_ids),
        'message_preview': message[:120]
    })


@app.route('/api/regenerate_dataset', methods=['POST'])
def regenerate_dataset():
    """Regenerate synthetic dataset and retrain the model in one click.

    Optional JSON body:
      - num_students: int (default 300)
      - seed: int (default random)
    """
    payload = request.get_json(silent=True) or {}
    num_students = int(payload.get('num_students', 300))
    seed = payload.get('seed', None)
    if seed is not None:
        try:
            seed = int(seed)
        except Exception:
            seed = None
    path = generate_new_dataset(num_students=num_students, seed=seed)
    # Sync CSV -> SQLite so subsequent reads reflect the new dataset
    try:
        rebuild_db_from_csv()
        csv_loaded = True
    except Exception as e:
        print('CSV to SQLite import failed:', e)
        csv_loaded = False
    # Retrain on the fresh data
    result = _train_internal()
    return jsonify({
        'status': 'regenerated',
        'dataset_path': path,
        'csv_loaded_into_sqlite': csv_loaded,
        'trained': result
    })

# Attempt to autoload latest model when the module is imported (dev/prod)
_load_latest_model_if_any()

if __name__ == '__main__':
    # Attempt to autoload latest model when running directly
    _load_latest_model_if_any()
    host = os.getenv('HOST', '0.0.0.0')
    try:
        port = int(os.getenv('PORT', '5055'))
    except Exception:
        port = 5055
    debug = os.getenv('FLASK_DEBUG', '1') not in ('0', 'false', 'False')
    app.run(host=host, port=port, debug=debug)

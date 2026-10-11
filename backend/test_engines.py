"""
test_engines.py — regression + profiling tests for the Hybrid Execution Engine.

Run with:  python3 -m pytest backend/test_engines.py -q
(or `python3 backend/test_engines.py` for a dependency-free runner that works
where pytest is not installed — see `main()` at the bottom.)

These cover the bugs that actually shipped and were caught by inspection rather
than by tests:

  * target routing disagreed between the loader and the executor, so integer
    prices forced to regression were re-detected as classification and an ID
    column 0…N-1 was accepted as a regression target;
  * a blank cell flipped a numeric column to "categorical", and numeric
    columns with gaps had their statistics read off ordinal codes;
  * the correlation block referenced a variable outside its defining block.

Everything here runs against the real engine functions — no mocks.
"""

from __future__ import annotations

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np

import basic_ml_engine as eng


# ── fixtures ────────────────────────────────────────────────────────────────

MESSY_CSV = """age,income,city,score,constant
27,42000,London,0.82,1
,,Paris,0.91,1
45,,London,,1
33,61000,,0.77,1
,,,0.55,1"""


def _csv_dataset(text: str, target: str) -> dict:
    return {"csvText": text, "targetColumn": target, "filename": "test.csv"}


# ── target routing ──────────────────────────────────────────────────────────

def test_integer_prices_route_to_regression():
    """Many distinct numeric values is a continuous target, not 40 classes."""
    values = [str(i * 1000 + 0.5) for i in range(500)]
    text = "x,t\n" + "\n".join(f"{i},{v}" for i, v in enumerate(values)) + "\n"
    X, y, _f, _t, _n, task = eng.load_csv_dataset(_csv_dataset(text, "t"), {})
    assert task == "regression"
    assert y.dtype.kind == "f"
    assert X.shape[0] == 500


def test_binary_labels_stay_classification():
    values = ["1" if i % 5 == 0 else "0" for i in range(200)]
    text = "x,t\n" + "\n".join(f"{i},{v}" for i, v in enumerate(values)) + "\n"
    _X, _y, _f, target_names, _n, task = eng.load_csv_dataset(_csv_dataset(text, "t"), {})
    assert task == "classification"
    assert len(target_names) == 2


def test_forced_regression_beats_auto_detection():
    """resolve_task must honour an explicit request — this is what disagreed
    between the loader and the executor."""
    values = ["10", "20", "30", "40", "50"]
    text = "x,t\n" + "\n".join(f"{i},{v}" for i, v in enumerate(values)) + "\n"
    _X, _y, _f, _t, _n, task = eng.load_csv_dataset(_csv_dataset(text, "t"), {"task": "regression"})
    assert task == "regression"
    assert eng.resolve_task(np.asarray([10.0, 20.0, 30.0]), "regression") == "regression"


def test_identifier_column_is_rejected():
    """0…N-1 in order is an ID, not a measurement. Fitting it yields a
    meaningless R² of ~1.0 that looks like a triumph."""
    text = "x,id\n" + "\n".join(f"{i},{i}" for i in range(400)) + "\n"
    try:
        eng.load_csv_dataset(_csv_dataset(text, "id"), {})
    except ValueError as exc:
        assert "identifier" in str(exc).lower()
    else:
        raise AssertionError("an identifier-shaped target should be rejected")


def test_constant_target_is_rejected():
    text = "x,t\n" + "\n".join(f"{i},5" for i in range(120)) + "\n"
    try:
        eng.load_csv_dataset(_csv_dataset(text, "t"), {"task": "regression"})
    except ValueError as exc:
        assert "constant" in str(exc).lower()
    else:
        raise AssertionError("a constant target should be rejected")


def test_many_distinct_codes_rejected_not_regressed():
    text = "x,sku\n" + "\n".join(f"{i},SKU_{i}" for i in range(120)) + "\n"
    try:
        eng.load_csv_dataset(_csv_dataset(text, "sku"), {})
    except ValueError as exc:
        assert "30" in str(exc) or "distinct" in str(exc).lower()
    else:
        raise AssertionError("too many distinct non-numeric classes should error")


# ── CSV column facts (missingness / kind) ───────────────────────────────────

def test_blank_cell_is_missing_not_a_kind_change():
    """`age` has 40% blanks but is still a numeric column."""
    dataset = _csv_dataset(MESSY_CSV, "constant")
    rows, _fns, _tgt, feats = eng._read_csv_rows(dataset)
    missing, numeric, _modal, values = eng.csv_column_kinds(rows, feats)
    assert missing["age"] == 2
    assert numeric["age"] is True
    assert values["age"] == [27.0, 45.0, 33.0]
    assert numeric["city"] is False
    assert missing["city"] == 2


def test_numeric_with_blanks_keeps_real_values():
    """The loader ordinal-encodes columns with blanks, so statistics must come
    from the raw values, not from X."""
    dataset = _csv_dataset(MESSY_CSV, "constant")
    rows, _fns, _tgt, feats = eng._read_csv_rows(dataset)
    _missing, _numeric, _modal, values = eng.csv_column_kinds(rows, feats)
    X, _y, feature_names, _t, _n, _task = eng.load_csv_dataset(dataset, {})
    # X is encoded; the profile source must not be.
    assert sorted(values["income"]) == [42000.0, 61000.0]
    assert feature_names == feats


def test_modal_value_is_raw_not_an_ordinal_code():
    dataset = _csv_dataset(MESSY_CSV, "constant")
    rows, _fns, _tgt, feats = eng._read_csv_rows(dataset)
    _missing, _numeric, modal, _values = eng.csv_column_kinds(rows, feats)
    assert modal["city"][0] == "London"
    assert modal["city"][1] == 2


# ── profiling ───────────────────────────────────────────────────────────────

def test_profile_reports_real_missingness_on_a_messy_csv():
    """The bug this guards: profiling the encoded matrix reported zero
    missing values for every CSV, because np.isnan is always False after
    encoding. The summary count AND the findings were both derived from it."""
    # 'city' has two distinct values, so it works as a crude target; its blanks
    # are what the profiler must report.
    dataset = _csv_dataset(MESSY_CSV, "city")
    X, y, feature_names, target_names, _n, _task = eng.load_csv_dataset(dataset, {})
    rows, _fns, _tgt, feats = eng._read_csv_rows(dataset)
    missing, numeric, modal, values = eng.csv_column_kinds(rows, feats)
    profile = eng.build_data_profile(
        X, y, feature_names, target_names,
        raw_missing=missing, raw_numeric=numeric, raw_modal=modal, raw_values=values,
    )
    # features are age(2) + income(3) + score(1); 'city' is the target here.
    assert profile["n_missing"] == 6, profile["n_missing"]
    by_name = {c["name"]: c for c in profile["columns_profile"]}
    assert by_name["age"]["missing"] == 2
    assert by_name["age"]["mean"] == 35.0  # real mean of [27,45,33]
    assert by_name["income"]["mean"] == 51500.0
    assert any("missing" in f["title"].lower() for f in profile["findings"])


def test_profile_correlation_survives_few_numeric_columns():
    """Previously referenced `sub` outside the block that defined it, raising
    NameError whenever fewer than two numeric columns existed."""
    X = np.array([[1.0, 2.0], [2.0, 4.0], [3.0, 6.0], [4.0, 8.0]])
    y = np.array([0.0, 1.0, 0.0, 1.0])
    profile = eng.build_data_profile(
        X, y, ["a", "b"], [], raw_numeric={"a": True, "b": True},
        raw_missing={"a": 0, "b": 0},
        raw_modal={}, raw_values={"a": [1.0, 2.0, 3.0, 4.0], "b": [2.0, 4.0, 6.0, 8.0]},
    )
    assert profile["correlation_matrix"], "expected a correlation matrix"
    assert profile["high_correlation"][0]["r"] == 1.0


def test_profile_skips_correlation_when_only_one_numeric_column():
    X = np.array([[1.0, 5.0], [2.0, 6.0], [3.0, 7.0]])
    y = np.array([0.0, 1.0, 0.0])
    profile = eng.build_data_profile(
        X, y, ["a", "b"], [], raw_numeric={"a": True, "b": False},
        raw_missing={"a": 0, "b": 0}, raw_modal={}, raw_values={"a": [1.0, 2.0, 3.0]},
    )
    assert profile["correlation_matrix"] == []


# ── regressor factory ───────────────────────────────────────────────────────

def test_regressor_factory_resolves_shared_node_types():
    for node_type in ("ml:boosting", "ml:forest", "ml:ridge", "ml:svm", "ml:knn"):
        estimator, name, framework, _v = eng.make_model(node_type, {}, "regression")
        assert estimator.__class__.__name__.endswith("Regressor"), node_type
        assert "Regress" in name or "Ridge" in name or "Elastic" in name, node_type
        assert framework


def test_classification_still_resolves_classifiers():
    estimator, _name, _fw, _v = eng.make_model("ml:logistic", {}, "classification")
    assert estimator.__class__.__name__.endswith("Classifier")


# ── clustering ──────────────────────────────────────────────────────────────

def test_kmeans_and_dbscan_resolve():
    estimator, name, _fw, _v = eng.make_model("ml:kmeans", {"n_clusters": 4}, "clustering")
    assert estimator.__class__.__name__ == "KMeans"
    assert estimator.n_clusters == 4
    estimator, name, _fw, _v = eng.make_model("ml:dbscan", {"eps": 0.4}, "clustering")
    assert estimator.__class__.__name__ == "DBSCAN"
    assert estimator.eps == 0.4


def test_clustering_is_selected_by_the_model_not_the_target():
    """KMeans wins over the loader's classification/regression verdict, because
    the model type is what makes the run unsupervised."""
    nodes = [
        {"type": "data:iris", "category": "data", "params": {}},
        {"type": "ml:kmeans", "category": "classic_ml", "params": {"n_clusters": 3}},
    ]
    result = eng.execute(nodes)
    assert result["status"] == "success", result.get("error")
    assert result["model"]["task"] == "clustering"
    assert result["dataset"]["target_type"] == "unsupervised"


def test_clustering_uses_every_row_not_a_train_split():
    """A supervised split would silently cluster only 80% of the data."""
    nodes = [
        {"type": "data:iris", "category": "data", "params": {}},
        {"type": "ml:kmeans", "category": "classic_ml", "params": {"n_clusters": 3}},
    ]
    result = eng.execute(nodes)
    assert result["predictions"]["n_test"] == 150  # all of iris
    assert len(result["predictions"]["y_pred"]) == 150


def test_clustering_reports_silhouette_not_accuracy():
    nodes = [
        {"type": "data:iris", "category": "data", "params": {}},
        {"type": "ml:kmeans", "category": "classic_ml", "params": {"n_clusters": 3}},
    ]
    result = eng.execute(nodes)
    # No ground truth, so accuracy/F1/ROC would be meaningless numbers.
    for bogus in ("accuracy", "f1", "roc_auc", "precision", "recall"):
        assert bogus not in result["metrics"], bogus
    assert result["metrics"]["n_clusters"] >= 1
    assert "silhouette" in result["metrics"]
    assert "cluster_scatter" in result["charts"]
    assert "cluster_sizes" in result["charts"]


# ── minimal runner ──────────────────────────────────────────────────────────

def main() -> int:
    tests = [(n, f) for n, f in sorted(globals().items()) if n.startswith("test_") and callable(f)]
    failures = []
    for name, fn in tests:
        try:
            fn()
            print(f"  PASS  {name}")
        except Exception as exc:  # noqa: BLE001
            failures.append((name, exc))
            print(f"  FAIL  {name}: {type(exc).__name__}: {exc}")
    print(f"\n{len(tests) - len(failures)}/{len(tests)} passed")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
"""
test_standalone.py — runs the pure-Python/numpy parts of the engine on a host
without scikit-learn.

The full suite (test_engines.py) needs scikit-learn, which has no Android/aarch64
wheel and cannot be built here. But the code that actually caused the shipped
bugs — CSV target routing and per-column missingness extraction — depends only
on the stdlib and numpy. Those functions are extracted from basic_ml_engine.py
by source, not re-implemented, so this still tests the shipped code.
"""
import ast
import csv
import io
import sys
import warnings
from typing import Any, Dict, List, Tuple

import numpy as np

ENGINE_PATH = "basic_ml_engine.py"


def _load_functions(path, names):
    """Compile just the named top-level defs out of the real module source.

    Avoids importing the module (which needs sklearn) while still exercising the
    exact code that ships.
    """
    src = open(path).read()
    tree = ast.parse(src, path)
    wanted = []
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name in names:
            wanted.append(node)
        elif isinstance(node, ast.ClassDef) and node.name in names:
            wanted.append(node)
        elif isinstance(node, ast.Assign):
            for t in node.targets:
                if isinstance(t, ast.Name) and t.id in names:
                    wanted.append(node)
    missing = names - {n.name if hasattr(n, "name") else getattr(n.targets[0], "id", "") for n in wanted}
    if missing:
        raise RuntimeError(f"could not find {sorted(missing)} in {path}")
    mod = ast.Module(body=wanted, type_ignores=[])
    ns = {"np": np, "Any": Any, "Dict": Dict, "List": List, "Tuple": Tuple, "warnings": warnings}
    exec(compile(mod, path, "exec"), ns)
    return ns


ns = _load_functions(ENGINE_PATH, {
    "_safe_float", "_is_indexable", "_read_csv_rows", "csv_column_kinds", "resolve_task",
    "load_csv_dataset", "build_data_profile", "_safe_cell",
})
# The extracted functions use these module-level imports directly.
ns["csv"] = csv
ns["io"] = io

class _LabelEncoder:
    """Minimal stand-in: sklearn's fits sorted unique labels to 0..n-1."""

    def fit(self, values):
        self.classes_ = np.asarray(sorted(set(values)))
        return self

    def fit_transform(self, values):
        self.fit(values)
        lookup = {v: i for i, v in enumerate(self.classes_)}
        return np.asarray([lookup[v] for v in values])


class _OrdinalEncoder:
    """Minimal stand-in mapping categories to integer codes in first-seen order."""

    def __init__(self, handle_unknown=None, unknown_value=None):
        self.handle_unknown = handle_unknown
        self.unknown_value = unknown_value

    def fit_transform(self, arr):
        flat = [row[0] for row in arr]
        codes = {}
        out = []
        for v in flat:
            if v not in codes:
                codes[v] = len(codes)
            out.append(codes[v])
        self.categories_ = list(codes)
        return np.asarray(out, dtype=float).reshape(-1, 1)


ns["LabelEncoder"] = _LabelEncoder
ns["OrdinalEncoder"] = _OrdinalEncoder


def _dataset(text, target):
    return {"csvText": text, "targetColumn": target, "filename": "test.csv"}


MESSY_CSV = """age,income,city,score,constant
27,42000,London,0.82,1
,,Paris,0.91,1
45,,London,,1
33,61000,,0.77,1
,,,0.55,1"""


def test_integer_prices_route_to_regression():
    values = [str(i * 1000 + 0.5) for i in range(500)]
    text = "x,t\n" + "\n".join(f"{i},{v}" for i, v in enumerate(values)) + "\n"
    X, y, _f, _t, _n, task = ns["load_csv_dataset"](_dataset(text, "t"), {})
    assert task == "regression", task
    assert y.dtype.kind == "f"
    assert X.shape[0] == 500


def test_binary_labels_stay_classification():
    values = ["1" if i % 5 == 0 else "0" for i in range(200)]
    text = "x,t\n" + "\n".join(f"{i},{v}" for i, v in enumerate(values)) + "\n"
    _X, _y, _f, names, _n, task = ns["load_csv_dataset"](_dataset(text, "t"), {})
    assert task == "classification", task
    assert len(names) == 2


def test_forced_regression_beats_auto():
    text = "x,t\n" + "\n".join(f"{i},{v}" for i, v in enumerate(["10", "20", "30", "40", "50"])) + "\n"
    _X, _y, _f, _t, _n, task = ns["load_csv_dataset"](_dataset(text, "t"), {"task": "regression"})
    assert task == "regression", task
    assert ns["resolve_task"](np.asarray([10.0, 20.0, 30.0]), "regression") == "regression"


def test_identifier_column_rejected():
    text = "x,id\n" + "\n".join(f"{i},{i}" for i in range(400)) + "\n"
    try:
        ns["load_csv_dataset"](_dataset(text, "id"), {})
    except ValueError as exc:
        assert "identifier" in str(exc).lower(), exc
    else:
        raise AssertionError("identifier-shaped target should be rejected")


def test_constant_target_rejected():
    text = "x,t\n" + "\n".join(f"{i},5" for i in range(120)) + "\n"
    try:
        ns["load_csv_dataset"](_dataset(text, "t"), {"task": "regression"})
    except ValueError as exc:
        assert "constant" in str(exc).lower(), exc
    else:
        raise AssertionError("constant target should be rejected")


def test_many_distinct_codes_rejected():
    text = "x,sku\n" + "\n".join(f"{i},SKU_{i}" for i in range(120)) + "\n"
    try:
        ns["load_csv_dataset"](_dataset(text, "sku"), {})
    except ValueError:
        pass
    else:
        raise AssertionError("too many non-numeric classes should error")


def test_blank_is_missing_not_a_kind_change():
    ds = _dataset(MESSY_CSV, "constant")
    rows, _fns, _tgt, feats = ns["_read_csv_rows"](ds)
    missing, numeric, _modal, values, _tops = ns["csv_column_kinds"](rows, feats)
    assert missing["age"] == 2, missing
    assert numeric["age"] is True, numeric
    assert values["age"] == [27.0, 45.0, 33.0], values
    assert numeric["city"] is False
    assert missing["city"] == 2


def test_modal_value_is_raw():
    ds = _dataset(MESSY_CSV, "constant")
    rows, _fns, _tgt, feats = ns["_read_csv_rows"](ds)
    _m, _n, modal, _v, _t = ns["csv_column_kinds"](rows, feats)
    assert modal["city"][0] == "London", modal
    assert modal["city"][1] == 2, modal


def test_profile_reports_real_missingness():
    """The shipped bug: profiling the encoded matrix reported zero missing
    values for every CSV because np.isnan is always False after encoding."""
    # 'city' has two distinct values, so it is a valid (if crude) target; the
    # blank in it is exactly what the profiler must report.
    ds = _dataset(MESSY_CSV, "city")
    X, y, feature_names, target_names, _n, _task = ns["load_csv_dataset"](ds, {})
    rows, _fns, _tgt, feats = ns["_read_csv_rows"](ds)
    missing, numeric, modal, values, _tops = ns["csv_column_kinds"](rows, feats)
    prof = ns["build_data_profile"](
        X, y, feature_names, target_names,
        raw_missing=missing, raw_numeric=numeric, raw_modal=modal, raw_values=values,
    )
    # features are age(2) + income(3) + score(1) = 6 blank cells; 'city' is the
    # target here so it is not counted as a feature.
    assert prof["n_missing"] == 6, prof["n_missing"]
    by_name = {c["name"]: c for c in prof["columns_profile"]}
    assert by_name["age"]["missing"] == 2
    assert by_name["age"]["mean"] == 35.0, by_name["age"]
    assert by_name["income"]["mean"] == 51500.0, by_name["income"]
    assert by_name["score"]["missing"] == 1
    assert any("missing" in f["title"].lower() for f in prof["findings"])


def test_correlation_survives_single_numeric_column():
    X = np.array([[1.0, 5.0], [2.0, 6.0], [3.0, 7.0]])
    y = np.array([0.0, 1.0, 0.0])
    prof = ns["build_data_profile"](
        X, y, ["a", "b"], [], raw_numeric={"a": True, "b": False},
        raw_missing={"a": 0, "b": 0}, raw_modal={}, raw_values={"a": [1.0, 2.0, 3.0]},
    )
    assert prof["correlation_matrix"] == []


def test_profile_exposes_distributions_and_real_rows():
    """The gap versus real analytics tools: the profile showed aggregates but
    never the data. Every column now carries a distribution and the explorer
    gets a bounded slice of actual rows."""
    ds = _dataset(MESSY_CSV, "city")
    X, y, feature_names, target_names, _n, _task = ns["load_csv_dataset"](ds, {})
    rows, _fns, _tgt, feats = ns["_read_csv_rows"](ds)
    missing, numeric, modal, values, tops = ns["csv_column_kinds"](rows, feats)
    prof = ns["build_data_profile"](
        X, y, feature_names, target_names,
        raw_missing=missing, raw_numeric=numeric, raw_modal=modal, raw_values=values,
        raw_modal_counts=tops, sample_rows=100,
    )
    by_name = {c["name"]: c for c in prof["columns_profile"]}
    # numeric column gets a binned histogram
    hist = by_name["age"].get("histogram")
    assert hist, "age should carry a distribution"
    assert hist["kind"] == "numeric"
    assert len(hist["counts"]) == len(hist["edges"]) - 1
    assert sum(hist["counts"]) == 3  # only the three non-blank ages
    # and the explorer can show real rows
    assert prof["column_names"] == feature_names
    assert len(prof["sample_rows"]) == 5
    assert all(len(row) == len(feature_names) + 1 for row in prof["sample_rows"]), "target column must be included"
    assert prof["sample_truncated"] is False


def test_sample_is_capped():
    """A 5000-row dataset must not ship 5000 rows to the browser."""
    values = [str(i * 1.5) for i in range(500)]
    text = "x,t\n" + "\n".join(f"{i},{v}" for i, v in enumerate(values)) + "\n"
    X, y, fn, tn, _n, task = ns["load_csv_dataset"](_dataset(text, "t"), {})
    prof = ns["build_data_profile"](X, y, fn, tn, sample_rows=25)
    assert len(prof["sample_rows"]) == 25, len(prof["sample_rows"])
    assert prof["sample_truncated"] is True


def main() -> int:
    tests = [(n, f) for n, f in sorted(globals().items()) if n.startswith("test_") and callable(f)]
    failures = []
    for name, fn in tests:
        try:
            fn()
            print(f"  PASS  {name}")
        except Exception as exc:
            failures.append(name)
            print(f"  FAIL  {name}: {type(exc).__name__}: {exc}")
    print(f"\n{len(tests) - len(failures)}/{len(tests)} passed")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
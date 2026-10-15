"""
test_ensemble.py — verifies the ensemble/stacking factories build correctly.

These need scikit-learn, so this only runs where sklearn is installed. It
exists to catch the failure modes that matter for an ensemble: members that
aren't diverse, weights silently ignored, or a fold count that would train
nothing.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import basic_ml_engine as eng


def test_soft_vote_default():
    est, name, framework, version = eng.make_model("ml:ensemble", {}, "classification")
    assert est.voting == "soft", est.voting
    assert len(est.estimators) == 3
    kinds = [type(e).__name__ for _, e in est.estimators]
    # Diversity is the whole point — three of the same learner would cancel nothing.
    assert len(set(kinds)) == 3, kinds
    assert "Voting" in name


def test_hard_vote():
    est, _n, _f, _v = eng.make_model("ml:ensemble", {"kind": "hard"}, "classification")
    assert est.voting == "hard"


def test_weights_parsed_and_validated():
    est, _n, _f, _v = eng.make_model("ml:ensemble", {"weights": "2,1,1"}, "classification")
    assert est.weights == [2.0, 1.0, 1.0], est.weights
    # Wrong length must fall back to auto rather than blowing up at fit time.
    est2, _n2, _f2, _v2 = eng.make_model("ml:ensemble", {"weights": "3,1"}, "classification")
    assert est2.weights == "auto", est2.weights
    # Garbage must also fall back.
    est3, _n3, _f3, _v3 = eng.make_model("ml:ensemble", {"weights": "a,b,c"}, "classification")
    assert est3.weights == "auto", est3.weights


def test_stacking_builds_meta_learner():
    est, name, _f, _v = eng.make_model("ml:stacking", {"cv": 3}, "classification")
    assert est.cv == 3, est.cv
    assert est.final_estimator is not None, "stacking needs a meta-learner"
    assert len(est.estimators) >= 3
    assert "Stacking" in name


def test_stacking_cv_floor():
    """A cv below 2 cannot train a meta-model and would raise deep inside sklearn."""
    est, _n, _f, _v = eng.make_model("ml:stacking", {"cv": 1}, "classification")
    assert est.cv >= 2, est.cv


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
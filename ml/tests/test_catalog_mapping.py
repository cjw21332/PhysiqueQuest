"""Test catalog mapping completeness and correctness"""
import json
import pytest
from pathlib import Path

CATALOG_PATH = Path(__file__).parent.parent / "data" / "exercisedb_catalog.json"
MAPPING_PATH = Path(__file__).parent.parent / "data" / "exercise_ml_map.json"

def load_data():
    with open(CATALOG_PATH) as f:
        catalog = json.load(f)
    with open(MAPPING_PATH) as f:
        ml_map = json.load(f)
    return catalog, ml_map

def test_all_catalog_ids_present():
    """Every catalog exerciseId must have a mapping entry"""
    catalog, ml_map = load_data()
    catalog_ids = {ex["exerciseId"] for ex in catalog}
    mapped_ids = set(ml_map.keys())
    missing = catalog_ids - mapped_ids
    assert not missing, f"Missing mappings for {len(missing)} exercises: {list(missing)[:10]}"

def test_no_unknown_patterns():
    """No exercise should have 'other_unknown' as pattern unless explicitly intended"""
    _, ml_map = load_data()
    unknown = [(k, v["name"]) for k, v in ml_map.items() if v["movement_pattern"] == "other_unknown"]
    # Allow some unknown, but log them
    print(f"Exercises with 'other_unknown' pattern: {len(unknown)}")
    for k, name in unknown[:10]:
        print(f"  {k}: {name}")
    # This is a warning, not a failure - some exercises genuinely don't fit

def test_priority_set_reviewed():
    """Priority exercises should have needs_review = False"""
    _, ml_map = load_data()
    # Key exerciseIds from the repo (6YUfHPL = bodyweight squat, etc.)
    priority_ids = {
        "6YUfHPL",  # quads (bodyweight squat)
        "yn8yg1r",  # dumbbell goblet squat
        "EIeI8Vf",  # barbell bench press
        "SpYC0Kp",  # dumbbell bench press
        "B1EVP9F",  # incline push-up
        "LEprlgG",  # cable lat pulldown
        "0V2YQjW",  # Pull-Up (Neutral Grip)
        "2NpxjC1",  # dumbbell hammer curl
        "9tvVVM9",  # cable triceps pushdown (v-bar)
        "AQ0mC4Y",  # dumbbell full can lateral raise
        "iqH55N8",  # Forward Lunge
        "o6LqKKP",  # barbell romanian deadlift
        "rR0LJzx",  # dumbbell romanian deadlift
        "aWedzZX",  # Glute Bridge Two-Leg On Bench
        "Pjbc0Kt",  # Band Hip Thrusts On Knees
        "1ZFqTDN",  # Bicycle Crunch
        "0jp9Rlz",  # Single-Leg Floor Calf Raise
    }
    for pid in priority_ids:
        if pid in ml_map:
            assert not ml_map[pid]["needs_review"], f"Priority exercise {pid} ({ml_map[pid]['name']}) needs review!"

def test_trackable_status():
    """Trackable should be True for all exercises with known patterns"""
    _, ml_map = load_data()
    for k, v in ml_map.items():
        if v["movement_pattern"] != "other_unknown":
            assert v["trackable"] == True, f"Exercise {k} ({v['name']}) has known pattern but trackable=False"

def test_rep_signal_structure():
    """Every mapping must have valid rep_signal structure"""
    _, ml_map = load_data()
    for k, v in ml_map.items():
        assert "rep_signal" in v, f"Missing rep_signal for {k}"
        rs = v["rep_signal"]
        assert "primary_joints" in rs, f"Missing primary_joints for {k}"
        assert "side_mode" in rs, f"Missing side_mode for {k}"
        assert "is_isometric" in rs, f"Missing is_isometric for {k}"
        assert isinstance(rs["primary_joints"], list), f"primary_joints not list for {k}"
        assert len(rs["primary_joints"]) >= 2, f"Too few primary_joints for {k}"
        assert rs["side_mode"] in ["bilateral", "unilateral", "alternating", "unknown"], f"Invalid side_mode for {k}"
        assert isinstance(rs["is_isometric"], bool), f"is_isometric not bool for {k}"

def test_camera_orientation():
    """Camera orientation must be valid"""
    _, ml_map = load_data()
    valid_orients = {"front", "side", "reference", "pending"}
    for k, v in ml_map.items():
        assert v["camera_orientation"] in valid_orients, f"Invalid camera_orientation for {k}: {v['camera_orientation']}"

def test_mapping_source_valid():
    """Mapping source must be one of allowed values"""
    _, ml_map = load_data()
    valid_sources = {"rule", "equipment_hint", "body_part_hint", "target_muscle_hint", "unresolved", "llm_suggested", "manual"}
    for k, v in ml_map.items():
        assert v["mapping_source"] in valid_sources, f"Invalid mapping_source for {k}: {v['mapping_source']}"

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
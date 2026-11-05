from decimal import Decimal
from uuid import UUID, uuid4

from app.models.reward_ledger import RewardLedger


def _create_user_and_child(client, prefix: str):
    pw, un = "pass12345678", f"{prefix}_{uuid4().hex[:8]}"
    auth = client.post("/api/v1/auth/register", json={"username": un, "password": pw})
    assert auth.status_code == 201, auth.text
    token = auth.json()["token"]
    pheaders = {"Authorization": f"Bearer {token}"}

    child = client.post(
        "/api/v1/children",
        headers=pheaders,
        json={"name": f"Child_{prefix}", "grade_label": "三年级"},
    )
    assert child.status_code in (200, 201), child.text
    cid = child.json()["id"]

    code = client.post(
        f"/api/v1/children/{cid}/access-code",
        headers=pheaders,
    ).json()["code"]

    dev = client.post(
        "/api/v1/child-devices/bind",
        json={"code": code, "display_name": "Test iPad"},
    )
    assert dev.status_code in (200, 201), dev.text
    device_token = dev.json()["device_token"]

    return token, device_token, cid


def test_freeze_adjust_and_history(client, db_session):
    token, dtoken, cid = _create_user_and_child(client, "fadj1")
    pheaders = {"Authorization": f"Bearer {token}"}

    # 1. Initially query freeze
    res = client.get(f"/api/v1/shop/children/{cid}/freeze", headers=pheaders)
    assert res.status_code == 200
    data = res.json()
    assert data["available_count"] == 0
    assert data["max_limit"] == 2
    assert Decimal(str(data["star_cost"])) == Decimal("5.00")
    assert len(data["history"]) == 0

    # 2. Parent grants +1 card with reason
    res = client.patch(
        f"/api/v1/shop/children/{cid}/freeze/adjust",
        json={"delta": 1, "reason": "发烧生病特许免死金牌"},
        headers=pheaders,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["available_count"] == 1
    assert len(data["history"]) == 1
    assert data["history"][0]["event_type"] == "manual_grant"
    assert data["history"][0]["delta"] == 1
    assert data["history"][0]["balance_after"] == 1
    assert data["history"][0]["reason"] == "发烧生病特许免死金牌"
    assert data["history"][0]["operator"] == "parent"

    # 3. Parent grants another +1 via POST
    res = client.post(
        f"/api/v1/shop/children/{cid}/freeze/adjust",
        json={"delta": 1, "reason": "期中考试特别激励"},
        headers=pheaders,
    )
    assert res.status_code == 200
    assert res.json()["available_count"] == 2

    # 4. Parent deducts -1 card
    res = client.patch(
        f"/api/v1/shop/children/{cid}/freeze/adjust",
        json={"delta": -1, "reason": "纠偏回收"},
        headers=pheaders,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["available_count"] == 1
    assert data["history"][0]["event_type"] == "manual_deduct"
    assert data["history"][0]["delta"] == -1

    # 5. Deducting beyond balance should fail with 400
    res = client.patch(
        f"/api/v1/shop/children/{cid}/freeze/adjust",
        json={"delta": -5, "reason": "过量扣除"},
        headers=pheaders,
    )
    assert res.status_code == 400

    # 6. Delta == 0 should fail with 422
    res = client.patch(
        f"/api/v1/shop/children/{cid}/freeze/adjust",
        json={"delta": 0, "reason": "无效调整"},
        headers=pheaders,
    )
    assert res.status_code == 422


def test_freeze_settings_update_and_limits(client, db_session):
    token, dtoken, cid = _create_user_and_child(client, "fset1")
    pheaders = {"Authorization": f"Bearer {token}"}
    cheaders = {"Authorization": f"Bearer {dtoken}"}

    # 1. Update settings via PUT /settings
    res = client.put(
        f"/api/v1/shop/children/{cid}/freeze/settings",
        json={"star_cost": 8.0, "max_limit": 3, "monthly_grant": 2},
        headers=pheaders,
    )
    assert res.status_code == 200
    data = res.json()
    assert Decimal(str(data["star_cost"])) == Decimal("8.00")
    assert data["max_limit"] == 3
    assert data["monthly_grant"] == 2

    # 2. Child queries freeze - should reflect star_cost 8.00 and max_limit 3
    res = client.get("/api/v1/child/shop/freeze", headers=cheaders)
    assert res.status_code == 200
    cdata = res.json()
    assert Decimal(str(cdata["star_cost"])) == Decimal("8.00")
    assert cdata["max_limit"] == 3
    assert cdata["can_purchase"] is False
    assert cdata["can_purchase_reason"] == "insufficient_stars"

    # 3. Add 7 stars to child (less than 8) -> purchase should fail 409
    db_session.add(
        RewardLedger(
            child_id=UUID(cid),
            source_type="daily_task",
            source_id=uuid4(),
            stars_delta=Decimal("7.00"),
            reason="打卡奖励",
        )
    )
    db_session.commit()

    res = client.post("/api/v1/child/shop/freeze/purchase", headers=cheaders)
    assert res.status_code == 409

    # 4. Add 20 stars -> total 27 stars. Now purchase should succeed
    db_session.add(
        RewardLedger(
            child_id=UUID(cid),
            source_type="daily_task",
            source_id=uuid4(),
            stars_delta=Decimal("20.00"),
            reason="打卡奖励2",
        )
    )
    db_session.commit()

    # Buy card 1
    res = client.post("/api/v1/child/shop/freeze/purchase", headers=cheaders)
    assert res.status_code == 200
    assert res.json()["available_count"] == 1

    # Buy card 2
    res = client.post("/api/v1/child/shop/freeze/purchase", headers=cheaders)
    assert res.status_code == 200
    assert res.json()["available_count"] == 2

    # Buy card 3 (reaches max_limit = 3)
    res = client.post("/api/v1/child/shop/freeze/purchase", headers=cheaders)
    assert res.status_code == 200
    assert res.json()["available_count"] == 3

    # 5. Buy card 4 when limit reached -> 409 conflict
    res = client.post("/api/v1/child/shop/freeze/purchase", headers=cheaders)
    assert res.status_code == 409
    assert "limit" in res.text.lower()

    # Child query should indicate can_purchase is False due to max_limit_reached
    res = client.get("/api/v1/child/shop/freeze", headers=cheaders)
    assert res.status_code == 200
    assert res.json()["can_purchase"] is False
    assert res.json()["can_purchase_reason"] == "max_limit_reached"

    # 6. Invalid settings validation: star_cost <= 0 or max_limit < 1
    res = client.put(
        f"/api/v1/shop/children/{cid}/freeze/settings",
        json={"star_cost": 0.0},
        headers=pheaders,
    )
    assert res.status_code in (400, 422)

    res = client.put(
        f"/api/v1/shop/children/{cid}/freeze/settings",
        json={"max_limit": 0},
        headers=pheaders,
    )
    assert res.status_code in (400, 422)


def test_freeze_permissions_and_not_found(client, db_session):
    token1, _dtoken1, cid1 = _create_user_and_child(client, "perm1")
    token2, _dtoken2, cid2 = _create_user_and_child(client, "perm2")
    pheaders1 = {"Authorization": f"Bearer {token1}"}
    pheaders2 = {"Authorization": f"Bearer {token2}"}

    # Parent 2 trying to access Child 1 should 404 or 403
    res = client.get(f"/api/v1/shop/children/{cid1}/freeze", headers=pheaders2)
    assert res.status_code in (403, 404)

    res = client.patch(
        f"/api/v1/shop/children/{cid1}/freeze/adjust",
        json={"delta": 1},
        headers=pheaders2,
    )
    assert res.status_code in (403, 404)

    res = client.put(
        f"/api/v1/shop/children/{cid1}/freeze/settings",
        json={"star_cost": 6.0},
        headers=pheaders2,
    )
    assert res.status_code in (403, 404)

    # Non-existent child
    non_existent = uuid4()
    res = client.get(f"/api/v1/shop/children/{non_existent}/freeze", headers=pheaders1)
    assert res.status_code == 404

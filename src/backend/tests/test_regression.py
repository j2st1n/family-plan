from uuid import uuid4

from app.core.security import hash_access_code, hash_secret, verify_access_code


class TestAccessCodeSlowHash:
    """Verify access codes use bcrypt (slow hash), not sha256."""

    def test_hash_access_code_is_bcrypt_not_sha256(self):
        code = "123456"
        bcrypt_hash = hash_access_code(code)
        sha256_hash = hash_secret(code)

        # bcrypt output differs from sha256
        assert bcrypt_hash != sha256_hash

        # bcrypt format: $2b$... (or $2a$)
        assert bcrypt_hash.startswith("$2b$") or bcrypt_hash.startswith("$2a$")

        # sha256 is exactly 64 hex chars
        assert len(sha256_hash) == 64

    def test_verify_access_code_round_trip(self):
        code = "987654"
        h = hash_access_code(code)
        assert verify_access_code(code, h)
        assert not verify_access_code("000000", h)
        assert not verify_access_code("98765", h)

    def test_generated_code_binds_successfully(self, client):
        """API-level: generated access code can bind a child device."""
        pw, un = "pass12345", "ac" + uuid4().hex[:6]
        auth = client.post("/api/v1/auth/register", json={"username": un, "password": pw})
        assert auth.status_code == 201
        token = auth.json()["token"]

        child = client.post(
            "/api/v1/children",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "hash-child"},
        )
        assert child.status_code == 200
        cid = child.json()["id"]

        code_resp = client.post(
            f"/api/v1/children/{cid}/access-code",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert code_resp.status_code == 200
        plain_code = code_resp.json()["code"]
        assert len(plain_code) == 6

        bind = client.post("/api/v1/child-devices/bind", json={"code": plain_code, "display_name": "test-dev"})
        assert bind.status_code == 200
        assert "device_token" in bind.json()
        assert bind.json()["child"]["id"] == cid

    def test_wrong_code_rejected_on_bind(self, client):
        """Wrong access code fails bind, proving verification is active."""
        bind = client.post("/api/v1/child-devices/bind", json={"code": "000000", "display_name": "bad"})
        assert bind.status_code == 400


class TestDeleteChildWithRedemptions:
    """Delete a child that has earned stars, created redemptions, and owns shop items."""

    def test_delete_child_with_redemptions_and_shop_items(self, client):
        pw, un = "pass12345", "dc" + uuid4().hex[:6]
        # 1. Register parent
        auth = client.post("/api/v1/auth/register", json={"username": un, "password": pw})
        assert auth.status_code == 201
        token = auth.json()["token"]

        # 2. Create child
        child = client.post(
            "/api/v1/children",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "del-child"},
        )
        assert child.status_code == 200
        cid = child.json()["id"]

        # 3. Generate access code and bind device
        code = client.post(
            f"/api/v1/children/{cid}/access-code",
            headers={"Authorization": f"Bearer {token}"},
        ).json()["code"]
        dev = client.post("/api/v1/child-devices/bind", json={"code": code, "display_name": "dev"})
        dtoken = dev.json()["device_token"]

        # 4. Create a plan
        plan = client.post(
            "/api/v1/plans",
            headers={"Authorization": f"Bearer {token}"},
            json={"child_id": cid, "title": "plan1", "start_date": "2026-05-19"},
        )
        assert plan.status_code == 201
        pid = plan.json()["id"]

        # 5. Create parent-owned daily tasks (auto-approved, child can complete)
        from datetime import date
        tasks = client.post(
            f"/api/v1/plans/{pid}/daily-tasks",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "task_date": str(date.today()),
                "tasks": [
                    {"title": "Read book", "reward_stars": 5, "expected_minutes": 30},
                ],
            },
        )
        assert tasks.status_code == 201
        tid = tasks.json()[0]["id"]

        # 6. Child completes task → earns stars
        complete = client.patch(
            f"/api/v1/child/tasks/{tid}/complete",
            headers={"Authorization": f"Bearer {dtoken}"},
            json={"feedback": "good"},
        )
        assert complete.status_code == 200

        # 7. Parent creates a shop item
        shop = client.post(
            "/api/v1/shop/items",
            headers={"Authorization": f"Bearer {token}"},
            json={"title": "Candy", "star_cost": 3, "stock": 1},
        )
        assert shop.status_code == 200
        sid = shop.json()["id"]

        # 8. Child redeems shop item → creates Redemption record
        redeem = client.post(
            f"/api/v1/child/shop/items/{sid}/redeem",
            headers={"Authorization": f"Bearer {dtoken}"},
        )
        assert redeem.status_code == 200

        # 9. Child also creates a wish (child-owned shop item)
        wish = client.post(
            "/api/v1/child/shop/wishes",
            headers={"Authorization": f"Bearer {dtoken}"},
            json={"title": "Toy", "description": "lego set"},
        )
        assert wish.status_code == 200

        # 10. Delete the child
        delete = client.delete(
            f"/api/v1/children/{cid}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert delete.status_code == 204

        # 11. Verify child is gone
        get_child = client.get(
            f"/api/v1/children/{cid}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert get_child.status_code == 404


class TestStreakThreshold:
    """Streak increments only when completion rate meets the threshold, at most once per day."""

    @staticmethod
    def _setup_child_with_tasks(client, threshold, task_count):
        """Create a parent, child, plan, and parent-owned daily tasks. Returns (token, dtoken, cid, task_ids)."""
        pw, un = "pass12345", "st" + uuid4().hex[:6]
        auth = client.post("/api/v1/auth/register", json={"username": un, "password": pw})
        assert auth.status_code == 201
        token = auth.json()["token"]

        # Create child with custom streak threshold
        child = client.post(
            "/api/v1/children",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "streak-child", "streak_threshold": threshold},
        )
        assert child.status_code == 200, child.text
        cid = child.json()["id"]
        assert child.json()["streak_threshold"] == threshold

        # Bind device
        code = client.post(
            f"/api/v1/children/{cid}/access-code",
            headers={"Authorization": f"Bearer {token}"},
        ).json()["code"]
        dev = client.post("/api/v1/child-devices/bind", json={"code": code, "display_name": "dev"})
        dtoken = dev.json()["device_token"]

        # Create plan
        plan = client.post(
            "/api/v1/plans",
            headers={"Authorization": f"Bearer {token}"},
            json={"child_id": cid, "title": "plan1", "start_date": "2026-05-19"},
        )
        assert plan.status_code == 201
        pid = plan.json()["id"]

        # Create parent-owned tasks (auto-approved)
        from datetime import date
        task_payloads = [
            {"title": f"Task {i}", "reward_stars": 1, "expected_minutes": 10}
            for i in range(1, task_count + 1)
        ]
        created = client.post(
            f"/api/v1/plans/{pid}/daily-tasks",
            headers={"Authorization": f"Bearer {token}"},
            json={"task_date": str(date.today()), "tasks": task_payloads},
        )
        assert created.status_code == 201
        task_ids = [t["id"] for t in created.json()]

        return token, dtoken, cid, task_ids

    def _streak_days(self, client, dtoken):
        """Return current_streak_days from the child's today endpoint."""
        today = client.get("/api/v1/child/today", headers={"Authorization": f"Bearer {dtoken}"})
        assert today.status_code == 200
        return today.json()["rewards"]["current_streak_days"]

    def test_streak_increments_only_when_threshold_reached_once_per_day(self, client):
        """threshold=80, 5 tasks. Complete 4 = 80% → streak hits 1. Complete 5th → still 1."""
        threshold = 80
        task_count = 5
        _token, dtoken, _cid, task_ids = self._setup_child_with_tasks(client, threshold, task_count)

        # Initial streak is 0
        assert self._streak_days(client, dtoken) == 0

        # Complete 3/5 = 60%, below 80% threshold → streak stays 0
        for tid in task_ids[:3]:
            r = client.patch(
                f"/api/v1/child/tasks/{tid}/complete",
                headers={"Authorization": f"Bearer {dtoken}"},
                json={"feedback": "ok"},
            )
            assert r.status_code == 200, r.text
        assert self._streak_days(client, dtoken) == 0

        # Complete 4th → 4/5 = 80% → threshold reached → streak becomes 1
        r = client.patch(
            f"/api/v1/child/tasks/{task_ids[3]}/complete",
            headers={"Authorization": f"Bearer {dtoken}"},
            json={"feedback": "ok"},
        )
        assert r.status_code == 200
        assert self._streak_days(client, dtoken) == 1

        # Complete 5th → 5/5 = 100% but streak already updated today → stays 1
        r = client.patch(
            f"/api/v1/child/tasks/{task_ids[4]}/complete",
            headers={"Authorization": f"Bearer {dtoken}"},
            json={"feedback": "ok"},
        )
        assert r.status_code == 200
        assert self._streak_days(client, dtoken) == 1

from datetime import date
from uuid import UUID, uuid4
import pytest
from sqlalchemy import select,func
from app.models.daily_task import DailyTask
from app.models.reward_ledger import RewardLedger
from test_daily_task_management import family, create_task


def test_child_reward_is_unassigned_and_only_parent_sets_it(client,family,db_session):
    parent,kid,cid,plans=family
    r=client.post('/api/v1/child/tasks',headers=kid,json={'title':'proposed','expected_minutes':20,'reward_stars':99})
    assert r.status_code==201,r.text
    task=r.json();tid=task['id']
    assert task['reward_stars'] is None and not task['approved']
    r=client.patch(f'/api/v1/child/tasks/{tid}',headers=kid,json={'title':'updated','expected_minutes':25,'reward_stars':88})
    assert r.status_code==200 and r.json()['reward_stars'] is None
    url=f'/api/v1/plans/{plans[1]}/daily-tasks/{tid}'
    # Child proposals belong to the latest active plan.
    url=f"/api/v1/plans/{task['plan_id']}/daily-tasks/{tid}"
    assert client.patch(url,headers=parent,json={'title':'approved'}).status_code==422
    r=client.patch(url,headers=parent,json={'title':'approved','reward_stars':10,'approved':True})
    assert r.status_code==200,r.text
    assert r.json()['reward_stars']==10 and r.json()['approved']
    assert client.patch(f'/api/v1/child/tasks/{tid}',headers=kid,json={'title':'changed','expected_minutes':25,'reward_stars':99}).status_code==409
    r=client.patch(f'/api/v1/child/tasks/{tid}/complete',headers=kid,json={})
    assert r.status_code==200 and r.json()['stars_awarded']==10


@pytest.mark.parametrize('stars',[0,-1,100,1.5])
def test_parent_rewards_reject_invalid_values(client,family,stars):
    parent,kid,cid,plans=family
    r=client.post(f'/api/v1/plans/{plans[0]}/daily-tasks',headers=parent,json={'task_date':str(date.today()),'tasks':[{'title':'invalid','reward_stars':stars}]})
    assert r.status_code==422


def test_timing_is_optional_and_completion_retry_does_not_reward_twice(client,family,db_session):
    parent,kid,cid,plans=family
    task=create_task(client,parent,plans[0],reward_stars=8)
    tid=task['id'];op=str(uuid4());body={'actual_seconds':1042,'operation_id':op,'expected_version':0}
    url=f'/api/v1/child/tasks/{tid}/complete'
    for _ in range(2):
        r=client.patch(url,headers=kid,json=body);assert r.status_code==200,r.text
    assert client.patch(url,headers=kid,json={**body,"actual_seconds":9999}).status_code==200
    saved=db_session.get(DailyTask,UUID(tid));db_session.refresh(saved)
    assert saved.actual_seconds==1042
    assert db_session.scalar(select(func.count()).select_from(RewardLedger).where(RewardLedger.source_id==UUID(tid)))==1
    assert client.post(f'/api/v1/plans/tasks/{tid}/revoke',headers=parent).status_code==200
    assert client.patch(url,headers=kid,json=body).status_code==409
    r=client.patch(url,headers=kid,json={'operation_id':str(uuid4()),'expected_version':1})
    assert r.status_code==200,r.text
    db_session.refresh(saved);assert saved.actual_seconds is None
    assert db_session.scalar(select(func.count()).select_from(RewardLedger).where(RewardLedger.source_id==UUID(tid)))==1


def test_submitted_duration_stops_before_parent_approval(client,family,db_session):
    parent,kid,cid,plans=family
    task=create_task(client,parent,plans[0],require_approval=True)
    tid=task['id'];body={'actual_seconds':321,'operation_id':str(uuid4()),'expected_version':0}
    r=client.patch(f'/api/v1/child/tasks/{tid}/complete',headers=kid,json=body)
    assert r.status_code==200 and r.json()['status']=='submitted'
    r=client.post(f'/api/v1/plans/tasks/{tid}/approve',headers=parent)
    assert r.status_code==200 and r.json()['actual_seconds']==321
    r=client.patch(f'/api/v1/child/tasks/{tid}/complete',headers=kid,json=body)
    assert r.status_code==200
    assert db_session.scalar(select(func.count()).select_from(RewardLedger).where(RewardLedger.source_id==UUID(tid)))==1


@pytest.mark.parametrize('seconds',[-1,86401,True,1.5])
def test_invalid_timing_cannot_change_task(client,family,seconds):
    parent,kid,cid,plans=family
    task=create_task(client,parent,plans[0])
    r=client.patch(f"/api/v1/child/tasks/{task['id']}/complete",headers=kid,json={'actual_seconds':seconds,'operation_id':str(uuid4()),'expected_version':0})
    assert r.status_code==422


def test_rejected_timing_requires_fresh_completion_version(client,family):
    parent,kid,cid,plans=family
    task=create_task(client,parent,plans[0],require_approval=True)
    url=f"/api/v1/child/tasks/{task['id']}/complete"
    body={'actual_seconds':30,'operation_id':str(uuid4()),'expected_version':0}
    assert client.patch(url,headers=kid,json=body).status_code==200
    r=client.post(f"/api/v1/plans/tasks/{task['id']}/reject",headers=parent)
    assert r.status_code==200 and r.json()['actual_seconds'] is None
    assert client.patch(url,headers=kid,json=body).status_code==409
    body.update(operation_id=str(uuid4()),expected_version=1,actual_seconds=50)
    assert client.patch(url,headers=kid,json=body).status_code==200


@pytest.mark.parametrize('reward,expected',[(0,422),(99,201)])
def test_template_rewards_use_the_same_parent_range(client,family,reward,expected):
    parent,kid,cid,plans=family
    r=client.post('/api/v1/plans',headers=parent,json={'child_id':cid,'title':'Reward range','start_date':str(date.today()),'tasks':[{'title':'Template','reward_stars':reward}]})
    assert r.status_code==expected,r.text


def test_legacy_zero_reward_is_preserved_but_requires_parent_assignment(client,family,db_session):
    parent,kid,cid,plans=family
    task=create_task(client,parent,plans[0])
    saved=db_session.get(DailyTask,UUID(task['id']));saved.reward_stars=0;db_session.commit()
    r=client.get('/api/v1/child/today',headers=kid)
    assert next(t for t in r.json()['tasks'] if t['id']==task['id'])['reward_stars'] is None
    assert client.patch(f"/api/v1/child/tasks/{task['id']}/complete",headers=kid,json={}).status_code==422
    db_session.refresh(saved);assert saved.reward_stars==0 and saved.status=='pending'

use super::*;
use activities::{
    ActivityEvent, ActivityKind, Animal, BeginActivity, CrossingMethod, FinishActivity,
    RecordActivity,
};
use pioneer_sim::{CrossMethod, Outcome, RunStatus};

fn engine(seed: u64, trail: &str, era: &str) -> TrailEngine {
    let mut game = GameState::with_content(seed, pioneer_data::load().unwrap());
    assert_ok(&game.apply(Command::Configure {
        trail_id: trail.into(),
        era_id: era.into(),
        occupation_id: "banker".into(),
        party: vec![
            "Ada".into(),
            "James".into(),
            "Ruth".into(),
            "Thomas".into(),
            "Clara".into(),
        ],
        departure_month: 3,
    }));
    for (item, quantity) in [
        ("oxen", 3),
        ("food", 1500),
        ("clothing", 5),
        ("medicine", 3),
        ("wheel", 1),
        ("axle", 1),
        ("tongue", 1),
        ("ammunition", 10),
    ] {
        assert_ok(&game.apply(Command::Buy {
            item_id: item.into(),
            quantity,
        }));
    }
    assert_ok(&game.apply(Command::Depart));
    TrailEngine {
        game,
        world: None,
        activity: None,
        next_activity_id: 1,
        last_commit: None,
    }
}

fn assert_ok(outcomes: &[Outcome]) {
    assert!(
        !outcomes
            .iter()
            .any(|outcome| matches!(outcome, Outcome::Rejected(_))),
        "{outcomes:?}"
    );
}
fn begin(engine: &mut TrailEngine, kind: ActivityKind, method: Option<CrossingMethod>) -> String {
    engine.begin_inner(BeginActivity { kind, method }).unwrap();
    engine.activity.as_ref().unwrap().id.clone()
}
fn record(engine: &mut TrailEngine, event: ActivityEvent) -> Result<(), String> {
    let activity = engine.activity.as_ref().unwrap();
    engine.record_inner(RecordActivity {
        id: activity.id.clone(),
        sequence: activity.sequence + 1,
        event,
    })
}
fn shot(id: Option<&str>, animal: Option<Animal>) -> ActivityEvent {
    ActivityEvent::Shot {
        target_id: id.map(String::from),
        animal,
    }
}
fn finish(engine: &mut TrailEngine, id: &str, completed: bool) {
    assert_ok(
        &engine
            .finish_inner(FinishActivity {
                id: id.into(),
                completed,
            })
            .unwrap(),
    );
}
fn at_node(engine: &mut TrailEngine, id: &str) {
    let node = engine
        .game
        .content
        .trails
        .iter()
        .find(|trail| trail.id == "oregon")
        .unwrap()
        .nodes
        .iter()
        .find(|node| node.id == id)
        .unwrap();
    engine.game.miles = node.mile;
    engine.game.current_node_id = Some(id.into());
    engine.game.target_node_id = None;
    engine.game.route_miles_remaining = 0;
    engine.game.pending_event = None;
    engine.game.visited_landmarks.clear();
    engine.game.status = if id == "the_dalles" {
        RunStatus::AwaitingFork(id.into())
    } else {
        RunStatus::AwaitingRiver(id.into())
    };
}

#[test]
fn actual_hunt_hits_misses_and_exact_ammunition_match_original_rules() {
    let mut engine = engine(u64::MAX, "oregon", "1848");
    let id = begin(&mut engine, ActivityKind::Hunt, None);
    let mut expected = engine.game.clone();
    record(&mut engine, shot(Some("deer-1"), Some(Animal::Deer))).unwrap();
    record(
        &mut engine,
        ActivityEvent::Collect {
            target_id: "deer-1".into(),
        },
    )
    .unwrap();
    record(&mut engine, shot(None, None)).unwrap();
    record(&mut engine, shot(Some("rabbit-1"), Some(Animal::Rabbit))).unwrap();
    record(
        &mut engine,
        ActivityEvent::Collect {
            target_id: "rabbit-1".into(),
        },
    )
    .unwrap();
    assert_eq!(engine.view_value()["ammunition_available"], 197);
    assert_eq!(engine.game.day, 0);
    expected.apply(Command::HuntResult {
        food_lbs: 63,
        shots: 3,
    });
    finish(&mut engine, &id, true);
    assert_eq!(
        serde_json::to_string(&engine.game).unwrap(),
        serde_json::to_string(&expected).unwrap()
    );
    assert_eq!(engine.game.day, 1);
    assert_eq!(engine.game.inventory.get("ammunition"), 9);
    assert_eq!(engine.game.loose_bullets, 17);
    let committed = engine.save();
    finish(&mut engine, &id, true);
    assert_eq!(engine.save(), committed);
}

#[test]
fn invalid_duplicate_and_overspent_hunt_events_are_atomic() {
    let mut engine = engine(1, "oregon", "1848");
    let id = begin(&mut engine, ActivityKind::Hunt, None);
    record(&mut engine, shot(Some("deer-1"), Some(Animal::Deer))).unwrap();
    let before = engine.save();
    assert!(engine
        .record_inner(RecordActivity {
            id: id.clone(),
            sequence: 1,
            event: shot(None, None)
        })
        .is_err());
    assert!(record(&mut engine, shot(Some("deer-1"), Some(Animal::Deer))).is_err());
    assert!(record(&mut engine, shot(None, Some(Animal::Deer))).is_err());
    assert!(record(
        &mut engine,
        ActivityEvent::Catch {
            fish_id: "fish".into(),
            food_lbs: 100
        }
    )
    .is_err());
    assert_eq!(before, engine.save());
    for _ in 1..20 {
        record(&mut engine, shot(None, None)).unwrap();
    }
    let before = engine.save();
    assert!(record(&mut engine, shot(None, None)).is_err());
    assert_eq!(before, engine.save());
    finish(&mut engine, &id, false);
    assert_eq!(engine.game.inventory.get("ammunition"), 9);
    assert_eq!(engine.game.loose_bullets, 0);
    assert_eq!(engine.game.day, 1);
}

#[test]
fn interrupted_activity_keeps_seed_events_cost_and_future_parity() {
    let mut original = engine(u64::MAX, "oregon", "1848");
    let id = begin(&mut original, ActivityKind::Hunt, None);
    record(
        &mut original,
        shot(Some("buffalo-1"), Some(Animal::Buffalo)),
    )
    .unwrap();
    let raw = original.save();
    assert!(raw.contains("18446744073709551615"));
    let mut resumed = engine(3, "oregon", "1848");
    resumed.load_inner(&raw).unwrap();
    assert_eq!(resumed.save(), raw);
    for game in [&mut original, &mut resumed] {
        assert_eq!(game.activity.as_ref().unwrap().food_lbs, 0);
        assert_eq!(
            game.activity
                .as_ref()
                .unwrap()
                .pending_kills
                .get("buffalo-1"),
            Some(&Animal::Buffalo)
        );
        record(
            game,
            ActivityEvent::Collect {
                target_id: "buffalo-1".into(),
            },
        )
        .unwrap();
        record(game, shot(Some("buffalo-2"), Some(Animal::Buffalo))).unwrap();
        record(
            game,
            ActivityEvent::Collect {
                target_id: "buffalo-2".into(),
            },
        )
        .unwrap();
        assert_eq!(game.activity.as_ref().unwrap().food_lbs, 150);
        finish(game, &id, true);
        game.game.apply(Command::TravelDay);
    }
    assert_eq!(original.save(), resumed.save());
    resumed.load_inner(&original.save()).unwrap();
    let committed = resumed.save();
    finish(&mut resumed, &id, true);
    assert_eq!(resumed.save(), committed);
}

#[test]
fn hunt_requires_collection_and_carcasses_cannot_be_collected_twice() {
    for collect in [false, true] {
        let mut engine = engine(23, "oregon", "1848");
        let id = begin(&mut engine, ActivityKind::Hunt, None);
        record(&mut engine, shot(Some("deer"), Some(Animal::Deer))).unwrap();
        assert_eq!(engine.activity.as_ref().unwrap().food_lbs, 0);
        if collect {
            record(
                &mut engine,
                ActivityEvent::Collect {
                    target_id: "deer".into(),
                },
            )
            .unwrap();
            let before = engine.save();
            assert!(record(
                &mut engine,
                ActivityEvent::Collect {
                    target_id: "deer".into()
                }
            )
            .is_err());
            assert_eq!(engine.save(), before);
        }
        let mut expected = engine.game.clone();
        expected.apply(Command::HuntResult {
            food_lbs: if collect { 55 } else { 0 },
            shots: 1,
        });
        finish(&mut engine, &id, true);
        assert_eq!(
            serde_json::to_string(&engine.game).unwrap(),
            serde_json::to_string(&expected).unwrap()
        );
    }
}

#[test]
fn fishing_success_and_failure_are_factual_bounded_and_charge_one_day() {
    for catch in [0, 43] {
        let mut engine = engine(17, "oregon", "1848");
        at_node(&mut engine, "kansas_river");
        let id = begin(&mut engine, ActivityKind::Fish, None);
        let mut expected = engine.game.clone();
        if catch > 0 {
            record(
                &mut engine,
                ActivityEvent::Catch {
                    fish_id: "catch-1".into(),
                    food_lbs: catch,
                },
            )
            .unwrap();
        }
        let before = engine.save();
        assert!(record(
            &mut engine,
            ActivityEvent::Catch {
                fish_id: "over-limit".into(),
                food_lbs: 46
            }
        )
        .is_err());
        assert_eq!(engine.save(), before);
        expected.apply(Command::FishResult { food_lbs: catch });
        finish(&mut engine, &id, true);
        assert_eq!(engine.game.day, 1);
        assert_eq!(
            serde_json::to_string(&engine.game).unwrap(),
            serde_json::to_string(&expected).unwrap()
        );
        let committed = engine.save();
        finish(&mut engine, &id, true);
        assert_eq!(engine.save(), committed);
    }
}

#[test]
fn crossing_collisions_guide_costs_and_aborts_do_not_reroll() {
    for (method, completed) in [
        (CrossingMethod::Ford, true),
        (CrossingMethod::Caulk, false),
        (CrossingMethod::Guide, true),
    ] {
        let mut engine = engine(29, "oregon", "1843");
        at_node(&mut engine, "snake_river");
        let id = begin(&mut engine, ActivityKind::Crossing, Some(method));
        let before = engine.save();
        assert!(engine
            .begin_inner(BeginActivity {
                kind: ActivityKind::Fish,
                method: None
            })
            .is_err());
        assert_eq!(before, engine.save());
        record(
            &mut engine,
            ActivityEvent::Collision {
                obstacle_id: "rock-1".into(),
            },
        )
        .unwrap();
        let loss = engine.activity.as_ref().unwrap().collision_loss_lbs;
        let mut expected = engine.game.clone();
        let river_method = match method {
            CrossingMethod::Ford => CrossMethod::Ford,
            CrossingMethod::Caulk => CrossMethod::Caulk,
            _ => CrossMethod::Guide,
        };
        expected.apply(Command::CrossingResult {
            method: river_method,
            cargo_lost_lbs: loss,
            completed,
        });
        let before = engine.save();
        assert!(record(
            &mut engine,
            ActivityEvent::Collision {
                obstacle_id: "rock-1".into()
            }
        )
        .is_err());
        assert_eq!(before, engine.save());
        let mut resumed = self::engine(2, "oregon", "1848");
        resumed.load_inner(&engine.save()).unwrap();
        finish(&mut resumed, &id, completed);
        assert_eq!(
            serde_json::to_string(&resumed.game).unwrap(),
            serde_json::to_string(&expected).unwrap()
        );
        assert_eq!(resumed.game.day, 1);
        assert_eq!(
            resumed.game.inventory.get("clothing"),
            if method == CrossingMethod::Guide {
                1
            } else {
                5
            }
        );
    }
}

#[test]
fn unavailable_activity_and_corrupt_save_leave_current_game_untouched() {
    let mut engine = engine(19, "oregon", "1848");
    let before = engine.save();
    assert!(engine
        .begin_inner(BeginActivity {
            kind: ActivityKind::Crossing,
            method: Some(CrossingMethod::Ford)
        })
        .is_err());
    assert_eq!(engine.save(), before);
    assert!(engine.load_inner("{bad").is_err());
    assert!(engine
        .load_inner(&before.replace("\"version\":2", "\"version\":99"))
        .is_err());
    let mut corrupt: Value = serde_json::from_str(&before).unwrap();
    corrupt["game"]["inventory"]["quantities"]["food"] = json!(u32::MAX);
    assert!(engine.load_inner(&corrupt.to_string()).is_err());
    assert_eq!(engine.save(), before);
    begin(&mut engine, ActivityKind::Hunt, None);
    let before = engine.save();
    let mut corrupt: Value = serde_json::from_str(&before).unwrap();
    corrupt["activity"]["shots"] = json!(21);
    assert!(engine.load_inner(&corrupt.to_string()).is_err());
    assert_eq!(engine.save(), before);
}

#[test]
fn legacy_max_u64_migrates_without_changing_campaign_bytes() {
    let mut engine = engine(u64::MAX, "california", "1866");
    let raw = serde_json::to_string(&engine.game).unwrap();
    engine.load_inner(&raw).unwrap();
    assert_eq!(serde_json::to_string(&engine.game).unwrap(), raw);
    assert_eq!(engine.next_activity_id, 1);
    assert!(engine.activity.is_none());
}

#[test]
fn columbia_raft_keeps_observed_collisions_and_reaches_original_finale() {
    let mut engine = engine(31, "oregon", "1843");
    at_node(&mut engine, "the_dalles");
    let id = begin(
        &mut engine,
        ActivityKind::Crossing,
        Some(CrossingMethod::Raft),
    );
    record(
        &mut engine,
        ActivityEvent::Collision {
            obstacle_id: "rapid-rock".into(),
        },
    )
    .unwrap();
    finish(&mut engine, &id, true);
    assert_eq!(engine.game.status, RunStatus::Arrived);
    assert_eq!(engine.game.current_node_id.as_deref(), Some("willamette"));
    assert_eq!(engine.game.day, 1);
}

#[test]
fn all_eleven_legal_route_era_pairs_reach_their_content_endings() {
    let mut index = 0;
    for trail in ["oregon", "california", "mormon"] {
        for era in ["1843", "1848", "1852", "1866"] {
            if trail == "mormon" && era == "1843" {
                continue;
            }
            let mut engine = engine(11 + index * 18, trail, era);
            index += 1;
            for _ in 0..1000 {
                if matches!(engine.game.status, RunStatus::Arrived | RunStatus::Failed) {
                    break;
                }
                if let Some(event_id) = engine.game.pending_event.clone() {
                    let event = engine
                        .game
                        .content
                        .events
                        .iter()
                        .find(|event| event.id == event_id)
                        .unwrap();
                    let choice_id = event
                        .choices
                        .iter()
                        .find(|choice| engine.game.choice_available(choice))
                        .unwrap()
                        .id
                        .clone();
                    assert_ok(&engine.game.apply(Command::Respond {
                        event_id,
                        choice_id,
                    }));
                } else if matches!(engine.game.status, RunStatus::AwaitingRiver(_)) {
                    let id = begin(
                        &mut engine,
                        ActivityKind::Crossing,
                        Some(CrossingMethod::Caulk),
                    );
                    finish(&mut engine, &id, true);
                } else if matches!(engine.game.status, RunStatus::AwaitingFork(_)) {
                    if engine.game.current_node_id.as_deref() == Some("the_dalles") && era == "1843"
                    {
                        let id = begin(
                            &mut engine,
                            ActivityKind::Crossing,
                            Some(CrossingMethod::Raft),
                        );
                        finish(&mut engine, &id, true);
                    } else {
                        let route = engine.game.current_landmark().unwrap().routes[0].id.clone();
                        assert_ok(&engine.game.apply(Command::ChooseRoute { route_id: route }));
                    }
                } else if engine.game.inventory.get("food") < 120 {
                    assert_ok(&engine.game.apply(Command::Forage));
                } else {
                    assert_ok(&engine.game.apply(Command::TravelDay));
                }
            }
            assert_eq!(engine.game.status, RunStatus::Arrived, "{trail}/{era}");
            let expected_goal = engine
                .game
                .content
                .trails
                .iter()
                .find(|candidate| candidate.id == trail)
                .unwrap()
                .goal_node_id
                .as_str();
            assert_eq!(engine.game.current_node_id.as_deref(), Some(expected_goal));
            let mut resumed = self::engine(2, "oregon", "1848");
            resumed.load_inner(&engine.save()).unwrap();
            assert_eq!(engine.save(), resumed.save());
        }
    }
    assert_eq!(index, 11);
}

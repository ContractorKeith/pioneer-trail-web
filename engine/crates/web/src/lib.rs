#![recursion_limit = "256"]
//! Browser bridge. State and seeded RNG remain in Rust; JS receives a safe view only.
use pioneer_sim::{Command, GameState};
use serde_json::{json, Value};
use wasm_bindgen::prelude::*;
mod minigames;

#[wasm_bindgen]
pub struct TrailEngine {
    game: GameState,
    world: Option<minigames::MinigameWorld>,
}

fn error(message: impl std::fmt::Display) -> JsValue {
    JsValue::from_str(&message.to_string())
}

#[wasm_bindgen]
impl TrailEngine {
    #[wasm_bindgen(constructor)]
    pub fn new(seed: String) -> Result<TrailEngine, JsValue> {
        let seed = seed.parse::<u64>().map_err(error)?;
        let content = pioneer_data::load().map_err(error)?;
        Ok(Self {
            game: GameState::with_content(seed, content),
            world: None,
        })
    }

    /// Applies the exact externally-tagged serde Command JSON used by the original sim.
    pub fn apply(&mut self, command_json: &str) -> Result<String, JsValue> {
        let command: Command = serde_json::from_str(command_json).map_err(error)?;
        let outcomes = self.game.apply(command);
        self.world = minigames::MinigameWorld::from_game(&self.game);
        Ok(json!({"outcomes": outcomes, "view": self.view_value()}).to_string())
    }

    pub fn view(&self) -> String {
        self.view_value().to_string()
    }

    /// Opaque JSON: callers must store and restore this string unchanged. It embeds content and RNG.
    pub fn save(&self) -> String {
        serde_json::to_string(&self.game).expect("GameState serializes")
    }

    pub fn load(&mut self, save: &str) -> Result<String, JsValue> {
        let game: GameState = serde_json::from_str(save).map_err(error)?;
        game.validate().map_err(error)?;
        pioneer_data::validate(&game.content).map_err(error)?;
        self.game = game;
        self.world = minigames::MinigameWorld::from_game(&self.game);
        Ok(self.view())
    }

    pub fn minigame_snapshot(&mut self) -> Result<String, JsValue> {
        if self.world.is_none() {
            self.world = minigames::MinigameWorld::from_game(&self.game);
        }
        serde_json::to_string(
            &self
                .world
                .as_ref()
                .ok_or_else(|| error("no active minigame"))?
                .snapshot(),
        )
        .map_err(error)
    }

    pub fn minigame_action(&mut self, action_json: &str) -> Result<String, JsValue> {
        if self.world.is_none() {
            self.world = minigames::MinigameWorld::from_game(&self.game);
        }
        let action = serde_json::from_str(action_json).map_err(error)?;
        let world = self
            .world
            .as_mut()
            .ok_or_else(|| error("no active minigame"))?;
        world.action(action);
        serde_json::to_string(&world.snapshot()).map_err(error)
    }

    pub fn minigame_tick(&mut self, frames: u16) -> Result<String, JsValue> {
        if self.world.is_none() {
            self.world = minigames::MinigameWorld::from_game(&self.game);
        }
        let world = self
            .world
            .as_mut()
            .ok_or_else(|| error("no active minigame"))?;
        world.tick(frames);
        serde_json::to_string(&world.snapshot()).map_err(error)
    }

    pub fn finish_minigame(&mut self) -> Result<String, JsValue> {
        let snapshot = self.minigame_action("{\"kind\":\"finish\"}")?;
        let command = self
            .world
            .as_ref()
            .and_then(minigames::MinigameWorld::result_command)
            .ok_or_else(|| error("minigame has not finished"))?;
        let _ = snapshot;
        self.apply(&serde_json::to_string(&command).map_err(error)?)
    }

    fn view_value(&self) -> Value {
        let (year, month, day_of_month) = self.game.date();
        let node = self.game.current_landmark();
        let items = self.game.content.items.iter().map(|item| json!({
            "id": item.id, "name": item.name, "unit": item.unit, "quantity": self.game.inventory.get(&item.id),
            "price_cents": self.game.price_cents(&item.id), "sell_price_cents": self.game.sell_price_cents(&item.id),
            "weight_lbs": item.weight_lbs, "limit": item.limit,
        })).collect::<Vec<_>>();
        let speakers = self
            .game
            .available_speakers()
            .into_iter()
            .map(|speaker| {
                json!({
                    "id": speaker.id, "name": speaker.name, "setting": speaker.setting,
                    "topics": ["Route", "Supplies", "News"],
                })
            })
            .collect::<Vec<_>>();
        let routes = node.map(|node| node.routes.iter().map(|route| {
            let available = if matches!(self.game.status, pioneer_sim::RunStatus::AwaitingFork(_)) {
                let mut preview = self.game.clone();
                !preview.apply(Command::ChooseRoute { route_id: route.id.clone() }).iter().any(|outcome| matches!(outcome, pioneer_sim::Outcome::Rejected(_)))
            } else { true };
            json!({"id": route.id, "label": route.label, "target_id": route.target_id, "distance_miles": route.distance_miles, "available": available})
        }).collect::<Vec<_>>()).unwrap_or_default();
        let river = node.and_then(|node| node.river.as_ref()).map(|river| json!({
            "width_feet": river.width_feet, "depth_feet": self.game.effective_depth(), "ferry_cost_cents": self.game.ferry_cost(),
            "guide_cost_clothing": self.game.guide_cost(),
            "risks": {"Ford": self.game.crossing_risk(pioneer_sim::CrossMethod::Ford), "Caulk": self.game.crossing_risk(pioneer_sim::CrossMethod::Caulk), "Guide": self.game.crossing_risk(pioneer_sim::CrossMethod::Guide)}
        }));
        let pending_event = self.game.pending_event.as_deref().and_then(|id| self.game.content.events.iter().find(|event| event.id == id)).map(|event| json!({
            "id": event.id, "text": event.text,
            "choices": event.choices.iter().map(|choice| json!({"id": choice.id, "label": choice.label, "available": self.game.choice_available(choice)})).collect::<Vec<_>>()
        }));
        let journal = self.game.journal.entries.iter().map(|entry| json!({
            "day": entry.day, "miles": entry.miles, "kind": entry.kind, "text": entry.kind.text()
        })).collect::<Vec<_>>();
        let can_camp = self.game.pending_event.is_none()
            && self.game.active_minigame.is_none()
            && matches!(
                self.game.status,
                pioneer_sim::RunStatus::Travelling
                    | pioneer_sim::RunStatus::AtLandmark(_)
                    | pioneer_sim::RunStatus::AwaitingRiver(_)
                    | pioneer_sim::RunStatus::AwaitingFork(_)
            );
        let can_hunt = can_camp
            && self.game.pending_event.is_none()
            && self.game.active_minigame.is_none()
            && (self.game.inventory.get("ammunition") > 0 || self.game.loose_bullets > 0);
        let can_fish = can_camp && self.game.terrain() == pioneer_sim::Terrain::RiverValley;
        json!({
            "seed": self.game.rng.seed().to_string(), "status": self.game.status, "day": self.game.day,
            "trail_id": self.game.trail_id, "era_id": self.game.era_id, "occupation_id": self.game.occupation_id, "difficulty": self.game.difficulty,
            "content": self.game.content,
            "date": {"year": year, "month": month, "day": day_of_month}, "miles": self.game.miles,
            "weather": self.game.weather, "terrain": self.game.terrain(), "pace": self.game.pace, "rations": self.game.rations,
            "cash_cents": self.game.cash_cents, "weight_lbs": self.game.wagon_weight(), "capacity_lbs": 2400, "daily_food_lbs": self.game.daily_food_lbs(),
            "score": self.game.score(), "party": self.game.party, "inventory": self.game.inventory.quantities,
            "current_node": node, "target_node_id": self.game.target_node_id, "route_miles_remaining": self.game.route_miles_remaining,
            "routes": routes, "river": river, "can_shop": self.game.can_shop(), "can_repair": self.game.can_repair(),
            "items": items, "speakers": speakers, "offered_letter": self.game.offered_letter(), "can_deliver_letter": self.game.can_deliver_letter(),
            "pending_event": pending_event, "active_letter": self.game.active_letter, "pending_counteroffer": self.game.pending_counteroffer, "npcs": self.game.npcs.iter().filter(|npc| self.game.npc_present(&npc.id)).collect::<Vec<_>>(),
            "active_minigame": self.game.active_minigame.as_ref().map(|session| json!({"kind": session.kind, "seed": session.seed.to_string(), "ammo_available": session.ammo_available})), "journal": journal, "visited_landmarks": self.game.visited_landmarks,
            "has_fresh_food": self.game.has_fresh_food(), "available_party_slots": self.game.available_party_slots(),
            "can_camp": can_camp, "can_hunt": can_hunt, "can_fish": can_fish,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn configured(seed: u64) -> GameState {
        let mut game = GameState::with_content(seed, pioneer_data::load().unwrap());
        game.apply(Command::Configure {
            trail_id: "oregon".into(),
            era_id: "1843".into(),
            occupation_id: "carpenter".into(),
            party: vec!["A".into(), "B".into(), "C".into(), "D".into(), "E".into()],
            departure_month: 4,
        });
        game.apply(Command::Buy {
            item_id: "oxen".into(),
            quantity: 3,
        });
        game.apply(Command::Buy {
            item_id: "food".into(),
            quantity: 500,
        });
        game.apply(Command::Buy {
            item_id: "ammunition".into(),
            quantity: 5,
        });
        game.apply(Command::Depart);
        game
    }

    #[test]
    fn opaque_large_seed_save_round_trip_preserves_future_outcomes() {
        let mut original = configured(18_446_744_073_709_551_615);
        let save = serde_json::to_string(&original).unwrap();
        let mut restored: GameState = serde_json::from_str(&save).unwrap();
        for _ in 0..8 {
            assert_eq!(
                original.apply(Command::TravelDay),
                restored.apply(Command::TravelDay)
            );
        }
        assert_eq!(
            serde_json::to_string(&original).unwrap(),
            serde_json::to_string(&restored).unwrap()
        );
    }

    #[test]
    fn rejected_command_is_a_non_mutating_bridge_result() {
        let mut game = configured(41);
        let before = serde_json::to_string(&game).unwrap();
        assert!(matches!(
            game.apply(Command::Buy {
                item_id: "food".into(),
                quantity: 1
            })
            .as_slice(),
            [pioneer_sim::Outcome::Rejected(_)]
        ));
        assert_eq!(before, serde_json::to_string(&game).unwrap());
    }
}

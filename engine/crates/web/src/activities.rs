//! Durable spatial activity ledger. Rendering reports observed events; Rust owns their costs.
use pioneer_sim::{Command, CrossMethod, GameState, MinigameKind, Outcome, RunStatus, Terrain};
use rand::Rng;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ActivityKind {
    Hunt,
    Fish,
    Crossing,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum CrossingMethod {
    Ford,
    Caulk,
    Guide,
    Raft,
}
impl CrossingMethod {
    fn river(self) -> Option<CrossMethod> {
        match self {
            Self::Ford => Some(CrossMethod::Ford),
            Self::Caulk => Some(CrossMethod::Caulk),
            Self::Guide => Some(CrossMethod::Guide),
            Self::Raft => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct BeginActivity {
    pub kind: ActivityKind,
    pub method: Option<CrossingMethod>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum Animal {
    Buffalo,
    Deer,
    Bear,
    Rabbit,
    Squirrel,
}
impl Animal {
    fn food(self) -> u32 {
        match self {
            Self::Buffalo => 100,
            Self::Deer => 55,
            Self::Bear => 65,
            Self::Rabbit => 8,
            Self::Squirrel => 3,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase", deny_unknown_fields)]
pub enum ActivityEvent {
    Shot {
        #[serde(rename = "targetId")]
        target_id: Option<String>,
        animal: Option<Animal>,
    },
    Collect {
        #[serde(rename = "targetId")]
        target_id: String,
    },
    Catch {
        #[serde(rename = "fishId")]
        fish_id: String,
        #[serde(rename = "foodLbs")]
        food_lbs: u32,
    },
    Collision {
        #[serde(rename = "obstacleId")]
        obstacle_id: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RecordActivity {
    pub id: String,
    pub sequence: u32,
    pub event: ActivityEvent,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct FinishActivity {
    pub id: String,
    pub completed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Activity {
    pub id: String,
    pub kind: ActivityKind,
    pub method: Option<CrossingMethod>,
    pub seed: String,
    pub sequence: u32,
    pub shots: u32,
    pub ammo_limit: u32,
    pub food_lbs: u32,
    pub food_limit: u32,
    pub cargo_lost_lbs: u32,
    pub collision_loss_lbs: u32,
    pub day_cost: u32,
    pub started_day: u32,
    pub targets: BTreeSet<String>,
    pub pending_kills: BTreeMap<String, Animal>,
    pub collected_kills: BTreeMap<String, Animal>,
    pub obstacles: BTreeSet<String>,
}

fn accepted(outcomes: &[Outcome]) -> Result<(), String> {
    if let Some(outcome) = outcomes
        .iter()
        .find(|outcome| matches!(outcome, Outcome::Rejected(_)))
    {
        Err(format!("{outcome:?}"))
    } else {
        Ok(())
    }
}

impl Activity {
    /// Called on a cloned game. A failed begin cannot spend RNG, clothing or days.
    pub fn begin(game: &mut GameState, request: BeginActivity, id: String) -> Result<Self, String> {
        if game.pending_event.is_some()
            || matches!(
                game.status,
                RunStatus::Setup | RunStatus::Outfitting | RunStatus::Arrived | RunStatus::Failed
            )
        {
            return Err("Resolve the current decision before starting an activity.".into());
        }
        let mut ammo_limit = 0;
        let food_limit;
        let mut collision_loss_lbs = 0;
        let seed;
        match request.kind {
            ActivityKind::Hunt => {
                if request.method.is_some() {
                    return Err("Hunting has no crossing method.".into());
                }
                if game.active_minigame.is_none() {
                    accepted(&game.apply(Command::BeginHunt))?;
                }
                let session = game.active_minigame.as_ref().ok_or("Hunt did not start.")?;
                if session.kind != MinigameKind::Hunt {
                    return Err("A different activity is already active.".into());
                }
                ammo_limit = session.ammo_available.min(20);
                food_limit = if game.occupation_id.as_deref() == Some("hunter") {
                    200
                } else {
                    150
                };
                seed = session.seed.to_string();
            }
            ActivityKind::Fish => {
                if request.method.is_some()
                    || game.active_minigame.is_some()
                    || game.terrain() != Terrain::RiverValley
                {
                    return Err(
                        "Fish from suitable river-valley water with no other active activity."
                            .into(),
                    );
                }
                accepted(&game.clone().apply(Command::FishResult { food_lbs: 0 }))?;
                food_limit = 45;
                seed = game
                    .rng
                    .stream("spatial-activities")
                    .gen::<u64>()
                    .to_string();
            }
            ActivityKind::Crossing => {
                let method = request.method.ok_or("Choose a crossing method.")?;
                food_limit = 0;
                if let Some(river_method) = method.river() {
                    if game.active_minigame.is_some() {
                        return Err("A different activity is already active.".into());
                    }
                    accepted(&game.clone().apply(Command::CrossingResult {
                        method: river_method,
                        cargo_lost_lbs: 0,
                        completed: false,
                    }))?;
                    collision_loss_lbs =
                        5 + game.crossing_risk(river_method).ok_or("No river here.")? / 5;
                    seed = game
                        .rng
                        .stream("spatial-activities")
                        .gen::<u64>()
                        .to_string();
                } else {
                    if game.active_minigame.is_none() {
                        accepted(&game.apply(Command::ChooseRoute {
                            route_id: "columbia".into(),
                        }))?;
                    }
                    let session = game
                        .active_minigame
                        .as_ref()
                        .ok_or("Raft did not launch.")?;
                    if session.kind != MinigameKind::Raft {
                        return Err("A different activity is already active.".into());
                    }
                    seed = session.seed.to_string();
                    collision_loss_lbs = 10;
                }
            }
        }
        Ok(Self {
            id,
            kind: request.kind,
            method: request.method,
            seed,
            sequence: 0,
            shots: 0,
            ammo_limit,
            food_lbs: 0,
            food_limit,
            cargo_lost_lbs: 0,
            collision_loss_lbs,
            day_cost: 1,
            started_day: game.day,
            targets: BTreeSet::new(),
            pending_kills: BTreeMap::new(),
            collected_kills: BTreeMap::new(),
            obstacles: BTreeSet::new(),
        })
    }

    /// Each shot/miss or catch/collision must be checkpointed before the world advances.
    pub fn record(&mut self, request: RecordActivity) -> Result<(), String> {
        if request.id != self.id || request.sequence != self.sequence + 1 || self.sequence >= 64 {
            return Err("Stale, duplicate or out-of-order activity event.".into());
        }
        match request.event {
            ActivityEvent::Shot { target_id, animal } if self.kind == ActivityKind::Hunt => {
                if self.shots >= self.ammo_limit {
                    return Err("No ammunition remains in this hunt.".into());
                }
                match (target_id, animal) {
                    (Some(id), Some(animal)) if valid_id(&id) && !self.targets.contains(&id) => {
                        self.targets.insert(id.clone());
                        self.pending_kills.insert(id, animal);
                    }
                    (None, None) => {}
                    _ => return Err("Invalid or already collected hunting target.".into()),
                }
                self.shots += 1;
            }
            ActivityEvent::Collect { target_id } if self.kind == ActivityKind::Hunt => {
                let animal = self
                    .pending_kills
                    .remove(&target_id)
                    .ok_or("That carcass is missing or already collected.")?;
                self.collected_kills.insert(target_id, animal);
                self.food_lbs = (self.food_lbs + animal.food()).min(self.food_limit);
            }
            ActivityEvent::Catch { fish_id, food_lbs } if self.kind == ActivityKind::Fish => {
                if !valid_id(&fish_id)
                    || self.targets.contains(&fish_id)
                    || food_lbs == 0
                    || food_lbs > self.food_limit.saturating_sub(self.food_lbs)
                {
                    return Err("Invalid, duplicate or excessive catch.".into());
                }
                self.targets.insert(fish_id);
                self.food_lbs += food_lbs;
            }
            ActivityEvent::Collision { obstacle_id } if self.kind == ActivityKind::Crossing => {
                if !valid_id(&obstacle_id)
                    || self.obstacles.contains(&obstacle_id)
                    || self.obstacles.len() >= 12
                {
                    return Err("Invalid or duplicate crossing collision.".into());
                }
                self.obstacles.insert(obstacle_id);
                self.cargo_lost_lbs = (self.cargo_lost_lbs + self.collision_loss_lbs).min(120);
            }
            _ => return Err("That event does not belong to this activity.".into()),
        }
        self.sequence += 1;
        Ok(())
    }

    pub fn finish(&self, game: &mut GameState, completed: bool) -> Result<Vec<Outcome>, String> {
        let command = match self.kind {
            ActivityKind::Hunt => Command::HuntResult {
                food_lbs: self.food_lbs,
                shots: self.shots,
            },
            ActivityKind::Fish => Command::FishResult {
                food_lbs: self.food_lbs,
            },
            ActivityKind::Crossing => {
                match self.method.ok_or("Crossing method missing.")?.river() {
                    Some(method) => Command::CrossingResult {
                        method,
                        cargo_lost_lbs: self.cargo_lost_lbs,
                        completed,
                    },
                    None => Command::RaftResult {
                        cargo_lost_lbs: self.cargo_lost_lbs,
                        casualties: 0,
                        completed,
                    },
                }
            }
        };
        let outcomes = game.apply(command);
        accepted(&outcomes)?;
        Ok(outcomes)
    }

    pub fn validate(&self, game: &GameState) -> Result<(), String> {
        let mut preview = game.clone();
        let expected = Self::begin(
            &mut preview,
            BeginActivity {
                kind: self.kind,
                method: self.method,
            },
            self.id.clone(),
        )?;
        if !valid_id(&self.id)
            || self.seed.parse::<u64>().is_err()
            || self.started_day != game.day
            || self.day_cost != 1
            || self.sequence > 64
            || self.shots > self.ammo_limit
            || self.ammo_limit != expected.ammo_limit
            || self.food_limit != expected.food_limit
            || self.food_lbs > self.food_limit
            || self.cargo_lost_lbs > 120
            || self.collision_loss_lbs != expected.collision_loss_lbs
            || self.targets.iter().any(|id| !valid_id(id))
            || self.obstacles.iter().any(|id| !valid_id(id))
            || self.obstacles.len() > 12
        {
            return Err("Invalid activity checkpoint.".into());
        }
        match self.kind {
            ActivityKind::Hunt
                if self.sequence != self.shots + self.collected_kills.len() as u32
                    || self.targets.len() > self.shots as usize
                    || !self.obstacles.is_empty()
                    || self.cargo_lost_lbs != 0
                    || self.seed != expected.seed
                    || self.targets.len()
                        != self.pending_kills.len() + self.collected_kills.len()
                    || self.pending_kills.keys().any(|id| {
                        !self.targets.contains(id) || self.collected_kills.contains_key(id)
                    })
                    || self
                        .collected_kills
                        .keys()
                        .any(|id| !self.targets.contains(id))
                    || self.food_lbs
                        != self
                            .collected_kills
                            .values()
                            .map(|animal| animal.food())
                            .sum::<u32>()
                            .min(self.food_limit) =>
            {
                return Err("Invalid hunt checkpoint.".into())
            }
            ActivityKind::Fish
                if self.sequence as usize != self.targets.len()
                    || self.shots != 0
                    || !self.obstacles.is_empty()
                    || self.cargo_lost_lbs != 0
                    || (self.food_lbs > 0 && self.targets.is_empty())
                    || !self.pending_kills.is_empty()
                    || !self.collected_kills.is_empty() =>
            {
                return Err("Invalid fishing checkpoint.".into())
            }
            ActivityKind::Crossing
                if self.sequence as usize != self.obstacles.len()
                    || self.shots != 0
                    || !self.targets.is_empty()
                    || self.cargo_lost_lbs
                        != (self.obstacles.len() as u32 * self.collision_loss_lbs).min(120)
                    || !self.pending_kills.is_empty()
                    || !self.collected_kills.is_empty() =>
            {
                return Err("Invalid crossing checkpoint.".into())
            }
            _ => {}
        }
        Ok(())
    }
}

fn valid_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 96 && !id.chars().any(char::is_control)
}

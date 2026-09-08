//! Deterministic browser minigame worlds copied from the terminal frontend.
//!
//! The simulation owns session creation and validates the final command. This module owns
//! only the fixed-step interaction between those two points; rendering never changes it.
use pioneer_sim::rng::SimRng;
use pioneer_sim::{Command, GameState, MinigameKind, Terrain};
use rand::Rng;
use serde::{Deserialize, Serialize};

const WIDTH: i16 = 80;
const HEIGHT: i16 = 23;
const TICKS_PER_SECOND: u16 = 30;

#[derive(Clone, Debug, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum MinigameAction {
    Key { key: String },
    TextKey { key: String },
    Aim { x: i16, y: i16 },
    Shoot,
    Steer { direction: Direction },
    Finish,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Direction {
    Left,
    Right,
}

#[derive(Clone, Debug, Serialize)]
#[serde(tag = "kind")]
pub enum MinigameSnapshot {
    Hunt(HuntSnapshot),
    Raft(RaftSnapshot),
}

#[derive(Clone, Debug, Serialize)]
pub struct HuntSnapshot {
    pub seed: String,
    pub ammo_available: u16,
    pub seconds_remaining: u16,
    pub food_lbs: u16,
    pub shots: u16,
    pub crosshair: Position,
    pub targets: Vec<TargetSnapshot>,
    pub finished: bool,
}

#[derive(Clone, Debug, Serialize)]
pub struct RaftSnapshot {
    pub seed: String,
    pub ammo_available: u16,
    pub seconds_remaining: u16,
    pub cargo_lost_lbs: u16,
    pub casualties: u8,
    pub raft_x: i16,
    pub rocks: Vec<RockSnapshot>,
    pub finished: bool,
    pub aborted: bool,
}

#[derive(Clone, Copy, Debug, Serialize)]
pub struct Position {
    pub x: i16,
    pub y: i16,
}

#[derive(Clone, Debug, Serialize)]
pub struct TargetSnapshot {
    pub id: usize,
    pub name: &'static str,
    pub x: i16,
    pub y: i16,
    pub alive: bool,
    /// A guaranteed filled sprite cell for the terminal's accessible target list.
    pub aim: Option<Position>,
}
#[derive(Clone, Debug, Serialize)]
pub struct RockSnapshot {
    pub id: usize,
    pub x: i16,
    pub y: i16,
    pub charged: bool,
}

pub enum MinigameWorld {
    Hunt(HuntingGame),
    Raft(RaftingGame),
}

impl MinigameWorld {
    /// Builds the same world that the terminal builds from a live simulation session.
    pub fn from_game(game: &GameState) -> Option<Self> {
        let session = game.active_minigame.as_ref()?;
        match session.kind {
            MinigameKind::Hunt => {
                let biome = match game.terrain() {
                    Terrain::Mountains => Biome::Mountains,
                    Terrain::Forest | Terrain::Hills => Biome::Forest,
                    Terrain::Desert => Biome::Desert,
                    Terrain::RiverValley => Biome::RiverValley,
                    Terrain::Plains => Biome::Plains,
                };
                let skill = game
                    .party
                    .iter()
                    .filter(|member| member.alive)
                    .map(|member| member.skills.hunting)
                    .max()
                    .unwrap_or(0);
                Some(Self::Hunt(
                    HuntingGame::new(
                        session.seed,
                        biome,
                        game.occupation_id.as_deref() == Some("hunter"),
                        session.ammo_available.min(20) as u16,
                    )
                    .with_skill(skill),
                ))
            }
            MinigameKind::Raft => Some(Self::Raft(RaftingGame::new(session.seed))),
        }
    }

    pub fn tick(&mut self, frames: u16) {
        for _ in 0..frames {
            match self {
                Self::Hunt(game) => game.tick(),
                Self::Raft(game) => game.tick(),
            }
        }
    }
    pub fn action(&mut self, action: MinigameAction) {
        match self {
            Self::Hunt(game) => match action {
                MinigameAction::TextKey { key } => game.text_key(&key),
                action => game.action(action),
            },
            Self::Raft(game) => match action {
                MinigameAction::TextKey { key } => game.text_key(&key),
                action => game.action(action),
            },
        }
    }
    pub fn snapshot(&self) -> MinigameSnapshot {
        match self {
            Self::Hunt(game) => MinigameSnapshot::Hunt(game.snapshot()),
            Self::Raft(game) => MinigameSnapshot::Raft(game.snapshot()),
        }
    }
    pub fn finished(&self) -> bool {
        match self {
            Self::Hunt(game) => game.finished,
            Self::Raft(game) => game.finished,
        }
    }
    pub fn result_command(&self) -> Option<Command> {
        if !self.finished() {
            return None;
        }
        Some(match self {
            Self::Hunt(game) => Command::HuntResult {
                food_lbs: game.food.into(),
                shots: game.shots.into(),
            },
            Self::Raft(game) => Command::RaftResult {
                cargo_lost_lbs: game.cargo.into(),
                casualties: game.casualties,
                completed: game.finished && !game.aborted && game.ticks >= 900,
            },
        })
    }
}

#[derive(Clone, Copy)]
enum Biome {
    Plains,
    Forest,
    Mountains,
    Desert,
    RiverValley,
}
#[derive(Clone, Copy, Debug)]
enum Animal {
    Buffalo,
    Deer,
    Bear,
    Rabbit,
    Squirrel,
}
impl Animal {
    fn name(self) -> &'static str {
        match self {
            Self::Buffalo => "Buffalo",
            Self::Deer => "Deer",
            Self::Bear => "Bear",
            Self::Rabbit => "Rabbit",
            Self::Squirrel => "Squirrel",
        }
    }
    fn food(self) -> u16 {
        match self {
            Self::Buffalo => 100,
            Self::Deer => 55,
            Self::Bear => 65,
            Self::Rabbit => 8,
            Self::Squirrel => 3,
        }
    }
    fn sprite(self, frame: u16) -> String {
        let name = match self {
            Self::Buffalo => "buffalo",
            Self::Deer => "deer",
            Self::Bear => "bear",
            Self::Rabbit => "rabbit",
            Self::Squirrel => "squirrel",
        };
        format!("{name}_{}.px", frame % 2)
    }
}
#[derive(Clone, Copy, Debug)]
struct Target {
    kind: Animal,
    x: i16,
    y: i16,
    dx: i16,
    alive: bool,
}

pub(crate) struct HuntingGame {
    seed: u64,
    rng: SimRng,
    targets: Vec<Target>,
    crosshair: (i16, i16),
    ticks: u16,
    shots: u16,
    ammo: u16,
    food: u16,
    capacity: u16,
    aim_radius: i16,
    finished: bool,
}
impl HuntingGame {
    fn new(seed: u64, biome: Biome, hunter: bool, ammo_available: u16) -> Self {
        let mut game = Self {
            seed,
            rng: SimRng::new(seed),
            targets: Vec::new(),
            crosshair: (40, 11),
            ticks: 0,
            shots: 0,
            ammo: ammo_available.min(20),
            food: 0,
            capacity: if hunter { 200 } else { 150 },
            aim_radius: if hunter { 1 } else { 0 },
            finished: false,
        };
        let stream = game.rng.stream("hunting-spawn");
        for _ in 0..(3 + stream.gen_range(0..3)) {
            let kind = match biome {
                Biome::Plains => {
                    if stream.gen_bool(0.35) {
                        Animal::Buffalo
                    } else {
                        Animal::Deer
                    }
                }
                Biome::Forest => {
                    if stream.gen_bool(0.4) {
                        Animal::Deer
                    } else {
                        Animal::Bear
                    }
                }
                Biome::Mountains => Animal::Deer,
                Biome::Desert => Animal::Rabbit,
                Biome::RiverValley => Animal::Squirrel,
            };
            game.targets.push(Target {
                kind,
                x: stream.gen_range(3..77),
                y: stream.gen_range(2..21),
                dx: if stream.gen_bool(0.5) { 1 } else { -1 },
                alive: true,
            });
        }
        game
    }
    fn with_skill(mut self, skill: u8) -> Self {
        self.aim_radius = self.aim_radius.max(i16::from((skill / 4).min(2)));
        self
    }
    fn tick(&mut self) {
        if self.finished {
            return;
        }
        self.ticks = self.ticks.saturating_add(1);
        if self.ticks.is_multiple_of(6) {
            for target in &mut self.targets {
                if target.alive {
                    target.x += target.dx;
                    if target.x <= 1 || target.x >= 78 {
                        target.dx = -target.dx;
                    }
                }
            }
        }
        if self.ticks >= 30 * TICKS_PER_SECOND {
            self.finished = true;
        }
    }
    fn action(&mut self, action: MinigameAction) {
        if self.finished {
            return;
        }
        match action {
            MinigameAction::Key { key } => match key.as_str() {
                "ArrowLeft" | "h" => self.crosshair.0 = (self.crosshair.0 - 1).max(0),
                "ArrowRight" | "l" => self.crosshair.0 = (self.crosshair.0 + 1).min(WIDTH - 1),
                "ArrowUp" | "k" => self.crosshair.1 = (self.crosshair.1 - 1).max(0),
                "ArrowDown" | "j" => self.crosshair.1 = (self.crosshair.1 + 1).min(HEIGHT - 1),
                " " => self.shoot(),
                "Escape" => self.finished = true,
                _ => {}
            },
            MinigameAction::Aim { x, y } => {
                self.crosshair = (x.clamp(0, WIDTH - 1), y.clamp(0, HEIGHT - 1))
            }
            MinigameAction::Shoot => self.shoot(),
            MinigameAction::Finish => self.finished = true,
            _ => {}
        }
    }
    /// Original text-mode rules: numbered visible animals shoot and consume one second;
    /// Space waits one second. This keeps reduced-motion interaction deterministic.
    fn text_key(&mut self, key: &str) {
        if self.finished {
            return;
        }
        if let Some(number) = key.chars().next().and_then(|value| value.to_digit(10)) {
            if (1..=5).contains(&number) {
                if let Some((_, aim)) = self.text_targets().get(number as usize - 1).copied() {
                    self.crosshair = aim;
                    self.shoot();
                    self.advance_turn();
                }
                return;
            }
        }
        match key {
            " " => self.advance_turn(),
            "Escape" => self.finished = true,
            _ => {}
        }
    }
    fn text_targets(&self) -> Vec<(Target, (i16, i16))> {
        self.targets
            .iter()
            .filter(|target| target.alive)
            .filter_map(|target| self.visible_cell(*target).map(|aim| (*target, aim)))
            .collect()
    }
    fn visible_cell(&self, target: Target) -> Option<(i16, i16)> {
        let file = pioneer_data::ART.get_file(target.kind.sprite(self.ticks / 5))?;
        let text = std::str::from_utf8(file.contents()).ok()?;
        for (y, line) in text
            .lines()
            .filter(|line| !line.starts_with('#'))
            .enumerate()
        {
            for (x, pixel) in line.bytes().enumerate() {
                if pixel == b'.' {
                    continue;
                }
                let aim = (target.x - 8 + x as i16, target.y - 2 + (y as i16 / 2));
                if (0..WIDTH).contains(&aim.0) && (0..HEIGHT).contains(&aim.1) {
                    return Some(aim);
                }
            }
        }
        None
    }
    fn advance_turn(&mut self) {
        for _ in 0..TICKS_PER_SECOND {
            self.tick();
            if self.finished {
                break;
            }
        }
    }
    fn shoot(&mut self) {
        if self.ammo == 0 {
            return;
        }
        self.ammo -= 1;
        self.shots = self.shots.saturating_add(1);
        for target in &mut self.targets {
            let hit = (-self.aim_radius..=self.aim_radius).any(|dy| {
                (-self.aim_radius..=self.aim_radius).any(|dx| {
                    let world_x = self.crosshair.0 + dx;
                    let world_y = self.crosshair.1 + dy;
                    let pixel_x = world_x - (target.x - 8);
                    let pixel_y = world_y - (target.y - 2);
                    dx.abs() + dy.abs() <= self.aim_radius
                        && (0..WIDTH).contains(&world_x)
                        && (0..HEIGHT).contains(&world_y)
                        && pixel_x >= 0
                        && pixel_y >= 0
                        && sprite_filled(
                            target.kind,
                            self.ticks / 5,
                            pixel_x as u16,
                            pixel_y as u16,
                        )
                })
            });
            if target.alive && hit {
                target.alive = false;
                self.food = (self.food + target.kind.food()).min(self.capacity);
                break;
            }
        }
        if self.food >= self.capacity {
            self.finished = true;
        }
    }
    fn snapshot(&self) -> HuntSnapshot {
        HuntSnapshot {
            seed: self.seed.to_string(),
            ammo_available: self.ammo,
            seconds_remaining: 30u16.saturating_sub(self.ticks / TICKS_PER_SECOND),
            food_lbs: self.food,
            shots: self.shots,
            crosshair: Position {
                x: self.crosshair.0,
                y: self.crosshair.1,
            },
            targets: self
                .targets
                .iter()
                .enumerate()
                .map(|(id, target)| TargetSnapshot {
                    id,
                    name: target.kind.name(),
                    x: target.x,
                    y: target.y,
                    alive: target.alive,
                    aim: self.visible_cell(*target).map(|(x, y)| Position { x, y }),
                })
                .collect(),
            finished: self.finished,
        }
    }
}

/// Uses the exact embedded `.px` sprite occupancy at the terminal's half-block coordinates.
fn sprite_filled(animal: Animal, frame: u16, x: u16, y: u16) -> bool {
    let Some(file) = pioneer_data::ART.get_file(animal.sprite(frame)) else {
        return false;
    };
    let lines = match std::str::from_utf8(file.contents()) {
        Ok(value) => value
            .lines()
            .filter(|line| !line.starts_with('#'))
            .collect::<Vec<_>>(),
        Err(_) => return false,
    };
    let row = y.saturating_mul(2) as usize;
    lines.get(row).is_some_and(|line| {
        line.as_bytes()
            .get(x as usize)
            .is_some_and(|pixel| *pixel != b'.')
    }) || lines.get(row + 1).is_some_and(|line| {
        line.as_bytes()
            .get(x as usize)
            .is_some_and(|pixel| *pixel != b'.')
    })
}

#[derive(Clone, Copy, Debug)]
struct Rock {
    x: i16,
    y: i16,
    charged: bool,
}
pub(crate) struct RaftingGame {
    seed: u64,
    rng: SimRng,
    rocks: Vec<Rock>,
    raft_x: i16,
    ticks: u16,
    cargo: u16,
    casualties: u8,
    impacts: u16,
    finished: bool,
    aborted: bool,
}
impl RaftingGame {
    fn new(seed: u64) -> Self {
        let mut game = Self {
            seed,
            rng: SimRng::new(seed),
            rocks: Vec::new(),
            raft_x: 40,
            ticks: 0,
            cargo: 0,
            casualties: 0,
            impacts: 0,
            finished: false,
            aborted: false,
        };
        let stream = game.rng.stream("rafting-rocks");
        for _ in 0..8 {
            game.rocks.push(Rock {
                x: stream.gen_range(4..76),
                y: stream.gen_range(-70..0),
                charged: false,
            });
        }
        game
    }
    fn tick(&mut self) {
        if self.finished {
            return;
        }
        self.ticks += 1;
        if self.ticks.is_multiple_of(3) {
            for rock in &mut self.rocks {
                rock.y += 1;
                if rock.y > 22 {
                    rock.y = -self.rng.stream("rafting-rocks").gen_range(20..70);
                    rock.x = self.rng.stream("rafting-rocks").gen_range(4..76);
                    rock.charged = false;
                }
                if !rock.charged
                    && rock.y + 2 > 19
                    && rock.y < 22
                    && rock.x < self.raft_x + 6
                    && rock.x + 6 > self.raft_x - 6
                {
                    rock.charged = true;
                    self.cargo = (self.cargo + 15).min(120);
                    self.impacts = self.impacts.saturating_add(1);
                    if self.impacts.is_multiple_of(3) {
                        self.casualties = (self.casualties + 1).min(4);
                    }
                }
            }
        }
        if self.ticks >= 900 {
            self.finished = true;
        }
    }
    fn action(&mut self, action: MinigameAction) {
        if self.finished {
            return;
        }
        let left = matches!(
            action,
            MinigameAction::Steer {
                direction: Direction::Left
            }
        ) || matches!(action, MinigameAction::Key { ref key } if key == "ArrowLeft" || key == "h");
        let right = matches!(
            action,
            MinigameAction::Steer {
                direction: Direction::Right
            }
        ) || matches!(action, MinigameAction::Key { ref key } if key == "ArrowRight" || key == "l");
        if left {
            self.raft_x = (self.raft_x - 2).max(6);
        } else if right {
            self.raft_x = (self.raft_x + 2).min(74);
        } else if matches!(action, MinigameAction::Finish)
            || matches!(action, MinigameAction::Key { ref key } if key == "Escape")
        {
            self.finished = true;
            self.aborted = true;
        }
    }
    fn text_key(&mut self, key: &str) {
        if self.finished {
            return;
        }
        match key {
            "1" => {
                self.raft_x = 14;
                self.advance_turn();
            }
            "2" => {
                self.raft_x = 40;
                self.advance_turn();
            }
            "3" => {
                self.raft_x = 66;
                self.advance_turn();
            }
            " " => self.advance_turn(),
            "Escape" => {
                self.finished = true;
                self.aborted = true;
            }
            _ => {}
        }
    }
    fn advance_turn(&mut self) {
        for _ in 0..TICKS_PER_SECOND {
            self.tick();
            if self.finished {
                break;
            }
        }
    }
    fn snapshot(&self) -> RaftSnapshot {
        RaftSnapshot {
            seed: self.seed.to_string(),
            ammo_available: 0,
            seconds_remaining: 30u16.saturating_sub(self.ticks / TICKS_PER_SECOND),
            cargo_lost_lbs: self.cargo,
            casualties: self.casualties,
            raft_x: self.raft_x,
            rocks: self
                .rocks
                .iter()
                .enumerate()
                .map(|(id, rock)| RockSnapshot {
                    id,
                    x: rock.x,
                    y: rock.y,
                    charged: rock.charged,
                })
                .collect(),
            finished: self.finished,
            aborted: self.aborted,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn hunt_seed_and_ticks_are_repeatable() {
        let mut left = HuntingGame::new(7, Biome::Plains, false, 20);
        let mut right = HuntingGame::new(7, Biome::Plains, false, 20);
        for _ in 0..100 {
            left.tick();
            right.tick();
        }
        assert_eq!(
            left.snapshot()
                .targets
                .iter()
                .map(|item| (item.x, item.y, item.alive))
                .collect::<Vec<_>>(),
            right
                .snapshot()
                .targets
                .iter()
                .map(|item| (item.x, item.y, item.alive))
                .collect::<Vec<_>>()
        );
    }
    #[test]
    fn hunt_uses_embedded_sprite_mask_and_cannot_credit_twice() {
        let mut game = HuntingGame::new(1, Biome::Desert, false, 20);
        game.targets = vec![Target {
            kind: Animal::Rabbit,
            x: 40,
            y: 11,
            dx: 1,
            alive: true,
        }];
        game.shoot();
        game.shoot();
        assert_eq!((game.food, game.shots), (8, 2));
    }
    #[test]
    fn hunt_has_finite_ammunition() {
        let mut game = HuntingGame::new(1, Biome::Desert, false, 1);
        for _ in 0..100 {
            game.shoot();
        }
        assert_eq!(game.shots, 1);
    }
    #[test]
    fn text_hunt_uses_a_visible_sprite_cell_then_advances_one_second() {
        let mut game = HuntingGame::new(1, Biome::Desert, false, 20);
        game.targets = vec![Target {
            kind: Animal::Rabbit,
            x: 40,
            y: 11,
            dx: 1,
            alive: true,
        }];
        game.text_key("1");
        assert_eq!((game.food, game.shots, game.ticks), (8, 1, 30));
        game.text_key(" ");
        assert_eq!(game.ticks, 60);
    }
    #[test]
    fn raft_is_repeatable_and_finishes_at_thirty_seconds() {
        let mut left = RaftingGame::new(4);
        let mut right = RaftingGame::new(4);
        for _ in 0..900 {
            left.tick();
            right.tick();
        }
        assert_eq!(
            (left.cargo, left.casualties, left.raft_x),
            (right.cargo, right.casualties, right.raft_x)
        );
        assert!(left.finished);
    }
    #[test]
    fn raft_collision_only_charges_once() {
        let mut game = RaftingGame::new(1);
        game.rocks = vec![Rock {
            x: 40,
            y: 20,
            charged: false,
        }];
        game.ticks = 2;
        game.tick();
        let cargo = game.cargo;
        game.tick();
        assert_eq!(game.cargo, cargo);
    }
    #[test]
    fn raft_abort_is_not_completion() {
        let mut game = RaftingGame::new(1);
        game.action(MinigameAction::Finish);
        assert!(game.finished && game.aborted);
        assert!(!matches!(
            MinigameWorld::Raft(game).result_command(),
            Some(Command::RaftResult {
                completed: true,
                ..
            })
        ));
    }
    #[test]
    fn text_raft_selects_a_lane_then_advances_one_second() {
        let mut game = RaftingGame::new(4);
        game.text_key("1");
        assert_eq!((game.raft_x, game.ticks), (14, 30));
        game.text_key(" ");
        assert_eq!(game.ticks, 60);
    }

    #[test]
    fn world_restarts_from_the_simulation_session_seed() {
        let mut game = GameState::with_content(18, pioneer_data::load().unwrap());
        game.apply(Command::Configure {
            trail_id: "oregon".into(),
            era_id: "1848".into(),
            occupation_id: "farmer".into(),
            party: vec!["Ada", "Ben", "Clara", "Dan", "Eve"]
                .into_iter()
                .map(str::to_owned)
                .collect(),
            departure_month: 3,
        });
        game.apply(Command::Buy {
            item_id: "oxen".into(),
            quantity: 3,
        });
        game.apply(Command::Buy {
            item_id: "ammunition".into(),
            quantity: 2,
        });
        game.apply(Command::Depart);
        game.apply(Command::BeginHunt);
        let first = MinigameWorld::from_game(&game).unwrap().snapshot();
        let second = MinigameWorld::from_game(&game).unwrap().snapshot();
        assert_eq!(
            serde_json::to_string(&first).unwrap(),
            serde_json::to_string(&second).unwrap()
        );
    }
}

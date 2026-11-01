use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Role {
    Top,
    Jungle,
    Mid,
    Bot,
    Support,
}

pub const ROLES: [Role; 5] = [Role::Top, Role::Jungle, Role::Mid, Role::Bot, Role::Support];

#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Phase {
    Idle,
    Queue,
    ChampSelect,
    DraftFinalizing,
    Loading,
    InGame,
    PostGame,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Connection {
    Connected,
    Recovering,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Team {
    Allies,
    Enemies,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DraftSlot {
    pub champion_id: Option<u32>,
    pub locked: bool,
    pub role: Option<Role>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DraftSnapshot {
    pub session_id: String,
    pub patch: String,
    pub mode: String,
    pub player_role: Role,
    pub allies: Vec<DraftSlot>,
    pub enemies: Vec<DraftSlot>,
    pub bans: Vec<u32>,
    pub revision: u64,
    pub updated_at: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    pub source: &'static str,
    pub phase: Phase,
    pub connection: Connection,
    pub draft: DraftSnapshot,
    generation: u64,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum Action {
    Start,
    Queue,
    Select {
        team: Team,
        slot: usize,
        champion: Option<u32>,
    },
    Lock {
        team: Team,
        slot: usize,
    },
    Ban {
        champion: u32,
    },
    Unban {
        champion: u32,
    },
    Swap {
        team: Team,
        first: usize,
        second: usize,
    },
    SetRole {
        role: Role,
    },
    Advance,
    Dodge,
    Disconnect,
    Reconnect,
}

impl Session {
    pub fn new(patch: String) -> Self {
        Self {
            source: "simulator",
            phase: Phase::Idle,
            connection: Connection::Connected,
            draft: Self::empty_draft(patch, Role::Mid, 0),
            generation: 0,
        }
    }

    fn empty_draft(patch: String, player_role: Role, generation: u64) -> DraftSnapshot {
        let slots = |allied| {
            ROLES
                .iter()
                .map(|role| DraftSlot {
                    champion_id: None,
                    locked: false,
                    role: if allied { Some(*role) } else { None },
                })
                .collect()
        };
        DraftSnapshot {
            session_id: format!("manual-{generation}"),
            patch,
            mode: "SUMMONERS_RIFT_DRAFT".into(),
            player_role,
            allies: slots(true),
            enemies: slots(false),
            bans: vec![],
            revision: 0,
            updated_at: "0".into(),
        }
    }

    pub fn apply(
        &mut self,
        action: Action,
        revision: u64,
        known_ids: &[u32],
    ) -> Result<(), String> {
        if revision != self.draft.revision {
            return Err("La sesión cambió. Volvé a intentar la acción.".into());
        }
        let mut next = self.clone();
        next.reduce(action, known_ids)?;
        next.draft.revision = revision + 1;
        next.draft.updated_at = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis()
            .to_string();
        *self = next;
        Ok(())
    }

    fn editable(&self) -> Result<(), String> {
        if self.connection != Connection::Connected
            || !matches!(self.phase, Phase::ChampSelect | Phase::DraftFinalizing)
        {
            return Err("La selección solo puede editarse durante el draft conectado.".into());
        }
        Ok(())
    }

    fn team(&mut self, team: Team) -> &mut Vec<DraftSlot> {
        match team {
            Team::Allies => &mut self.draft.allies,
            Team::Enemies => &mut self.draft.enemies,
        }
    }

    fn refresh_phase(&mut self) {
        self.phase = if self
            .draft
            .allies
            .iter()
            .chain(&self.draft.enemies)
            .all(|slot| slot.champion_id.is_some() && slot.locked)
        {
            Phase::DraftFinalizing
        } else {
            Phase::ChampSelect
        };
    }

    fn reduce(&mut self, action: Action, known_ids: &[u32]) -> Result<(), String> {
        match action {
            Action::Start | Action::Dodge => {
                self.generation += 1;
                self.draft = Self::empty_draft(
                    self.draft.patch.clone(),
                    self.draft.player_role,
                    self.generation,
                );
                self.connection = Connection::Connected;
                self.phase = if matches!(action, Action::Start) {
                    Phase::ChampSelect
                } else {
                    Phase::Idle
                };
            }
            Action::Queue => {
                if self.phase != Phase::Idle {
                    return Err("Terminá la sesión actual antes de entrar en cola.".into());
                }
                self.phase = Phase::Queue;
            }
            Action::Select {
                team,
                slot,
                champion,
            } => {
                self.editable()?;
                if slot >= 5 {
                    return Err("Posición inválida.".into());
                }
                if let Some(id) = champion {
                    if !known_ids.contains(&id) {
                        return Err("El campeón no existe en el catálogo.".into());
                    }
                    let previous = self.team(team)[slot].champion_id;
                    if self.draft.bans.contains(&id)
                        || (previous != Some(id)
                            && self
                                .draft
                                .allies
                                .iter()
                                .chain(&self.draft.enemies)
                                .any(|s| s.champion_id == Some(id)))
                    {
                        return Err("El campeón está seleccionado o bloqueado.".into());
                    }
                }
                self.team(team)[slot].champion_id = champion;
                self.team(team)[slot].locked = false;
                self.refresh_phase();
            }
            Action::Lock { team, slot } => {
                self.editable()?;
                let target = self.team(team).get_mut(slot).ok_or("Posición inválida.")?;
                if target.champion_id.is_none() {
                    return Err("Elegí un campeón antes de confirmar.".into());
                }
                target.locked = !target.locked;
                self.refresh_phase();
            }
            Action::Ban { champion } => {
                self.editable()?;
                if !known_ids.contains(&champion) {
                    return Err("Campeón inválido.".into());
                }
                if self.draft.bans.len() >= 10
                    || self.draft.bans.contains(&champion)
                    || self
                        .draft
                        .allies
                        .iter()
                        .chain(&self.draft.enemies)
                        .any(|s| s.champion_id == Some(champion))
                {
                    return Err("No se puede bloquear ese campeón.".into());
                }
                self.draft.bans.push(champion);
            }
            Action::Unban { champion } => {
                self.editable()?;
                self.draft.bans.retain(|id| *id != champion);
            }
            Action::Swap {
                team,
                first,
                second,
            } => {
                self.editable()?;
                if first >= 5 || second >= 5 {
                    return Err("Posición inválida.".into());
                }
                let slots = self.team(team);
                let (a, b) = (slots[first].clone(), slots[second].clone());
                slots[first].champion_id = b.champion_id;
                slots[first].locked = b.locked;
                slots[second].champion_id = a.champion_id;
                slots[second].locked = a.locked;
                self.refresh_phase();
            }
            Action::SetRole { role } => {
                self.editable()?;
                self.draft.player_role = role;
            }
            Action::Advance => {
                if self.connection != Connection::Connected {
                    return Err("Reconectá el simulador para continuar.".into());
                }
                self.phase = match self.phase {
                    Phase::DraftFinalizing => Phase::Loading,
                    Phase::Loading => Phase::InGame,
                    Phase::InGame => Phase::PostGame,
                    Phase::PostGame => {
                        self.generation += 1;
                        self.draft = Self::empty_draft(
                            self.draft.patch.clone(),
                            self.draft.player_role,
                            self.generation,
                        );
                        Phase::Idle
                    }
                    _ => {
                        return Err("Completá y confirmá los diez picks antes de continuar.".into())
                    }
                };
            }
            Action::Disconnect => self.connection = Connection::Recovering,
            Action::Reconnect => self.connection = Connection::Connected,
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    const IDS: [u32; 12] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    fn apply(s: &mut Session, a: Action) {
        s.apply(a, s.draft.revision, &IDS).unwrap();
    }
    fn full() -> Session {
        let mut s = Session::new("test".into());
        apply(&mut s, Action::Start);
        for (team, offset) in [(Team::Allies, 0), (Team::Enemies, 5)] {
            for slot in 0..5 {
                apply(
                    &mut s,
                    Action::Select {
                        team,
                        slot,
                        champion: Some((offset + slot + 1) as u32),
                    },
                );
                apply(&mut s, Action::Lock { team, slot });
            }
        }
        s
    }
    #[test]
    fn complete_draft_reaches_postgame_and_clears_on_exit() {
        let mut s = full();
        assert_eq!(s.phase, Phase::DraftFinalizing);
        for phase in [Phase::Loading, Phase::InGame, Phase::PostGame, Phase::Idle] {
            apply(&mut s, Action::Advance);
            assert_eq!(s.phase, phase);
        }
        assert!(s.draft.allies.iter().all(|p| p.champion_id.is_none()));
    }
    #[test]
    fn invalid_picks_and_stale_actions_do_not_mutate_session() {
        let mut s = full();
        for a in [
            Action::Select {
                team: Team::Enemies,
                slot: 0,
                champion: Some(1),
            },
            Action::Select {
                team: Team::Enemies,
                slot: 0,
                champion: Some(999),
            },
            Action::Ban { champion: 1 },
            Action::Swap {
                team: Team::Allies,
                first: 0,
                second: 5,
            },
        ] {
            let before = serde_json::to_value(&s).unwrap();
            assert!(s.apply(a, s.draft.revision, &IDS).is_err());
            assert_eq!(before, serde_json::to_value(&s).unwrap());
        }
        assert!(s.apply(Action::Dodge, 0, &IDS).is_err());
    }
    #[test]
    fn connection_loss_preserves_phase_and_picks() {
        let mut s = full();
        apply(&mut s, Action::Advance);
        apply(&mut s, Action::Advance);
        apply(&mut s, Action::Disconnect);
        assert_eq!(s.phase, Phase::InGame);
        assert_eq!(s.draft.allies[0].champion_id, Some(1));
        assert!(s.apply(Action::Advance, s.draft.revision, &IDS).is_err());
        apply(&mut s, Action::Reconnect);
        apply(&mut s, Action::Advance);
    }
    #[test]
    fn swaps_preserve_positions_and_changes_reopen_finalization() {
        let mut s = full();
        apply(
            &mut s,
            Action::Swap {
                team: Team::Allies,
                first: 0,
                second: 1,
            },
        );
        assert_eq!(s.draft.allies[0].role, Some(Role::Top));
        assert_eq!(s.draft.allies[0].champion_id, Some(2));
        apply(
            &mut s,
            Action::Lock {
                team: Team::Allies,
                slot: 0,
            },
        );
        assert_eq!(s.phase, Phase::ChampSelect);
        assert!(s.apply(Action::Advance, s.draft.revision, &IDS).is_err());
    }
    #[test]
    fn bans_reset_and_all_player_roles_are_supported() {
        for role in ROLES {
            let mut s = Session::new("test".into());
            apply(&mut s, Action::Start);
            apply(&mut s, Action::SetRole { role });
            apply(&mut s, Action::Ban { champion: 12 });
            assert!(s
                .apply(
                    Action::Select {
                        team: Team::Allies,
                        slot: 0,
                        champion: Some(12)
                    },
                    s.draft.revision,
                    &IDS
                )
                .is_err());
            let old_id = s.draft.session_id.clone();
            apply(&mut s, Action::Dodge);
            apply(&mut s, Action::Start);
            assert_ne!(old_id, s.draft.session_id);
            assert!(s.draft.bans.is_empty());
            assert_eq!(s.draft.player_role, role);
        }
    }
}

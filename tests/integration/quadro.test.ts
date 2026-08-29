/**
 * Testes de integração — as regras que NÃO moram no frontend.
 *
 * Rodam contra um Supabase de verdade, pelo mesmo caminho que o navegador usa
 * (supabase-js → PostgREST → RLS/trigger/RPC). É o que prova que a segurança
 * do produto é real: nenhum teste de unidade consegue demonstrar isso.
 *
 * Pulam sozinhos sem `DATABASE_URL` + URL/anon key (que saem do `.env.local`).
 * Para rodar:
 *
 *   DATABASE_URL="postgresql://postgres.<ref>:<senha>@aws-0-<região>.pooler.supabase.com:5432/postgres" npm test
 *
 * Toda conta criada leva o prefixo da execução e é apagada no fim.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  cleanupRun,
  closeDatabase,
  createCharacter,
  createMission,
  createUser,
  integrationReady,
  openDatabase,
  participantOf,
  query,
  type TestUser,
} from "./helpers";

const suite = integrationReady ? describe : describe.skip;

suite("regras reforçadas pelo banco", () => {
  let dm: TestUser;
  let intruder: TestUser;

  beforeAll(async () => {
    await openDatabase();
    dm = await createUser("mestre");
    intruder = await createUser("intruso");
  });

  afterAll(async () => {
    await cleanupRun();
    await closeDatabase();
  });

  /* ---------------------------------------------------------------- */

  describe("perfil e fichas", () => {
    it("cria o perfil automaticamente no cadastro", async () => {
      const rows = await query<{ username: string }>(
        "select username from profiles where id = $1",
        [dm.id],
      );
      expect(rows[0]?.username).toContain("mestre");
    });

    it("bloqueia a quarta ficha ativa", async () => {
      const user = await createUser("limite");
      await createCharacter(user, "Um");
      await createCharacter(user, "Dois");
      await createCharacter(user, "Três");

      const { error } = await user.db
        .from("characters")
        .insert({ user_id: user.id, name: "Quatro", class: "Mago", race: "Elfo" });

      expect(error?.message).toContain("3 fichas ativas");
    });

    it("arquivar libera vaga e preserva o histórico", async () => {
      const user = await createUser("arquivo");
      const first = await createCharacter(user, "Um");
      await createCharacter(user, "Dois");
      await createCharacter(user, "Três");

      const { error: archiveError } = await user.db
        .from("characters")
        .update({ active: false })
        .eq("id", first.id);
      expect(archiveError).toBeNull();

      const archived = await query<{ archived_at: string | null }>(
        "select archived_at from characters where id = $1",
        [first.id],
      );
      expect(archived[0].archived_at).not.toBeNull();

      const { error } = await user.db
        .from("characters")
        .insert({ user_id: user.id, name: "Quatro", class: "Mago", race: "Elfo" });
      expect(error).toBeNull();

      const events = await query(
        "select id from character_events where character_id = $1",
        [first.id],
      );
      expect(events.length).toBeGreaterThan(0);
    });
  });

  // Cada teste que cria ficha ganha o próprio jogador: o limite de 3 fichas
  // ativas é real e derrubaria a suíte se todos compartilhassem uma conta.
  describe("progressão é intocável pelo jogador", () => {
    it("recusa alterar o próprio XP e ouro", async () => {
      const owner = await createUser("xp");
      const character = await createCharacter(owner, "LadrãoDeXP");

      const { error } = await owner.db
        .from("characters")
        .update({ xp: 999_999, gold: 999_999 })
        .eq("id", character.id);
      expect(error?.message).toContain("só são alterados pelo mestre");

      const rows = await query<{ xp: number; gold: number }>(
        "select xp, gold from characters where id = $1",
        [character.id],
      );
      expect(rows[0]).toEqual({ xp: 0, gold: 0 });
    });

    it("recusa o jogador se declarar morto", async () => {
      const owner = await createUser("imortal");
      const character = await createCharacter(owner, "Imortal");
      const { error } = await owner.db
        .from("characters")
        .update({ status: "dead" })
        .eq("id", character.id);
      expect(error?.message).toContain("só são alterados pelo mestre");
    });

    it("permite editar os campos que são do jogador", async () => {
      const owner = await createUser("editor");
      const character = await createCharacter(owner, "Editável");
      const { error } = await owner.db
        .from("characters")
        .update({ current_hp: 12, max_hp: 14, armor_class: 16, notes: "anotação" })
        .eq("id", character.id);
      expect(error).toBeNull();
    });

    it("a RLS esconde a ficha de terceiros de qualquer UPDATE", async () => {
      const owner = await createUser("alvo");
      const character = await createCharacter(owner, "Alvo");
      const { data, error } = await intruder.db
        .from("characters")
        .update({ name: "Sequestrado" })
        .eq("id", character.id)
        .select();

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });
  });

  describe("inscrições", () => {
    it("recusa inscrição duplicada da mesma ficha", async () => {
      const mission = await createMission(dm);
      const owner = await createUser("duplicada");
      const character = await createCharacter(owner, "Duplicada");

      const first = await owner.db.rpc("apply_to_mission", {
        p_mission_id: mission.id,
        p_character_id: character.id,
      });
      expect(first.error).toBeNull();

      const second = await owner.db.rpc("apply_to_mission", {
        p_mission_id: mission.id,
        p_character_id: character.id,
      });
      expect(second.error?.message).toContain("já está inscrita");
    });

    it("permite só uma ficha do mesmo jogador por missão", async () => {
      const user = await createUser("umaficha");
      const mission = await createMission(dm);
      const a = await createCharacter(user, "FichaA");
      const b = await createCharacter(user, "FichaB");

      await user.db.rpc("apply_to_mission", {
        p_mission_id: mission.id,
        p_character_id: a.id,
      });
      const second = await user.db.rpc("apply_to_mission", {
        p_mission_id: mission.id,
        p_character_id: b.id,
      });
      expect(second.error?.message).toContain("já inscreveu outra ficha");
    });

    it("impede o mestre de se inscrever na própria missão", async () => {
      const mission = await createMission(dm);
      const character = await createCharacter(dm, "FichaDoMestre");
      const { error } = await dm.db.rpc("apply_to_mission", {
        p_mission_id: mission.id,
        p_character_id: character.id,
      });
      expect(error?.message).toContain("mestre desta missão");
    });

    it("missão cancelada não aceita novas inscrições", async () => {
      const mission = await createMission(dm);
      await dm.db.rpc("set_mission_status", {
        p_mission_id: mission.id,
        p_status: "cancelled",
      });

      const user = await createUser("atrasado");
      const character = await createCharacter(user, "Tardio");
      const { error } = await user.db.rpc("apply_to_mission", {
        p_mission_id: mission.id,
        p_character_id: character.id,
      });
      expect(error?.message).toContain("cancelada");
    });
  });

  describe("autorização do mestre", () => {
    it("só o mestre aprova ou recusa", async () => {
      const mission = await createMission(dm);
      const owner = await createUser("candidata");
      const character = await createCharacter(owner, "Candidata");
      await owner.db.rpc("apply_to_mission", {
        p_mission_id: mission.id,
        p_character_id: character.id,
      });
      const part = await participantOf(mission.id, character.id);

      const selfApprove = await owner.db.rpc("decide_participation", {
        p_participant_id: part.id,
        p_decision: "approved",
      });
      expect(selfApprove.error?.message).toContain("Apenas o mestre");

      const byIntruder = await intruder.db.rpc("decide_participation", {
        p_participant_id: part.id,
        p_decision: "approved",
      });
      expect(byIntruder.error?.message).toContain("Apenas o mestre");

      const byDm = await dm.db.rpc("decide_participation", {
        p_participant_id: part.id,
        p_decision: "approved",
      });
      expect(byDm.error).toBeNull();

      const after = await query<{ status: string; approved_at: string | null }>(
        "select status, approved_at from mission_participants where id = $1",
        [part.id],
      );
      expect(after[0].status).toBe("approved");
      expect(after[0].approved_at).not.toBeNull();
    });

    it("recusa libera o jogador para tentar com outra ficha", async () => {
      const user = await createUser("recusado");
      const mission = await createMission(dm);
      const a = await createCharacter(user, "Recusada");
      const b = await createCharacter(user, "Segunda");

      await user.db.rpc("apply_to_mission", {
        p_mission_id: mission.id,
        p_character_id: a.id,
      });
      const part = await participantOf(mission.id, a.id);
      await dm.db.rpc("decide_participation", {
        p_participant_id: part.id,
        p_decision: "rejected",
      });

      const rejected = await query<{ status: string; rejected_at: string | null }>(
        "select status, rejected_at from mission_participants where id = $1",
        [part.id],
      );
      expect(rejected[0].status).toBe("rejected");
      expect(rejected[0].rejected_at).not.toBeNull();

      const retry = await user.db.rpc("apply_to_mission", {
        p_mission_id: mission.id,
        p_character_id: b.id,
      });
      expect(retry.error).toBeNull();
    });

    it("respeita a lotação e marca a missão como cheia", async () => {
      const mission = await createMission(dm, { max_players: 1, min_players: 1 });
      const u1 = await createUser("vaga1");
      const u2 = await createUser("vaga2");
      const c1 = await createCharacter(u1, "Primeiro");
      const c2 = await createCharacter(u2, "Segundo");

      await u1.db.rpc("apply_to_mission", { p_mission_id: mission.id, p_character_id: c1.id });
      await u2.db.rpc("apply_to_mission", { p_mission_id: mission.id, p_character_id: c2.id });

      const p1 = await participantOf(mission.id, c1.id);
      const p2 = await participantOf(mission.id, c2.id);

      const ok = await dm.db.rpc("decide_participation", {
        p_participant_id: p1.id,
        p_decision: "approved",
      });
      expect(ok.error).toBeNull();

      const status = await query<{ status: string }>(
        "select status from missions where id = $1",
        [mission.id],
      );
      expect(status[0].status).toBe("full");

      const full = await dm.db.rpc("decide_participation", {
        p_participant_id: p2.id,
        p_decision: "approved",
      });
      expect(full.error?.message).toContain("Não há mais vagas");
    });
  });

  describe("resolução da missão", () => {
    it("credita XP, ouro, reputação, itens, histórico e conquista numa transação", async () => {
      const mission = await createMission(dm, { min_players: 1, rank: "D" });
      const hero = await createUser("heroi");
      const character = await createCharacter(hero, "Kael");

      await hero.db.rpc("apply_to_mission", {
        p_mission_id: mission.id,
        p_character_id: character.id,
      });
      const part = await participantOf(mission.id, character.id);
      await dm.db.rpc("decide_participation", {
        p_participant_id: part.id,
        p_decision: "approved",
      });

      const { error } = await dm.db.rpc("resolve_mission", {
        p_mission_id: mission.id,
        p_rewards: [
          {
            character_id: character.id,
            survived: true,
            xp: 450,
            gold: 75,
            reputation: 30,
            items: "Espada Longa +1, Poção de Cura",
            notes: "Salvou o grupo na última rodada.",
          },
        ],
      });
      expect(error).toBeNull();

      const after = await query<{
        xp: number; gold: number; reputation: number; level: number;
      }>("select xp, gold, reputation, level from characters where id = $1", [character.id]);
      expect(after[0]).toEqual({ xp: 450, gold: 75, reputation: 30, level: 2 });

      const items = await query<{ name: string; mission_id: string }>(
        "select name, mission_id from character_items where character_id = $1 order by name",
        [character.id],
      );
      expect(items.map((i) => i.name)).toEqual(["Espada Longa +1", "Poção de Cura"]);
      expect(items[0].mission_id).toBe(mission.id);

      const events = await query<{
        event_type: string; xp_delta: number; gold_delta: number; reputation_delta: number;
      }>(
        `select event_type, xp_delta, gold_delta, reputation_delta
         from character_events where character_id = $1 and mission_id = $2`,
        [character.id, mission.id],
      );
      expect(events.map((e) => e.event_type).sort()).toEqual(["level_up", "mission_reward"]);
      const reward = events.find((e) => e.event_type === "mission_reward")!;
      expect([reward.xp_delta, reward.gold_delta, reward.reputation_delta]).toEqual([450, 75, 30]);

      const stored = await query<{ survived: boolean; notes: string }>(
        "select survived, notes from mission_rewards where mission_participant_id = $1",
        [part.id],
      );
      expect(stored[0].survived).toBe(true);
      expect(stored[0].notes).toContain("Salvou o grupo");

      const achievements = await query<{ code: string }>(
        `select a.code from character_achievements ca
         join achievements a on a.id = ca.achievement_id
         where ca.character_id = $1`,
        [character.id],
      );
      expect(achievements.map((a) => a.code)).toContain("first_mission");

      const finalMission = await query<{ status: string }>(
        "select status from missions where id = $1",
        [mission.id],
      );
      expect(finalMission[0].status).toBe("completed");
    });

    it("não credita duas vezes se resolver de novo", async () => {
      const mission = await createMission(dm, { min_players: 1 });
      const user = await createUser("dobro");
      const character = await createCharacter(user, "Dobro");

      await user.db.rpc("apply_to_mission", {
        p_mission_id: mission.id,
        p_character_id: character.id,
      });
      const part = await participantOf(mission.id, character.id);
      await dm.db.rpc("decide_participation", {
        p_participant_id: part.id,
        p_decision: "approved",
      });

      const rewards = [
        { character_id: character.id, survived: true, xp: 100, gold: 10, reputation: 5, items: "", notes: "" },
      ];
      await dm.db.rpc("resolve_mission", { p_mission_id: mission.id, p_rewards: rewards });
      const again = await dm.db.rpc("resolve_mission", {
        p_mission_id: mission.id,
        p_rewards: rewards,
      });
      expect(again.error?.message).toContain("já foi resolvida");

      const rows = await query<{ xp: number }>(
        "select xp from characters where id = $1",
        [character.id],
      );
      expect(rows[0].xp).toBe(100);
    });

    it("quem cai não recebe nada e a ficha não volta ao quadro", async () => {
      const mission = await createMission(dm, { min_players: 1 });
      const user = await createUser("caido");
      const character = await createCharacter(user, "Lyra");

      await user.db.rpc("apply_to_mission", {
        p_mission_id: mission.id,
        p_character_id: character.id,
      });
      const part = await participantOf(mission.id, character.id);
      await dm.db.rpc("decide_participation", {
        p_participant_id: part.id,
        p_decision: "approved",
      });

      await dm.db.rpc("resolve_mission", {
        p_mission_id: mission.id,
        p_rewards: [
          {
            character_id: character.id,
            survived: false,
            xp: 500,
            gold: 500,
            reputation: 500,
            items: "Espada Lendária",
            notes: "Caiu para o ogro.",
          },
        ],
      });

      const after = await query<{
        status: string; xp: number; gold: number; reputation: number;
      }>("select status, xp, gold, reputation from characters where id = $1", [character.id]);
      expect(after[0]).toEqual({ status: "dead", xp: 0, gold: 0, reputation: 0 });

      const items = await query(
        "select id from character_items where character_id = $1",
        [character.id],
      );
      expect(items).toEqual([]);

      const events = await query<{ event_type: string }>(
        "select event_type from character_events where character_id = $1 and mission_id = $2",
        [character.id, mission.id],
      );
      expect(events.map((e) => e.event_type)).toEqual(["mission_death"]);

      const next = await createMission(dm);
      const { error } = await user.db.rpc("apply_to_mission", {
        p_mission_id: next.id,
        p_character_id: character.id,
      });
      expect(error?.message).toContain("caiu em missão");
    });

    it("só o mestre da missão resolve", async () => {
      const mission = await createMission(dm, { min_players: 1 });
      const user = await createUser("naomestre");
      const character = await createCharacter(user, "Qualquer");

      await user.db.rpc("apply_to_mission", {
        p_mission_id: mission.id,
        p_character_id: character.id,
      });
      const part = await participantOf(mission.id, character.id);
      await dm.db.rpc("decide_participation", {
        p_participant_id: part.id,
        p_decision: "approved",
      });

      const { error } = await intruder.db.rpc("resolve_mission", {
        p_mission_id: mission.id,
        p_rewards: [
          { character_id: character.id, survived: true, xp: 9999, gold: 9999, reputation: 999, items: "", notes: "" },
        ],
      });
      expect(error?.message).toContain("Apenas o mestre");

      const rows = await query<{ xp: number }>(
        "select xp from characters where id = $1",
        [character.id],
      );
      expect(rows[0].xp).toBe(0);
    });
  });

  describe("tabelas que só as RPCs escrevem", () => {
    it("bloqueia INSERT direto em mission_rewards, character_events e conquistas", async () => {
      const character = await createCharacter(intruder, "Fraudador");

      const reward = await intruder.db
        .from("mission_rewards")
        .insert({ mission_participant_id: crypto.randomUUID(), xp: 99_999 });
      expect(reward.error).not.toBeNull();

      const event = await intruder.db.from("character_events").insert({
        character_id: character.id,
        event_type: "manual_adjustment",
        xp_delta: 99_999,
      });
      expect(event.error).not.toBeNull();

      const achievements = await query<{ id: string }>("select id from achievements limit 1");
      const granted = await intruder.db.from("character_achievements").insert({
        character_id: character.id,
        achievement_id: achievements[0].id,
      });
      expect(granted.error).not.toBeNull();
    });
  });

  describe("guildas", () => {
    it("reputação da guilda é a soma dos membros e só o fundador edita", async () => {
      const founder = await createUser("fundador");
      const { data: guild, error } = await founder.db
        .from("guilds")
        .insert({
          name: `Guilhotina ${Date.now()}`,
          motto: "Nossa espada protege os fracos.",
          founder_id: founder.id,
        })
        .select()
        .single();
      expect(error).toBeNull();

      const character = await createCharacter(founder, "Membro");
      await founder.db
        .from("characters")
        .update({ guild_id: guild!.id })
        .eq("id", character.id);

      const mission = await createMission(dm, { min_players: 1 });
      await founder.db.rpc("apply_to_mission", {
        p_mission_id: mission.id,
        p_character_id: character.id,
      });
      const part = await participantOf(mission.id, character.id);
      await dm.db.rpc("decide_participation", {
        p_participant_id: part.id,
        p_decision: "approved",
      });
      await dm.db.rpc("resolve_mission", {
        p_mission_id: mission.id,
        p_rewards: [
          { character_id: character.id, survived: true, xp: 10, gold: 0, reputation: 120, items: "", notes: "" },
        ],
      });

      const { data: rep } = await founder.db
        .from("guild_reputation")
        .select("reputation, member_count")
        .eq("guild_id", guild!.id)
        .single();
      expect(rep).toEqual({ reputation: 120, member_count: 1 });

      const { data: hijack } = await intruder.db
        .from("guilds")
        .update({ name: "Roubada" })
        .eq("id", guild!.id)
        .select();
      expect(hijack).toEqual([]);
    });
  });
});

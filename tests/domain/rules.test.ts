import { describe, expect, it } from "vitest";
import {
  LEVEL_TABLE,
  MAX_ACTIVE_CHARACTERS,
  MISSION_RANKS,
  MISSION_RANK_KEYS,
  abilityMod,
  acceptsApplications,
  canCreateCharacter,
  combineDateTime,
  formatLevelRange,
  formatMissionDate,
  formatMissionTime,
  formatMod,
  isMissionClosed,
  levelFromXp,
  parseItemList,
  rankInfo,
  titleFromReputation,
  xpToNext,
} from "@/lib/domain/rules";

describe("progressão de nível", () => {
  it("começa no nível 1 com 0 XP", () => {
    expect(levelFromXp(0)).toBe(1);
  });

  it("sobe exatamente no limiar da tabela 5e", () => {
    expect(levelFromXp(299)).toBe(1);
    expect(levelFromXp(300)).toBe(2);
    expect(levelFromXp(899)).toBe(2);
    expect(levelFromXp(900)).toBe(3);
    expect(levelFromXp(6500)).toBe(5);
  });

  it("respeita a tabela inteira", () => {
    LEVEL_TABLE.forEach((threshold, index) => {
      expect(levelFromXp(threshold)).toBe(index + 1);
    });
  });

  it("trava no nível 20", () => {
    expect(levelFromXp(355000)).toBe(20);
    expect(levelFromXp(10_000_000)).toBe(20);
  });

  it("nunca aceita XP negativo", () => {
    expect(levelFromXp(-500)).toBe(1);
    expect(xpToNext(-500)).toBe(300);
  });

  it("calcula o que falta para o próximo nível", () => {
    expect(xpToNext(0)).toBe(300);
    expect(xpToNext(250)).toBe(50);
    expect(xpToNext(300)).toBe(600);
  });

  it("não tem próximo nível no 20", () => {
    expect(xpToNext(355000)).toBeNull();
  });

  it("uma recompensa que cruza o limiar sobe de nível", () => {
    const before = 200;
    const gained = 150;
    expect(levelFromXp(before)).toBe(1);
    expect(levelFromXp(before + gained)).toBe(2);
  });
});

describe("limite de 3 fichas ativas", () => {
  it("permite cadastrar até 3", () => {
    expect(canCreateCharacter(0)).toBe(true);
    expect(canCreateCharacter(1)).toBe(true);
    expect(canCreateCharacter(2)).toBe(true);
  });

  it("bloqueia a quarta ficha ativa", () => {
    expect(canCreateCharacter(MAX_ACTIVE_CHARACTERS)).toBe(false);
    expect(canCreateCharacter(4)).toBe(false);
  });
});

describe("títulos por reputação", () => {
  it("cobre cada faixa", () => {
    expect(titleFromReputation(0)).toBe("Novato");
    expect(titleFromReputation(99)).toBe("Novato");
    expect(titleFromReputation(100)).toBe("Aventureiro");
    expect(titleFromReputation(500)).toBe("Aventureiro Renomado");
    expect(titleFromReputation(1000)).toBe("Veterano");
    expect(titleFromReputation(2000)).toBe("Campeão");
    expect(titleFromReputation(3000)).toBe("Lenda da Guilda");
  });

  it("trata reputação ausente como Novato", () => {
    expect(titleFromReputation(null)).toBe("Novato");
    expect(titleFromReputation(undefined)).toBe("Novato");
  });
});

describe("ranks de missão", () => {
  it("tem os seis ranks, do F ao S", () => {
    expect(MISSION_RANK_KEYS).toEqual(["F", "D", "C", "B", "A", "S"]);
  });

  it("sugere recompensa crescente conforme o rank sobe", () => {
    const xps = MISSION_RANK_KEYS.map((k) => MISSION_RANKS[k].suggestedXp);
    const sorted = [...xps].sort((a, b) => a - b);
    expect(xps).toEqual(sorted);
  });

  it("mantém a sugestão do rank D que o grupo já usa", () => {
    const d = MISSION_RANKS.D;
    expect(d.suggestedXp).toBe(150);
    expect(d.suggestedGold).toBe(100);
    expect(d.suggestedReputation).toBe(30);
    expect(d.levelRange).toEqual([3, 4]);
  });

  it("cai no rank F para valor desconhecido ou ausente", () => {
    expect(rankInfo(undefined).label).toBe("F");
    expect(rankInfo("Z").label).toBe("F");
  });
});

describe("modificador de atributo", () => {
  it("segue a fórmula 5e", () => {
    expect(abilityMod(10)).toBe(0);
    expect(abilityMod(11)).toBe(0);
    expect(abilityMod(12)).toBe(1);
    expect(abilityMod(8)).toBe(-1);
    expect(abilityMod(20)).toBe(5);
    expect(abilityMod(1)).toBe(-5);
  });

  it("usa 10 quando o atributo não foi preenchido", () => {
    expect(abilityMod(null)).toBe(0);
  });

  it("formata com sinal", () => {
    expect(formatMod(0)).toBe("+0");
    expect(formatMod(3)).toBe("+3");
    expect(formatMod(-2)).toBe("-2");
  });
});

describe("lista de itens", () => {
  it("separa por vírgula e limpa espaços", () => {
    expect(parseItemList("Poção de cura, Espada Longa +1")).toEqual([
      "Poção de cura",
      "Espada Longa +1",
    ]);
  });

  it("descarta entradas vazias", () => {
    expect(parseItemList("Adaga, , ,")).toEqual(["Adaga"]);
    expect(parseItemList("")).toEqual([]);
    expect(parseItemList(null)).toEqual([]);
  });
});

describe("estados da missão", () => {
  it("só aceita inscrição em missão aberta", () => {
    expect(acceptsApplications("open")).toBe(true);
    expect(acceptsApplications("full")).toBe(false);
    expect(acceptsApplications("in_progress")).toBe(false);
    expect(acceptsApplications("completed")).toBe(false);
    expect(acceptsApplications("cancelled")).toBe(false);
  });

  it("considera concluída e cancelada como encerradas", () => {
    expect(isMissionClosed("completed")).toBe(true);
    expect(isMissionClosed("cancelled")).toBe(true);
    expect(isMissionClosed("open")).toBe(false);
    expect(isMissionClosed("full")).toBe(false);
  });
});

describe("formatação do card", () => {
  it("mostra a faixa de nível como o quadro já mostrava", () => {
    expect(formatLevelRange(3, 4)).toBe("3-4");
    expect(formatLevelRange(5, 5)).toBe("5");
  });

  it("formata data e hora a partir do timestamp", () => {
    const iso = combineDateTime("2026-08-28", "18:01");
    expect(formatMissionDate(iso)).toBe("2026-08-28");
    expect(formatMissionTime(iso)).toBe("18:01");
  });

  it("devolve o valor cru quando a data é inválida", () => {
    expect(formatMissionDate("não é data")).toBe("não é data");
  });
});

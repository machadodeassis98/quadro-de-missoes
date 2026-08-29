"use client";

import { useState } from "react";
import { CLASSES, RACES } from "@/lib/domain/rules";
import { Modal } from "@/components/ui/modal";
import { BrassButton, Field } from "@/components/ui/primitives";

export function CreateCharacterModal({
  onClose,
  onCreate,
  busy,
}: {
  onClose: () => void;
  onCreate: (input: { name: string; class: string; race: string }) => void;
  busy: boolean;
}) {
  const [name, setName] = useState("");
  const [charClass, setCharClass] = useState<string>(CLASSES[0]);
  const [race, setRace] = useState<string>(RACES[0]);

  const valid = name.trim().length > 0;

  return (
    <Modal title="Nova Ficha" onClose={onClose}>
      <Field label="Nome do personagem">
        <input
          className="q-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Kael Thornwood"
          maxLength={40}
          autoFocus
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Classe">
          <select
            className="q-input"
            value={charClass}
            onChange={(e) => setCharClass(e.target.value)}
          >
            {CLASSES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Raça">
          <select className="q-input" value={race} onChange={(e) => setRace(e.target.value)}>
            {RACES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </Field>
      </div>

      <p className="font-body text-[13px] text-muted italic mb-4">
        Toda ficha nova começa no nível 1, sem XP, ouro ou item algum. Esta é só uma
        carteirinha de resumo — atributos, PV e CA são anotados à mão e a ficha completa
        (perícias, salvaguardas, magias) fica no Roll20.
      </p>

      <div className="flex justify-end gap-2">
        <BrassButton variant="ghost" onClick={onClose}>
          Cancelar
        </BrassButton>
        <BrassButton
          disabled={!valid || busy}
          onClick={() =>
            valid && onCreate({ name: name.trim(), class: charClass, race })
          }
        >
          {busy ? "Cadastrando..." : "Cadastrar ficha"}
        </BrassButton>
      </div>
    </Modal>
  );
}

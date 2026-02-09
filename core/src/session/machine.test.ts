import { describe, it, expect } from "vitest";
import { createActor } from "xstate";
import { sessionMachine, STATE_TO_EVENT } from "./machine.js";
import { SessionState } from "./types.js";

/** derive valid transitions directly from the xstate machine definition */
function deriveValidTransitions(): Record<SessionState, SessionState[]> {
  const result: Record<string, SessionState[]> = {};
  const config = sessionMachine.config.states!;

  for (const stateKey of Object.values(SessionState)) {
    const stateConfig = config[stateKey];
    if (!stateConfig || !stateConfig.on) {
      result[stateKey] = [];
      continue;
    }

    const targets = new Set<SessionState>();
    for (const [, transition] of Object.entries(stateConfig.on)) {
      const t = transition as { target?: string };
      if (t.target) {
        targets.add(t.target as SessionState);
      }
    }
    result[stateKey] = [...targets];
  }

  return result as Record<SessionState, SessionState[]>;
}

describe("sessionMachine definition", () => {
  it("should have Created as the initial state", () => {
    const actor = createActor(sessionMachine);
    actor.start();
    expect(actor.getSnapshot().value).toBe(SessionState.Created);
    actor.stop();
  });

  it("should define states for all SessionState values", () => {
    const config = sessionMachine.config.states!;
    for (const state of Object.values(SessionState)) {
      expect(config[state]).toBeDefined();
    }
  });

  it("should mark Closed as a final state", () => {
    const config = sessionMachine.config.states!;
    expect(config[SessionState.Closed]).toHaveProperty("type", "final");
  });
});

describe("sessionMachine transitions", () => {
  function actorAt(state: SessionState) {
    const actor = createActor(sessionMachine);
    actor.start();
    // walk through states to reach the target
    const paths: Record<string, string[]> = {
      [SessionState.Created]: [],
      [SessionState.WaitingForSender]: ["START_RECEIVER"],
      [SessionState.Handshaking]: ["START_SENDER"],
      [SessionState.PendingApproval]: ["START_RECEIVER", "SENDER_CONNECTED", "HANDSHAKE_COMPLETE"],
      [SessionState.Active]: ["START_SENDER", "SENDER_AUTHED"],
      [SessionState.Rejected]: ["START_SENDER", "REJECTED"],
      [SessionState.Closed]: ["END_SESSION"],
    };
    for (const event of paths[state]) {
      actor.send({ type: event } as any);
    }
    expect(actor.getSnapshot().value).toBe(state);
    return actor;
  }

  it("Created -> WaitingForSender via START_RECEIVER", () => {
    const actor = actorAt(SessionState.Created);
    actor.send({ type: "START_RECEIVER" });
    expect(actor.getSnapshot().value).toBe(SessionState.WaitingForSender);
    actor.stop();
  });

  it("Created -> Handshaking via START_SENDER", () => {
    const actor = actorAt(SessionState.Created);
    actor.send({ type: "START_SENDER" });
    expect(actor.getSnapshot().value).toBe(SessionState.Handshaking);
    actor.stop();
  });

  it("Created -> Closed via END_SESSION", () => {
    const actor = actorAt(SessionState.Created);
    actor.send({ type: "END_SESSION" });
    expect(actor.getSnapshot().value).toBe(SessionState.Closed);
    actor.stop();
  });

  it("WaitingForSender -> Handshaking via SENDER_CONNECTED", () => {
    const actor = actorAt(SessionState.WaitingForSender);
    actor.send({ type: "SENDER_CONNECTED" });
    expect(actor.getSnapshot().value).toBe(SessionState.Handshaking);
    actor.stop();
  });

  it("Handshaking -> PendingApproval via HANDSHAKE_COMPLETE", () => {
    const actor = actorAt(SessionState.Handshaking);
    actor.send({ type: "HANDSHAKE_COMPLETE" });
    expect(actor.getSnapshot().value).toBe(SessionState.PendingApproval);
    actor.stop();
  });

  it("Handshaking -> Active via SENDER_AUTHED", () => {
    const actor = actorAt(SessionState.Handshaking);
    actor.send({ type: "SENDER_AUTHED" });
    expect(actor.getSnapshot().value).toBe(SessionState.Active);
    actor.stop();
  });

  it("Handshaking -> Rejected via REJECTED", () => {
    const actor = actorAt(SessionState.Handshaking);
    actor.send({ type: "REJECTED" });
    expect(actor.getSnapshot().value).toBe(SessionState.Rejected);
    actor.stop();
  });

  it("PendingApproval -> Active via APPROVED", () => {
    const actor = actorAt(SessionState.PendingApproval);
    actor.send({ type: "APPROVED" });
    expect(actor.getSnapshot().value).toBe(SessionState.Active);
    actor.stop();
  });

  it("PendingApproval -> Rejected via REJECTED", () => {
    const actor = actorAt(SessionState.PendingApproval);
    actor.send({ type: "REJECTED" });
    expect(actor.getSnapshot().value).toBe(SessionState.Rejected);
    actor.stop();
  });

  it("Active -> Closed via END_SESSION", () => {
    const actor = actorAt(SessionState.Active);
    actor.send({ type: "END_SESSION" });
    expect(actor.getSnapshot().value).toBe(SessionState.Closed);
    actor.stop();
  });

  it("Rejected -> Closed via END_SESSION", () => {
    const actor = actorAt(SessionState.Rejected);
    actor.send({ type: "END_SESSION" });
    expect(actor.getSnapshot().value).toBe(SessionState.Closed);
    actor.stop();
  });

  it("should ignore invalid events (stay in current state)", () => {
    const actor = actorAt(SessionState.Active);
    // START_RECEIVER is not valid in Active state
    actor.send({ type: "START_RECEIVER" });
    expect(actor.getSnapshot().value).toBe(SessionState.Active);
    actor.stop();
  });
});

describe("STATE_TO_EVENT mapping", () => {
  it("should have an entry for every valid transition derived from the machine", () => {
    const validTransitions = deriveValidTransitions();
    for (const [fromState, toStates] of Object.entries(validTransitions)) {
      for (const toState of toStates) {
        const key = `${fromState}->${toState}`;
        expect(STATE_TO_EVENT[key]).toBeDefined();
      }
    }
  });

  it("should not have entries for invalid transitions", () => {
    const validTransitions = deriveValidTransitions();
    for (const key of Object.keys(STATE_TO_EVENT)) {
      const [from, to] = key.split("->");
      expect(validTransitions[from as SessionState]).toContain(to);
    }
  });
});

describe("receiver flow path", () => {
  it("should follow Created -> WaitingForSender -> Handshaking -> PendingApproval -> Active -> Closed", () => {
    const actor = createActor(sessionMachine);
    actor.start();

    const events = [
      "START_RECEIVER",
      "SENDER_CONNECTED",
      "HANDSHAKE_COMPLETE",
      "APPROVED",
      "END_SESSION",
    ] as const;

    const expectedStates = [
      SessionState.WaitingForSender,
      SessionState.Handshaking,
      SessionState.PendingApproval,
      SessionState.Active,
      SessionState.Closed,
    ];

    for (let i = 0; i < events.length; i++) {
      actor.send({ type: events[i] });
      expect(actor.getSnapshot().value).toBe(expectedStates[i]);
    }

    actor.stop();
  });
});

describe("sender flow path", () => {
  it("should follow Created -> Handshaking -> Active -> Closed", () => {
    const actor = createActor(sessionMachine);
    actor.start();

    actor.send({ type: "START_SENDER" });
    expect(actor.getSnapshot().value).toBe(SessionState.Handshaking);

    actor.send({ type: "SENDER_AUTHED" });
    expect(actor.getSnapshot().value).toBe(SessionState.Active);

    actor.send({ type: "END_SESSION" });
    expect(actor.getSnapshot().value).toBe(SessionState.Closed);

    actor.stop();
  });
});

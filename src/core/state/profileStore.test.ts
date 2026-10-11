import { beforeEach, describe, expect, it } from "vitest";
import { useProfileStore, validateRegistration } from "./profileStore";

const store = () => useProfileStore.getState();

describe("operator accounts", () => {
  beforeEach(() => useProfileStore.setState({ profile: null, accounts: [] }));

  it("validates a registration", () => {
    expect(validateRegistration("ab", "secret1", "secret1", [])).toBe("callsign");
    expect(validateRegistration("ghost_42", "123", "123", [])).toBe("password");
    expect(validateRegistration("ghost_42", "secret1", "secret2", [])).toBe("mismatch");
    expect(validateRegistration("Ghost_42", "secret1", "secret1", [{ callsign: "ghost_42", joinedAt: 1 }])).toBe("taken");
    expect(validateRegistration("ghost_42", "secret1", "secret1", [])).toBeNull();
  });

  it("registers, signs in, and never keeps the password", () => {
    expect(store().register("ghost_42", "secret1", "secret1")).toBeNull();
    expect(store().profile?.callsign).toBe("ghost_42");
    expect(JSON.stringify(useProfileStore.getState())).not.toContain("secret1");

    const joinedAt = store().accounts[0].joinedAt;
    store().signOut();
    expect(store().signIn("GHOST_42", "anything")).toBeNull();
    expect(store().profile).toMatchObject({ callsign: "ghost_42", joinedAt });
  });

  it("refuses to register the same callsign twice", () => {
    store().register("ghost_42", "secret1", "secret1");
    expect(store().register("ghost_42", "secret1", "secret1")).toBe("taken");
    expect(store().accounts).toHaveLength(1);
  });
});
